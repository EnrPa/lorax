import type { APIEvent } from "@solidjs/start/server";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, test } from "vitest";
import { GET as listarAlertas } from "~/routes/api/v1/alertas/index";
import { PATCH as marcarLeida } from "~/routes/api/v1/alertas/[id]";
import { GET as cantidadNoLeidas } from "~/routes/api/v1/alertas/no-leidas/cantidad";
import { DELETE as eliminar, PATCH as habilitacion } from "~/routes/api/v1/criterios/[id]";
import { GET as listarCriterios, POST as crear } from "~/routes/api/v1/criterios/index";
import { GET as lecturas } from "~/routes/api/v1/sensores/[id]/lecturas-recientes";
import { COOKIE_SESION } from "~/server/auth/cookie";
import { crearSesion } from "~/server/auth/sesiones";
import type { BaseDatos } from "~/server/db/cliente";
import { alertas, clientes, criterios, empresas, estaciones, mediciones, sensores, terrenos } from "~/server/db/esquema";
import { crearBdPrueba, crearCuenta, usarComoBdGlobal } from "./bd";

const AHORA = new Date("2026-09-26T12:00:00Z");
let bd: BaseDatos;
let maria: string;
let jose: string;
let admin: string;
let terrenoA: number;
let terrenoB: number;
let humedad: number;
let temperatura: number;
let sensorOtroTerreno: number;
let sensorDeJose: number;

beforeAll(async () => {
    bd = crearBdPrueba();
    usarComoBdGlobal(bd);
    const cuentaMaria = await crearCuenta(bd, { correo: "maria@ejemplo.cl", contrasena: null });
    const cuentaJose = await crearCuenta(bd, { correo: "jose@ejemplo.cl", contrasena: null });
    const cuentaAdmin = await crearCuenta(bd, { correo: "admin@ejemplo.cl", rol: "ADMINISTRADOR", contrasena: null });
    maria = (await crearSesion(bd, cuentaMaria, false)).token;
    jose = (await crearSesion(bd, cuentaJose, false)).token;
    admin = (await crearSesion(bd, cuentaAdmin, false)).token;

    const cliente = (cuentaId: number, rut: string) => {
        const empresa = bd.insert(empresas).values({ nombre: rut, rut }).returning().get();
        return bd.insert(clientes).values({ empresaId: empresa.id, cuentaId }).returning().get().id;
    };
    const clienteMaria = cliente(cuentaMaria.id, "76.123.456-0");
    const clienteJose = cliente(cuentaJose.id, "77.234.567-4");
    const terreno = (clienteId: number, nombre: string) =>
        bd.insert(terrenos).values({ clienteId, nombre, latitud: 0, longitud: 0, fechaUltimaActualizacion: AHORA }).returning().get().id;
    const estacion = (terrenoId: number, serie: string) =>
        bd
            .insert(estaciones)
            .values({ terrenoId, tipo: "E", modelo: "M", numeroSerie: serie, latitud: 0, longitud: 0, fechaCreacion: AHORA, fechaUltimaActualizacion: AHORA })
            .returning()
            .get().id;
    const sensor = (estacionId: number, tipo: string, codigo: string, unidad: string, min: number, max: number) =>
        bd
            .insert(sensores)
            .values({ estacionId, codigo, tipo, unidad, rangoMinimo: min, rangoMaximo: max, fechaCreacion: AHORA })
            .returning()
            .get().id;

    terrenoA = terreno(clienteMaria, "Parcela A");
    terrenoB = terreno(clienteMaria, "Parcela B");
    const e1 = estacion(terrenoA, "EST-1");
    humedad = sensor(e1, "humedad_suelo", "hum_suelo", "%", 0, 100);
    temperatura = sensor(e1, "temperatura_aire", "temp_aire", "°C", -20, 60);
    sensorOtroTerreno = sensor(estacion(terrenoB, "EST-2"), "humedad_suelo", "hum_suelo", "%", 0, 100);
    sensorDeJose = sensor(estacion(terreno(clienteJose, "Huerto de José"), "EST-9"), "humedad_suelo", "hum_suelo", "%", 0, 100);

    // 7 lecturas de humedad, una por hora.
    for (let i = 0; i < 7; i++) {
        bd.insert(mediciones).values({ sensorId: humedad, valor: 30 + i, fecha: new Date(AHORA.getTime() - i * 3_600_000), payload: {} }).run();
    }
});

