import type { APIEvent } from "@solidjs/start/server";
import { count, desc, eq } from "drizzle-orm";
import { beforeAll, describe, expect, test, vi } from "vitest";
import { POST as ingesta } from "~/routes/api/v1/ingesta";
import type { BaseDatos } from "~/server/db/cliente";
import { clientes, empresas, estaciones, eventos, mediciones, sensores } from "~/server/db/esquema";
import { recibirTrama, type LecturaNueva } from "~/server/ingesta/ingesta";
import { estadoTerreno } from "~/server/servicios/estado";
import { crearTerreno } from "~/server/servicios/terrenos";
import { crearBdPrueba, crearCuenta, usarComoBdGlobal } from "./bd";

const CLAVE = process.env.INGESTA_API_KEY!;
const URL_INGESTA = "http://localhost:3000/api/v1/ingesta";
const MIN = 60_000;
const TODOS = ["temperatura_aire", "humedad_aire", "humedad_suelo", "nitrogeno", "fosforo", "potasio"];

let bd: BaseDatos;
let cuentaId: number;
let terrenoId: number;

// Cada trama usa una fecha nueva y creciente, así las pruebas no chocan por el índice (sensor, fecha).
let paso = 0;
const inicio = Date.now() - 20 * 24 * 60 * MIN;
const fechaNueva = () => new Date(inicio + ++paso * 15 * MIN);

beforeAll(async () => {
    bd = crearBdPrueba();
    usarComoBdGlobal(bd);
    const cuenta = await crearCuenta(bd, { correo: "maria@ejemplo.cl", contrasena: null });
    cuentaId = cuenta.id;
    const empresa = bd.insert(empresas).values({ nombre: "Agrícola de prueba", rut: "76123456-0" }).returning().get();
    bd.insert(clientes).values({ empresaId: empresa.id, cuentaId }).run();
    const estacion = { tipo: "Estación de terreno", modelo: "LX-100", latitud: null, longitud: null, sensores: TODOS };
    const terreno = crearTerreno(bd, cuentaId, {
        terreno: { nombre: "Parcela de prueba", latitud: -38.95, longitud: -72.62, superficie: null, tipoCultivo: null },
        estacion: { ...estacion, numeroSerie: "EST-0001" },
    });
    terrenoId = terreno.id;
    // Una segunda estación, deshabilitada.
    const segunda = crearTerreno(bd, cuentaId, {
        terreno: { nombre: "Potrero de prueba", latitud: -36.5, longitud: -72.21, superficie: null, tipoCultivo: null },
        estacion: { ...estacion, numeroSerie: "EST-0002" },
    });
    bd.update(estaciones).set({ habilitada: false }).where(eq(estaciones.id, segunda.estaciones[0]!.id)).run();
});

function trama(datos: { serie?: string; fecha?: Date | string; lecturas?: unknown; meta?: unknown } = {}) {
    const fecha = datos.fecha ?? fechaNueva();
    return {
        numero_serie: datos.serie ?? "EST-0001",
        fecha: typeof fecha === "string" ? fecha : fecha.toISOString(),
        lecturas: datos.lecturas ?? [
            { codigo: "temp_aire", valor: 14.2 },
            { codigo: "hum_suelo", valor: 31.5 },
        ],
        meta: datos.meta ?? { rssi: -97, bateria: 3.9 },
    };
}

function enviar(cuerpo: unknown, clave: string | null = CLAVE) {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (clave !== null) headers["X-Api-Key"] = clave;
    const body = typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo);
    return ingesta({ request: new Request(URL_INGESTA, { method: "POST", headers, body }) } as unknown as APIEvent);
}

const totalMediciones = () => bd.select({ n: count() }).from(mediciones).get()!.n;
const ultimoEvento = () => bd.select().from(eventos).orderBy(desc(eventos.id)).limit(1).get()!;
const sensorDe = (codigo: string, serie = "EST-0001") =>
    bd
        .select({ s: sensores })
        .from(sensores)
        .innerJoin(estaciones, eq(estaciones.id, sensores.estacionId))
        .where(eq(estaciones.numeroSerie, serie))
        .all()
        .map((f) => f.s)
        .find((s) => s.codigo === codigo)!;

