import type { APIEvent } from "@solidjs/start/server";
import { and, eq } from "drizzle-orm";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { POST as ingesta } from "~/routes/api/v1/ingesta";
import type { BaseDatos } from "~/server/db/cliente";
import { alertas, clientes, criterios, cuentas, empresas, eventos, mediciones, notificaciones } from "~/server/db/esquema";
import { ERROR_FALLA_SIMULADA, ERROR_SIN_TELEFONO } from "~/server/notificaciones/canales";
import { despacharNotificaciones, MAX_INTENTOS, puedeReintentarse } from "~/server/notificaciones/despacho";
import { detenerReintentos, iniciarReintentos, INTERVALO_REINTENTOS_MS } from "~/server/notificaciones/reintentos";
import { crearTerreno } from "~/server/servicios/terrenos";
import { crearBdPrueba, crearCuenta, usarComoBdGlobal } from "./bd";

// Las notificaciones se verifican con el despachador real, a partir de tramas enviadas al endpoint
// de ingesta: nunca con notificaciones sembradas (diseno.md §10).

const CLAVE = process.env.INGESTA_API_KEY!;
const MIN = 60_000;
const TODOS = ["temperatura_aire", "humedad_aire", "humedad_suelo", "nitrogeno", "fosforo", "potasio"];

let bd: BaseDatos;
let maria: number;
let pedro: number;
let carpetaCorreos: string;
let carpetaMensajes: string;
let numeroEstacion = 0;

// Fechas crecientes: cada trama es posterior a la anterior.
let paso = 0;
const inicio = Date.now() - 10 * 24 * 60 * MIN;
const fechaNueva = () => new Date(inicio + ++paso * 15 * MIN);

async function productor(correo: string, rut: string, telefono: string | null) {
    const cuenta = await crearCuenta(bd, { correo, contrasena: null });
    bd.update(cuentas).set({ telefono }).where(eq(cuentas.id, cuenta.id)).run();
    const empresa = bd.insert(empresas).values({ nombre: `Empresa de ${correo}`, rut }).returning().get();
    bd.insert(clientes).values({ empresaId: empresa.id, cuentaId: cuenta.id }).run();
    return cuenta.id;
}

beforeAll(async () => {
    bd = crearBdPrueba();
    usarComoBdGlobal(bd);
    // Carpetas propias de este archivo, para contar solo lo que envían sus pruebas.
    carpetaCorreos = mkdtempSync(join(tmpdir(), "lorax-correos-evaluacion-"));
    carpetaMensajes = mkdtempSync(join(tmpdir(), "lorax-mensajes-evaluacion-"));
    process.env.CORREOS_DIR = carpetaCorreos;
    process.env.MENSAJES_DIR = carpetaMensajes;
    maria = await productor("maria@ejemplo.cl", "76123456-0", "+56911111111");
    pedro = await productor("pedro@ejemplo.cl", "77234567-4", null);
    vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
    process.env.MENSAJES_DIR = carpetaMensajes;
    delete process.env.NOTIF_SIMULAR_FALLO;
});

/** Estación nueva con los 6 sensores; devuelve su número de serie y sus sensores por código. */
function nuevaEstacion(cuentaId = maria) {
    const serie = `EST-${String(++numeroEstacion).padStart(4, "0")}`;
    const terreno = crearTerreno(bd, cuentaId, {
        terreno: { nombre: "Parcela de prueba", latitud: -38.95, longitud: -72.62, superficie: null, tipoCultivo: null },
        estacion: { tipo: "Estación de terreno", modelo: "LX-100", numeroSerie: serie, latitud: null, longitud: null, sensores: TODOS },
    });
    const sensor = Object.fromEntries(terreno.estaciones[0]!.sensores.map((s) => [s.codigo, s.id]));
    return { serie, sensor };
}

function nuevoCriterio(sensorId: number, datos: { condicion: "SUPERA" | "DESCIENDE"; umbral: number; canales?: string[]; habilitado?: boolean; eliminado?: boolean }) {
    return bd
        .insert(criterios)
        .values({
            sensorId,
            umbral: datos.umbral,
            condicion: datos.condicion,
            canales: (datos.canales ?? ["PLATAFORMA"]).join(","),
            habilitado: datos.habilitado ?? true,
            fechaCreacion: new Date(inicio),
            fechaEliminacion: datos.eliminado ? new Date(inicio) : null,
        })
        .returning()
        .get().id;
}