function pedir(handler: (e: APIEvent) => Promise<Response>, opciones: { token?: string | null; metodo?: string; id?: number; cuerpo?: unknown; consulta?: string } = {}) {
    const token = opciones.token === undefined ? maria : opciones.token;
    return handler({
        request: new Request(`http://localhost:3000/api/v1/x${opciones.consulta ?? ""}`, {
            method: opciones.metodo ?? "GET",
            headers: { "Content-Type": "application/json", ...(token ? { cookie: `${COOKIE_SESION}=${token}` } : {}) },
            body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
        }),
        params: { id: String(opciones.id ?? "") },
    } as unknown as APIEvent);
}

const crearCriterio = (cuerpo: object, token?: string) => pedir(crear, { metodo: "POST", cuerpo, token });

/** Crea un criterio con una alerta vigente y otra ya resuelta, para probar la regla de §8.2. */
async function criterioConAlertas() {
    const criterio = await (await crearCriterio({ sensorId: humedad, umbral: 40, condicion: "DESCIENDE", canales: ["PLATAFORMA"] })).json();
    const medicionId = bd.select().from(mediciones).where(eq(mediciones.sensorId, humedad)).get()!.id;
    const alerta = (estado: "VIGENTE" | "RESUELTA") =>
        bd
            .insert(alertas)
            .values({ medicionId, criterioId: criterio.id, nombre: "Humedad baja", tipo: "ADVERTENCIA", mensaje: "m", estado, fecha: AHORA, fechaResolucion: estado === "RESUELTA" ? AHORA : null })
            .returning()
            .get().id;
    return { criterio, resuelta: alerta("RESUELTA"), vigente: alerta("VIGENTE") };
}

const filaAlerta = (id: number) => bd.select().from(alertas).where(eq(alertas.id, id)).get()!;