describe("[P-FUN-CU03] Recepción de datos de sensores", () => {
    test("[P-FUN-CU03] sensor registrado: la trama se acepta y se guardan sus lecturas", async () => {
        const antes = totalMediciones();
        const res = await enviar(trama());
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ aceptadas: 2, duplicadas: 0 });
        expect(totalMediciones()).toBe(antes + 2);
    });

    test("[P-FUN-CU03] sensor no registrado: se rechaza con 422, sin guardar nada y con evento", async () => {
        const antes = totalMediciones();
        const res = await enviar(trama({ lecturas: [{ codigo: "temp_aire", valor: 10 }, { codigo: "ph", valor: 6.5 }] }));
        expect(res.status).toBe(422);
        const cuerpo = await res.json();
        expect(cuerpo.error.codigo).toBe("NO_PROCESABLE");
        expect(cuerpo.error.campos).toHaveProperty("lecturas.1.codigo");
        expect(totalMediciones()).toBe(antes);
        const evento = ultimoEvento();
        expect(evento.tipo).toBe("TRAMA_RECHAZADA");
        expect(evento.detalle).toMatchObject({ causa: "SENSOR_DESCONOCIDO", trama: { numero_serie: "EST-0001" } });
    });
});

describe("[P-INT-INGESTA] Ingesta de tramas", () => {
    test("[P-INT-INGESTA] trama válida: guarda cada lectura con la trama original y actualiza la última lectura", async () => {
        const fecha = fechaNueva();
        const enviada = trama({ fecha });
        const res = await enviar(enviada);
        expect(res.status).toBe(200);

        const sensor = sensorDe("hum_suelo");
        expect(sensor.fechaUltimaLectura?.getTime()).toBe(fecha.getTime());
        const medicion = bd.select().from(mediciones).where(eq(mediciones.sensorId, sensor.id)).orderBy(desc(mediciones.fecha)).get()!;
        expect(medicion.valor).toBe(31.5);
        expect(medicion.fecha.getTime()).toBe(fecha.getTime());
        expect(medicion.payload).toEqual(enviada);
    });

    test.each([
        ["sin API key", null],
        ["con una API key incorrecta", "otra-clave"],
    ])("[P-INT-INGESTA] %s: 401, sin procesar el cuerpo y con evento sin la trama", async (_, clave) => {
        const antes = totalMediciones();
        const res = await enviar(trama(), clave);
        expect(res.status).toBe(401);
        expect((await res.json()).error.codigo).toBe("NO_AUTENTICADO");
        expect(totalMediciones()).toBe(antes);
        const evento = ultimoEvento();
        expect(evento.tipo).toBe("TRAMA_RECHAZADA");
        expect(evento.detalle).toEqual({ causa: "CREDENCIAL_INVALIDA" });
    });

    test("[P-INT-INGESTA] cuerpo que no es JSON: 400 y evento con el texto recibido", async () => {
        const res = await enviar("{esto no es json");
        expect(res.status).toBe(400);
        expect((await res.json()).error.campos).toHaveProperty("cuerpo");
        expect(ultimoEvento().detalle).toMatchObject({ causa: "ESTRUCTURA_INVALIDA", trama: "{esto no es json" });
    });

    const lecturas = (n: number) => Array.from({ length: n }, (_, i) => ({ codigo: `c${i}`, valor: i }));
    test.each([
        ["fecha más de 5 min en el futuro", { fecha: new Date(Date.now() + 6 * MIN) }, "fecha"],
        ["fecha en otro formato", { fecha: "05-10-2026 14:15" }, "fecha"],
        ["sin lecturas", { lecturas: [] }, "lecturas"],
        ["más de 20 lecturas", { lecturas: lecturas(21) }, "lecturas"],
        ["códigos repetidos", { lecturas: [{ codigo: "temp_aire", valor: 1 }, { codigo: "temp_aire", valor: 2 }] }, "lecturas.1.codigo"],
        ["valor no numérico", { lecturas: [{ codigo: "temp_aire", valor: "14,2" }] }, "lecturas.0.valor"],
        ["sin número de serie", { serie: "" }, "numero_serie"],
    ])("[P-INT-INGESTA] estructura inválida (%s): 400, sin guardar nada y con evento", async (_, datos, campo) => {
        const antes = totalMediciones();
        const enviada = trama(datos);
        const res = await enviar(enviada);
        expect(res.status).toBe(400);
        const cuerpo = await res.json();
        expect(cuerpo.error.codigo).toBe("VALIDACION");
        expect(cuerpo.error.campos).toHaveProperty([campo]);
        expect(totalMediciones()).toBe(antes);
        const evento = ultimoEvento();
        expect(evento.tipo).toBe("TRAMA_RECHAZADA");
        expect(evento.detalle).toMatchObject({ causa: "ESTRUCTURA_INVALIDA", trama: enviada, campos: { [campo]: expect.any(String) } });
    });

    test.each([
        ["estación inexistente", { serie: "EST-9999" }, "ESTACION_DESCONOCIDA", "numero_serie"],
        ["estación deshabilitada", { serie: "EST-0002" }, "ESTACION_DESHABILITADA", "numero_serie"],
        ["valor sobre el rango del sensor", { lecturas: [{ codigo: "hum_aire", valor: 140 }] }, "VALOR_FUERA_DE_RANGO", "lecturas.0.valor"],
        ["valor bajo el rango del sensor", { lecturas: [{ codigo: "hum_suelo", valor: 30 }, { codigo: "temp_aire", valor: -25 }] }, "VALOR_FUERA_DE_RANGO", "lecturas.1.valor"],
    ])("[P-INT-INGESTA] %s: 422, sin guardar nada y con evento", async (_, datos, causa, campo) => {
        const antes = totalMediciones();
        const res = await enviar(trama(datos));
        expect(res.status).toBe(422);
        expect((await res.json()).error.campos).toHaveProperty([campo]);
        expect(totalMediciones()).toBe(antes);
        const evento = ultimoEvento();
        expect(evento.tipo).toBe("TRAMA_RECHAZADA");
        expect(evento.detalle).toMatchObject({ causa });
    });

    test("[P-INT-INGESTA] los límites del rango del sensor se aceptan", async () => {
        const res = await enviar(trama({ lecturas: [{ codigo: "hum_aire", valor: 100 }, { codigo: "temp_aire", valor: -20 }] }));
        expect(res.status).toBe(200);
    });

    test("[P-INT-INGESTA] lectura repetida (mismo sensor y fecha): no se duplica y la respuesta lo informa", async () => {
        const fecha = fechaNueva();
        await enviar(trama({ fecha }));
        const antes = totalMediciones();

        const repetida = await enviar(trama({ fecha }));
        expect(repetida.status).toBe(200);
        expect(await repetida.json()).toEqual({ aceptadas: 0, duplicadas: 2 });
        expect(totalMediciones()).toBe(antes);

        // Una trama que mezcla una lectura nueva y una repetida guarda solo la nueva.
        const mixta = await enviar(trama({ fecha, lecturas: [{ codigo: "temp_aire", valor: 14.2 }, { codigo: "n", valor: 40 }] }));
        expect(await mixta.json()).toEqual({ aceptadas: 1, duplicadas: 1 });
        expect(totalMediciones()).toBe(antes + 1);
    });

    test("[P-INT-INGESTA] error de almacenamiento: 500, nada guardado a medias y evento ERROR_INGESTA", async () => {
        // Falla al insertar la segunda lectura, después de guardar la primera.
        bd.$client.exec(
            `CREATE TRIGGER falla_de_prueba BEFORE INSERT ON mediciones WHEN NEW.valor = 66.6
             BEGIN SELECT RAISE(ABORT, 'falla de prueba'); END`,
        );
        const silenciar = vi.spyOn(console, "error").mockImplementation(() => {});
        try {
            const antes = totalMediciones();
            const ultimaAntes = sensorDe("temp_aire").fechaUltimaLectura;
            const res = await enviar(trama({ lecturas: [{ codigo: "temp_aire", valor: 12 }, { codigo: "hum_aire", valor: 66.6 }] }));
            expect(res.status).toBe(500);
            expect((await res.json()).error.codigo).toBe("INTERNO");
            expect(totalMediciones()).toBe(antes);
            expect(sensorDe("temp_aire").fechaUltimaLectura).toEqual(ultimaAntes);
            const evento = ultimoEvento();
            expect(evento.tipo).toBe("ERROR_INGESTA");
            expect(evento.detalle).toMatchObject({ causa: "ERROR_ALMACENAMIENTO", trama: { numero_serie: "EST-0001" } });
        } finally {
            silenciar.mockRestore();
            bd.$client.exec("DROP TRIGGER falla_de_prueba");
        }
    });

    test("[P-INT-INGESTA] el evento nunca guarda la API key y trunca la trama a 8 KB", async () => {
        await enviar(trama({ serie: "EST-9999", meta: { nota: `clave ${CLAVE}` } }));
        const conClave = JSON.stringify(ultimoEvento().detalle);
        expect(conClave).not.toContain(CLAVE);
        expect(conClave).toContain("[oculto]");

        await enviar(trama({ serie: "EST-9999", meta: { relleno: "x".repeat(20_000) } }));
        const { trama: guardada } = ultimoEvento().detalle as { trama: unknown };
        expect(typeof guardada).toBe("string");
        expect(Buffer.byteLength(guardada as string)).toBeLessThanOrEqual(8 * 1024);
    });

    test("[P-INT-INGESTA] trama atrasada: se guarda, no mueve la última lectura ni se evalúa, y el panel muestra la más reciente", async () => {
        const evaluar = vi.fn<(tx: unknown, lecturas: LecturaNueva[]) => void>();
        const recibir = (cuerpo: unknown) =>
            recibirTrama(
                bd,
                new Request(URL_INGESTA, { method: "POST", headers: { "X-Api-Key": CLAVE }, body: JSON.stringify(cuerpo) }),
                { evaluar },
            );

        const reciente = fechaNueva();
        const atrasada = new Date(reciente.getTime() - 7 * MIN); // entre dos tramas anteriores: no es duplicada
        expect(await recibir(trama({ fecha: reciente, lecturas: [{ codigo: "hum_suelo", valor: 22 }] }))).toEqual({ aceptadas: 1, duplicadas: 0 });
        expect(await recibir(trama({ fecha: atrasada, lecturas: [{ codigo: "hum_suelo", valor: 45 }] }))).toEqual({ aceptadas: 1, duplicadas: 0 });

        const sensor = sensorDe("hum_suelo");
        // Queda en el historial…
        const guardada = bd.select().from(mediciones).where(eq(mediciones.sensorId, sensor.id)).all().find((m) => m.fecha.getTime() === atrasada.getTime());
        expect(guardada?.valor).toBe(45);
        // …pero la última lectura sigue siendo la más reciente.
        expect(sensor.fechaUltimaLectura?.getTime()).toBe(reciente.getTime());

        // Solo la lectura reciente llega a la evaluación de criterios.
        expect(evaluar).toHaveBeenCalledTimes(1);
        expect(evaluar.mock.calls[0]![1]).toEqual([expect.objectContaining({ sensorId: sensor.id, valor: 22, fecha: reciente })]);

        // El panel toma el valor vigente por la fecha de la medición, no por el orden de llegada.
        const panel = estadoTerreno(bd, cuentaId, terrenoId, reciente);
        const variable = panel.estaciones.flatMap((e) => e.variables).find((v) => v.sensorId === sensor.id)!;
        expect(variable.valor).toBe(22);
        expect(variable.fecha).toBe(reciente.toISOString());
    });
});