async function enviar(serie: string, lecturas: Array<{ codigo: string; valor: number }>, fecha = fechaNueva()) {
    const res = await ingesta({
        request: new Request("http://localhost:3000/api/v1/ingesta", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Api-Key": CLAVE },
            body: JSON.stringify({ numero_serie: serie, fecha: fecha.toISOString(), lecturas }),
        }),
    } as unknown as APIEvent);
    expect(res.status).toBe(200);
    return fecha;
}

const alertasDe = (criterioId: number) => bd.select().from(alertas).where(eq(alertas.criterioId, criterioId)).all();
const notificacionesDe = (alertaId: number) => bd.select().from(notificaciones).where(eq(notificaciones.alertaId, alertaId)).all();
const eventosDe = (notificacionId: number) =>
    bd
        .select()
        .from(eventos)
        .where(and(eq(eventos.tipo, "ERROR_NOTIFICACION"), eq(eventos.entidadId, notificacionId)))
        .all();
const archivos = (carpeta: string) =>
    readdirSync(carpeta)
        .filter((a) => a.endsWith(".json"))
        .map((a) => JSON.parse(readFileSync(join(carpeta, a), "utf8")) as Record<string, string>);

describe("[P-FUN-CU06] Evaluación de criterios", () => {
    test("[P-FUN-CU06] una lectura que incumple crea una alerta vigente con su mensaje y una notificación por canal", async () => {
        const { serie, sensor } = nuevaEstacion();
        const criterioId = nuevoCriterio(sensor.hum_suelo!, { condicion: "DESCIENDE", umbral: 25, canales: ["PLATAFORMA", "CORREO"] });
        const fecha = await enviar(serie, [{ codigo: "hum_suelo", valor: 18.2 }]);

        const [alerta, ...otras] = alertasDe(criterioId);
        expect(otras).toHaveLength(0);
        expect(alerta).toMatchObject({
            estado: "VIGENTE",
            leida: false,
            nombre: "Humedad del suelo bajo el umbral",
            mensaje: `Humedad del suelo bajo el umbral en Parcela de prueba (${serie}): 18,2 % (umbral 25 %)`,
            fecha,
        });
        const medicion = bd.select().from(mediciones).where(eq(mediciones.id, alerta!.medicionId)).get()!;
        expect(medicion).toMatchObject({ sensorId: sensor.hum_suelo, valor: 18.2 });
        expect(notificacionesDe(alerta!.id).map((n) => n.canal).sort()).toEqual(["CORREO", "PLATAFORMA"]);
    });

    test("[P-FUN-CU06] sin duplicados: otra lectura que incumple no crea otra alerta ni vuelve a notificar; una que cumple la resuelve", async () => {
        const { serie, sensor } = nuevaEstacion();
        const criterioId = nuevoCriterio(sensor.temp_aire!, { condicion: "SUPERA", umbral: 30, canales: ["PLATAFORMA", "CORREO"] });
        await enviar(serie, [{ codigo: "temp_aire", valor: 31 }]);
        await enviar(serie, [{ codigo: "temp_aire", valor: 35 }]);
        expect(alertasDe(criterioId)).toHaveLength(1);
        const alertaId = alertasDe(criterioId)[0]!.id;
        expect(notificacionesDe(alertaId)).toHaveLength(2);

        const fecha = await enviar(serie, [{ codigo: "temp_aire", valor: 22 }]);
        const [resuelta] = alertasDe(criterioId);
        expect(resuelta).toMatchObject({ estado: "RESUELTA", fechaResolucion: fecha });
        expect(notificacionesDe(alertaId)).toHaveLength(2);

        // Si vuelve a incumplir, se crea una alerta nueva.
        await enviar(serie, [{ codigo: "temp_aire", valor: 33 }]);
        expect(alertasDe(criterioId).map((a) => a.estado)).toEqual(["RESUELTA", "VIGENTE"]);
    });

    test("[P-FUN-CU06] un valor igual al umbral no incumple, ni con «Supera» ni con «Desciende bajo»", async () => {
        const { serie, sensor } = nuevaEstacion();
        const supera = nuevoCriterio(sensor.hum_aire!, { condicion: "SUPERA", umbral: 80 });
        const desciende = nuevoCriterio(sensor.hum_suelo!, { condicion: "DESCIENDE", umbral: 25 });
        await enviar(serie, [
            { codigo: "hum_aire", valor: 80 },
            { codigo: "hum_suelo", valor: 25 },
        ]);
        expect(alertasDe(supera)).toHaveLength(0);
        expect(alertasDe(desciende)).toHaveLength(0);
    });

    test("[P-FUN-CU06] un criterio deshabilitado o eliminado no se evalúa", async () => {
        const { serie, sensor } = nuevaEstacion();
        const deshabilitado = nuevoCriterio(sensor.n!, { condicion: "DESCIENDE", umbral: 20, habilitado: false });
        const eliminado = nuevoCriterio(sensor.n!, { condicion: "DESCIENDE", umbral: 20, eliminado: true });
        await enviar(serie, [{ codigo: "n", valor: 5 }]);
        expect(alertasDe(deshabilitado)).toHaveLength(0);
        expect(alertasDe(eliminado)).toHaveLength(0);
    });

    test("[P-FUN-CU06] un criterio sin canales crea la alerta, pero sin notificaciones (RF06.3)", async () => {
        const { serie, sensor } = nuevaEstacion();
        const criterioId = nuevoCriterio(sensor.p!, { condicion: "SUPERA", umbral: 100, canales: [] });
        await enviar(serie, [{ codigo: "p", valor: 150 }]);
        const [alerta] = alertasDe(criterioId);
        expect(alerta?.estado).toBe("VIGENTE");
        expect(notificacionesDe(alerta!.id)).toHaveLength(0);
    });

    test("[P-FUN-CU06] una trama atrasada se guarda, pero no crea ni resuelve alertas", async () => {
        const { serie, sensor } = nuevaEstacion();
        const humedad = nuevoCriterio(sensor.hum_suelo!, { condicion: "DESCIENDE", umbral: 25 });
        const potasio = nuevoCriterio(sensor.k!, { condicion: "SUPERA", umbral: 300 });

        const reciente = await enviar(serie, [
            { codigo: "hum_suelo", valor: 18 },
            { codigo: "k", valor: 200 },
        ]);
        expect(alertasDe(humedad).map((a) => a.estado)).toEqual(["VIGENTE"]);

        // Atrasada: humedad dentro del umbral (no resuelve) y potasio sobre el umbral (no crea alerta).
        const atrasada = new Date(reciente.getTime() - 7 * MIN);
        await enviar(serie, [{ codigo: "hum_suelo", valor: 40 }, { codigo: "k", valor: 500 }], atrasada);

        expect(alertasDe(humedad).map((a) => a.estado)).toEqual(["VIGENTE"]);
        expect(alertasDe(potasio)).toHaveLength(0);
        const guardadas = bd.select().from(mediciones).where(eq(mediciones.fecha, atrasada)).all();
        expect(guardadas.map((m) => m.valor).sort()).toEqual([40, 500]);
    });
});