describe("configuración de criterios (CU06)", () => {
    test("[P-FUN-CU06] se crea un criterio con umbral, condición y canales", async () => {
        const respuesta = await crearCriterio({ sensorId: humedad, umbral: 25, condicion: "DESCIENDE", canales: ["CORREO", "PLATAFORMA", "CORREO"] });
        expect(respuesta.status).toBe(201);
        expect(await respuesta.json()).toMatchObject({
            sensorId: humedad,
            terreno: { id: terrenoA, nombre: "Parcela A" },
            numeroSerie: "EST-1",
            etiqueta: "Humedad del suelo",
            unidad: "%",
            umbral: 25,
            condicion: "DESCIENDE",
            severidad: "ADVERTENCIA",
            canales: ["CORREO", "PLATAFORMA"],
            habilitado: true,
        });
    });

    test("[P-FUN-CU06] el umbral fuera del rango admisible del sensor se indica junto al campo", async () => {
        const fuera = await crearCriterio({ sensorId: humedad, umbral: 120, condicion: "SUPERA", canales: [] });
        expect(fuera.status).toBe(400);
        expect((await fuera.json()).error.campos).toEqual({ umbral: "Debe estar entre 0 y 100 %." });

        const frio = await crearCriterio({ sensorId: temperatura, umbral: -25, condicion: "DESCIENDE", canales: [] });
        expect((await frio.json()).error.campos.umbral).toBe("Debe estar entre -20 y 60 °C.");

        // Los extremos del rango son válidos.
        expect((await crearCriterio({ sensorId: humedad, umbral: 0, condicion: "DESCIENDE", canales: [] })).status).toBe(201);
        expect((await crearCriterio({ sensorId: humedad, umbral: 100, condicion: "SUPERA", canales: [] })).status).toBe(201);
    });

    test("[P-FUN-CU06] el umbral debe ser numérico", async () => {
        const respuesta = await crearCriterio({ sensorId: humedad, umbral: "veinte", condicion: "SUPERA", canales: [] });
        expect(respuesta.status).toBe(400);
        expect((await respuesta.json()).error.campos.umbral).toMatch(/número/);
    });

    test("[P-FUN-CU06] sin canales se puede guardar; un canal desconocido no", async () => {
        const sinCanales = await crearCriterio({ sensorId: temperatura, umbral: 0, condicion: "DESCIENDE" });
        expect(sinCanales.status).toBe(201);
        expect((await sinCanales.json()).canales).toEqual([]);

        const desconocido = await crearCriterio({ sensorId: temperatura, umbral: 0, condicion: "DESCIENDE", canales: ["TELEGRAM"] });
        expect(desconocido.status).toBe(400);
    });

    test("[P-FUN-CU06] muestra las últimas 5 lecturas del sensor, con su unidad y rango", async () => {
        const respuesta = await pedir(lecturas, { id: humedad });
        expect(respuesta.status).toBe(200);
        const cuerpo = await respuesta.json();
        expect(cuerpo).toMatchObject({ etiqueta: "Humedad del suelo", unidad: "%", rangoMinimo: 0, rangoMaximo: 100 });
        expect(cuerpo.lecturas.map((l: { valor: number }) => l.valor)).toEqual([30, 31, 32, 33, 34]);
        expect(cuerpo.lecturas[0].fecha).toBe(AHORA.toISOString());
    });

    test("[P-FUN-CU06] la lista se puede filtrar por terreno", async () => {
        await crearCriterio({ sensorId: sensorOtroTerreno, umbral: 20, condicion: "DESCIENDE", canales: [] });
        const todos = await (await pedir(listarCriterios)).json();
        const deB = await (await pedir(listarCriterios, { consulta: `?terrenoId=${terrenoB}` })).json();
        expect(deB.items.length).toBe(1);
        expect(deB.items[0].terreno.id).toBe(terrenoB);
        expect(todos.total).toBeGreaterThan(deB.total);
    });
});

describe("habilitar, deshabilitar y eliminar (RF06.4 y regla de §8.2)", () => {
    test("[P-FUN-CU06] deshabilitar resuelve la alerta vigente con «Criterio deshabilitado»; habilitar no evalúa hacia atrás", async () => {
        const { criterio, vigente, resuelta } = await criterioConAlertas();
        const antes = Date.now();

        const off = await pedir(habilitacion, { metodo: "PATCH", id: criterio.id, cuerpo: { habilitado: false } });
        expect(off.status).toBe(200);
        expect((await off.json()).habilitado).toBe(false);

        const alerta = filaAlerta(vigente);
        expect(alerta).toMatchObject({ estado: "RESUELTA", descripcion: "Criterio deshabilitado" });
        expect(alerta.fechaResolucion!.getTime()).toBeGreaterThanOrEqual(antes - 1000);
        // La alerta que ya estaba resuelta no cambia.
        expect(filaAlerta(resuelta)).toMatchObject({ estado: "RESUELTA", descripcion: null });

        const on = await pedir(habilitacion, { metodo: "PATCH", id: criterio.id, cuerpo: { habilitado: true } });
        expect((await on.json()).habilitado).toBe(true);
        // Volver a habilitar no crea ni reabre alertas: la evaluación sigue desde la siguiente lectura.
        expect(filaAlerta(vigente).estado).toBe("RESUELTA");
        expect(bd.select().from(alertas).where(eq(alertas.criterioId, criterio.id)).all()).toHaveLength(2);
    });

    test("[P-FUN-CU06] eliminar es lógico: conserva el criterio y sus alertas, y resuelve la vigente con «Criterio eliminado»", async () => {
        const { criterio, vigente } = await criterioConAlertas();

        const respuesta = await pedir(eliminar, { metodo: "DELETE", id: criterio.id });
        expect(respuesta.status).toBe(204);

        const fila = bd.select().from(criterios).where(eq(criterios.id, criterio.id)).get()!;
        expect(fila.fechaEliminacion).not.toBeNull();
        expect(filaAlerta(vigente)).toMatchObject({ estado: "RESUELTA", descripcion: "Criterio eliminado" });
        expect(bd.select().from(alertas).where(eq(alertas.criterioId, criterio.id)).all()).toHaveLength(2);

        // Ya no aparece en la lista ni se puede volver a modificar.
        const lista = await (await pedir(listarCriterios, { consulta: "?tamano=100" })).json();
        expect(lista.items.some((c: { id: number }) => c.id === criterio.id)).toBe(false);
        expect((await pedir(eliminar, { metodo: "DELETE", id: criterio.id })).status).toBe(404);
        expect((await pedir(habilitacion, { metodo: "PATCH", id: criterio.id, cuerpo: { habilitado: true } })).status).toBe(404);
    });
});

describe("lista de alertas e indicador de no leídas (RF06.10)", () => {
    test("[P-FUN-CU06] filtra por estado y por no leídas, y la cantidad baja al marcarlas como leídas", async () => {
        const { vigente } = await criterioConAlertas();
        const cantidad = async () => (await (await pedir(cantidadNoLeidas)).json()).cantidad as number;

        const vigentes = await (await pedir(listarAlertas, { consulta: "?estado=VIGENTE" })).json();
        expect(vigentes.items.every((a: { estado: string }) => a.estado === "VIGENTE")).toBe(true);
        expect(vigentes.items.map((a: { id: number }) => a.id)).toContain(vigente);
        expect(vigentes.items[0]).toMatchObject({ terreno: "Parcela A", numeroSerie: "EST-1", variable: "Humedad del suelo" });

        const antes = await cantidad();
        const noLeidas = await (await pedir(listarAlertas, { consulta: "?noLeidas=true&tamano=100" })).json();
        expect(noLeidas.total).toBe(antes);

        await pedir(marcarLeida, { metodo: "PATCH", id: vigente, cuerpo: { leida: true } });
        expect(await cantidad()).toBe(antes - 1);

        const deB = await (await pedir(listarAlertas, { consulta: `?terrenoId=${terrenoB}` })).json();
        expect(deB.total).toBe(0);
    });
});

describe("acceso", () => {
    test("[P-SEG-AISLAMIENTO] otro productor recibe 404 en sensores y criterios ajenos", async () => {
        const criterio = await (await crearCriterio({ sensorId: humedad, umbral: 50, condicion: "SUPERA", canales: [] })).json();
        expect((await pedir(lecturas, { id: humedad, token: jose })).status).toBe(404);
        expect((await crearCriterio({ sensorId: humedad, umbral: 50, condicion: "SUPERA", canales: [] }, jose)).status).toBe(404);
        expect((await pedir(habilitacion, { metodo: "PATCH", id: criterio.id, cuerpo: { habilitado: false }, token: jose })).status).toBe(404);
        expect((await pedir(eliminar, { metodo: "DELETE", id: criterio.id, token: jose })).status).toBe(404);
        expect(bd.select().from(criterios).where(eq(criterios.id, criterio.id)).get()).toMatchObject({ habilitado: true, fechaEliminacion: null });

        const suyos = await (await pedir(listarCriterios, { token: jose })).json();
        expect(suyos.total).toBe(0);
        expect((await (await pedir(cantidadNoLeidas, { token: jose })).json()).cantidad).toBe(0);
        // Y María tampoco puede usar el sensor de José.
        expect((await crearCriterio({ sensorId: sensorDeJose, umbral: 10, condicion: "SUPERA", canales: [] })).status).toBe(404);
    });

    test("[P-SEG-AISLAMIENTO] el administrador recibe 403 y sin sesión 401", async () => {
        expect((await pedir(listarCriterios, { token: admin })).status).toBe(403);
        expect((await pedir(listarAlertas, { token: admin })).status).toBe(403);
        expect((await pedir(listarCriterios, { token: null })).status).toBe(401);
    });
});