describe("[P-INT-NOTIFICACION] Notificación de alertas", () => {
    test("[P-INT-NOTIFICACION] una lectura fuera de rango notifica por cada canal con el despachador real", async () => {
        const { serie, sensor } = nuevaEstacion();
        const correosAntes = archivos(carpetaCorreos).length;
        const mensajesAntes = archivos(carpetaMensajes).length;
        const criterioId = nuevoCriterio(sensor.hum_suelo!, { condicion: "DESCIENDE", umbral: 25, canales: ["PLATAFORMA", "CORREO", "SMS", "WHATSAPP"] });
        await enviar(serie, [{ codigo: "hum_suelo", valor: 12.5 }]);

        const [alerta] = alertasDe(criterioId);
        const envios = notificacionesDe(alerta!.id);
        expect(envios).toHaveLength(4);
        for (const n of envios) expect(n).toMatchObject({ estado: "ENVIADA", intentos: 1, error: null, fechaUltimoIntento: expect.any(Date) });

        const correos = archivos(carpetaCorreos);
        expect(correos).toHaveLength(correosAntes + 1);
        const correo = correos.find((c) => c.texto?.includes(serie))!;
        expect(correo).toMatchObject({ para: "maria@ejemplo.cl", asunto: "Alerta LoRax: Humedad del suelo bajo el umbral" });
        expect(correo.texto).toContain(alerta!.mensaje);
        expect(correo.texto).toContain("http://localhost:3000/alertas");

        const mensajes = archivos(carpetaMensajes);
        expect(mensajes).toHaveLength(mensajesAntes + 2);
        const deEsta = mensajes.filter((m) => m.texto?.includes(serie));
        expect(deEsta.map((m) => m.canal).sort()).toEqual(["SMS", "WHATSAPP"]);
        for (const m of deEsta) expect(m.para).toBe("+56911111111");
    });

    test("[P-INT-NOTIFICACION] una lectura dentro de rango no notifica", async () => {
        const { serie, sensor } = nuevaEstacion();
        const criterioId = nuevoCriterio(sensor.hum_suelo!, { condicion: "DESCIENDE", umbral: 25, canales: ["CORREO", "SMS"] });
        const correosAntes = archivos(carpetaCorreos).length;
        const mensajesAntes = archivos(carpetaMensajes).length;
        await enviar(serie, [{ codigo: "hum_suelo", valor: 35 }]);
        expect(alertasDe(criterioId)).toHaveLength(0);
        expect(archivos(carpetaCorreos)).toHaveLength(correosAntes);
        expect(archivos(carpetaMensajes)).toHaveLength(mensajesAntes);
    });

    test("[P-INT-NOTIFICACION] sin teléfono es una falla permanente: queda FALLIDA, un solo evento y no se reintenta", async () => {
        const { serie, sensor } = nuevaEstacion(pedro);
        const criterioId = nuevoCriterio(sensor.hum_suelo!, { condicion: "DESCIENDE", umbral: 25, canales: ["PLATAFORMA", "SMS"] });
        await enviar(serie, [{ codigo: "hum_suelo", valor: 10 }]);
        await enviar(serie, [{ codigo: "hum_suelo", valor: 9 }]);
        await enviar(serie, [{ codigo: "temp_aire", valor: 12 }]);

        const [alerta] = alertasDe(criterioId);
        expect(alerta?.estado).toBe("VIGENTE"); // la alerta se conserva (RF06.9)
        const sms = notificacionesDe(alerta!.id).find((n) => n.canal === "SMS")!;
        expect(sms).toMatchObject({ estado: "FALLIDA", intentos: 1, error: ERROR_SIN_TELEFONO });
        const registrados = eventosDe(sms.id);
        expect(registrados).toHaveLength(1);
        expect(registrados[0]!.detalle).toMatchObject({ causa: "SIN_TELEFONO", canal: "SMS", reintentar: false });
        expect(notificacionesDe(alerta!.id).find((n) => n.canal === "PLATAFORMA")?.estado).toBe("ENVIADA");
    });

    test(`[P-INT-NOTIFICACION] una falla pasajera se reintenta con espera de 1, 2, 4 y 8 min y se detiene al intento ${MAX_INTENTOS}`, async () => {
        const { serie, sensor } = nuevaEstacion();
        const criterioId = nuevoCriterio(sensor.hum_suelo!, { condicion: "DESCIENDE", umbral: 25, canales: ["SMS"] });
        process.env.NOTIF_SIMULAR_FALLO = "SMS";

        await enviar(serie, [{ codigo: "hum_suelo", valor: 10 }]);
        const [alerta] = alertasDe(criterioId);
        const sms = () => notificacionesDe(alerta!.id)[0]!;
        expect(sms()).toMatchObject({ estado: "FALLIDA", intentos: 1, error: ERROR_FALLA_SIMULADA });

        // Una trama que llega antes de que pase la espera no adelanta el reintento.
        await enviar(serie, [{ codigo: "temp_aire", valor: 12 }]);
        expect(sms().intentos).toBe(1);

        for (const [intento, minutos] of [[2, 1], [3, 2], [4, 4], [5, 8]] as const) {
            const ultimo = sms().fechaUltimoIntento!.getTime();
            await despacharNotificaciones(bd, new Date(ultimo + minutos * MIN - 1000));
            expect(sms().intentos, `antes de ${minutos} min`).toBe(intento - 1);
            await despacharNotificaciones(bd, new Date(ultimo + minutos * MIN));
            expect(sms().intentos, `a los ${minutos} min`).toBe(intento);
        }
        expect(sms().estado).toBe("FALLIDA");
        const registrados = eventosDe(sms().id);
        expect(registrados).toHaveLength(MAX_INTENTOS);
        expect(registrados.map((e) => (e.detalle as { reintentar: boolean }).reintentar)).toEqual([true, true, true, true, false]);

        // Con el tope alcanzado ya no se reintenta, aunque el canal se recupere.
        delete process.env.NOTIF_SIMULAR_FALLO;
        await despacharNotificaciones(bd, new Date(sms().fechaUltimoIntento!.getTime() + 60 * MIN));
        expect(sms()).toMatchObject({ estado: "FALLIDA", intentos: MAX_INTENTOS });
    });

    test("[P-INT-NOTIFICACION] una falla pasajera se envía en el siguiente reintento si el canal se recupera", async () => {
        const { serie, sensor } = nuevaEstacion();
        const criterioId = nuevoCriterio(sensor.hum_aire!, { condicion: "SUPERA", umbral: 90, canales: ["WHATSAPP"] });
        process.env.NOTIF_SIMULAR_FALLO = "whatsapp, correo"; // sin distinguir mayúsculas ni espacios

        await enviar(serie, [{ codigo: "hum_aire", valor: 95 }]);
        const [alerta] = alertasDe(criterioId);
        const whatsapp = () => notificacionesDe(alerta!.id)[0]!;
        expect(whatsapp()).toMatchObject({ estado: "FALLIDA", intentos: 1 });

        delete process.env.NOTIF_SIMULAR_FALLO;
        await despacharNotificaciones(bd, new Date(whatsapp().fechaUltimoIntento!.getTime() + MIN));
        expect(whatsapp()).toMatchObject({ estado: "ENVIADA", intentos: 2, error: null });
        expect(archivos(carpetaMensajes).some((m) => m.canal === "WHATSAPP" && m.texto?.includes(serie))).toBe(true);
    });

    test("[P-INT-NOTIFICACION] la tarea periódica despacha las notificaciones pendientes", async () => {
        expect(INTERVALO_REINTENTOS_MS).toBe(60_000);
        const { serie, sensor } = nuevaEstacion();
        const criterioId = nuevoCriterio(sensor.p!, { condicion: "SUPERA", umbral: 100, canales: [] });
        await enviar(serie, [{ codigo: "p", valor: 150 }]);
        const [alerta] = alertasDe(criterioId);
        // Una pendiente que quedó sin despachar, por ejemplo si el servidor se detuvo justo después de la trama.
        const id = bd.insert(notificaciones).values({ alertaId: alerta!.id, canal: "CORREO" }).returning().get().id;

        let rondas = 0;
        expect(iniciarReintentos(() => (rondas++, bd), 20)).toBe(true);
        expect(iniciarReintentos(() => bd, 20)).toBe(false); // una sola tarea por proceso
        try {
            await vi.waitFor(() => expect(bd.select().from(notificaciones).where(eq(notificaciones.id, id)).get()!.estado).toBe("ENVIADA"));
            await vi.waitFor(() => expect(rondas).toBeGreaterThanOrEqual(2));
        } finally {
            detenerReintentos();
        }
    });

    test("[P-INT-NOTIFICACION] reglas de la espera creciente", () => {
        const t = new Date("2026-10-07T12:00:00Z");
        const despues = (minutos: number) => new Date(t.getTime() + minutos * MIN);
        expect(puedeReintentarse(1, t, despues(0.99))).toBe(false);
        expect(puedeReintentarse(1, t, despues(1))).toBe(true);
        expect(puedeReintentarse(2, t, despues(2))).toBe(true);
        expect(puedeReintentarse(3, t, despues(3.9))).toBe(false);
        expect(puedeReintentarse(4, t, despues(8))).toBe(true);
        expect(puedeReintentarse(MAX_INTENTOS, t, despues(999))).toBe(false);
    });
});
