import type { APIEvent } from "@solidjs/start/server";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, test } from "vitest";
import type { EstadoTerreno, VariableEstado } from "~/lib/esquemas/estado";
import { PATCH as marcar } from "~/routes/api/v1/alertas/[id]";
import { GET as estado } from "~/routes/api/v1/terrenos/[id]/estado";
import { COOKIE_SESION } from "~/server/auth/cookie";
import { crearSesion } from "~/server/auth/sesiones";
import type { BaseDatos } from "~/server/db/cliente";
import { alertas, clientes, criterios, empresas, estaciones, mediciones, sensores, terrenos } from "~/server/db/esquema";
import { estadoTerreno } from "~/server/servicios/estado";
import { crearBdPrueba, crearCuenta, usarComoBdGlobal } from "./bd";

// Fecha fija: el resultado no depende del reloj.
const AHORA = new Date("2026-09-26T12:10:00Z");
const MIN = 60_000;
const hace = (minutos: number) => new Date(AHORA.getTime() - minutos * MIN);

let bd: BaseDatos;
let cuentaMaria: number;
let terrenoId: number;
let tokenMaria: string;
let tokenJose: string;
let tokenAdmin: string;
const sensor: Record<string, number> = {};
const alertaIds: number[] = [];

beforeAll(async () => {
    bd = crearBdPrueba();
    usarComoBdGlobal(bd);
    const maria = await crearCuenta(bd, { correo: "maria@ejemplo.cl", contrasena: null });
    cuentaMaria = maria.id;
    const jose = await crearCuenta(bd, { correo: "jose@ejemplo.cl", contrasena: null });
    const admin = await crearCuenta(bd, { correo: "admin@ejemplo.cl", rol: "ADMINISTRADOR", contrasena: null });
    const empresa = bd.insert(empresas).values({ nombre: "Agrícola", rut: "76.123.456-0" }).returning().get();
    const cliente = bd.insert(clientes).values({ empresaId: empresa.id, cuentaId: maria.id }).returning().get();
    const empresa2 = bd.insert(empresas).values({ nombre: "Hortalizas", rut: "77.234.567-4" }).returning().get();
    bd.insert(clientes).values({ empresaId: empresa2.id, cuentaId: jose.id }).run();
    tokenMaria = (await crearSesion(bd, maria, false)).token;
    tokenJose = (await crearSesion(bd, jose, false)).token;
    tokenAdmin = (await crearSesion(bd, admin, false)).token;

    terrenoId = bd
        .insert(terrenos)
        .values({ clienteId: cliente.id, nombre: "Parcela", latitud: -38.95, longitud: -72.62, fechaUltimaActualizacion: AHORA })
        .returning()
        .get().id;

    const estacion = (serie: string, habilitada = true) =>
        bd
            .insert(estaciones)
            .values({ terrenoId, tipo: "Estación", modelo: "LX", numeroSerie: serie, latitud: 0, longitud: 0, habilitada, fechaCreacion: AHORA, fechaUltimaActualizacion: AHORA })
            .returning()
            .get().id;

    /** Crea un sensor con lecturas en los minutos indicados (antes de AHORA). */
    const crearSensor = (clave: string, estacionId: number, tipo: string, codigo: string, lecturas: Array<[number, number]>) => {
        const id = bd
            .insert(sensores)
            .values({ estacionId, codigo, tipo, unidad: tipo.startsWith("temperatura") ? "°C" : "%", rangoMinimo: -20, rangoMaximo: 100, fechaCreacion: AHORA })
            .returning()
            .get().id;
        for (const [minutos, valor] of lecturas) {
            bd.insert(mediciones).values({ sensorId: id, valor, fecha: hace(minutos), payload: {} }).run();
        }
        const ultima = lecturas.length ? hace(Math.min(...lecturas.map(([m]) => m))) : null;
        bd.update(sensores).set({ fechaUltimaLectura: ultima }).where(eq(sensores.id, id)).run();
        sensor[clave] = id;
        return id;
    };

    const e1 = estacion("EST-1");
    // Serie para el promedio: dos lecturas por intervalo de 30 min durante 25 h (la más antigua queda fuera).
    const serie: Array<[number, number]> = [];
    for (let m = 10; m <= 25 * 60; m += 15) serie.push([m, 30 + (m % 30 === 10 ? 0 : 10)]);
    crearSensor("normal", e1, "humedad_suelo", "hum_suelo", serie);
    crearSensor("fuera", e1, "temperatura_aire", "temp_aire", [[5, -2]]);
    crearSensor("sinEvaluar", e1, "humedad_aire", "hum_aire", [[5, 70]]);
    crearSensor("antigua", e1, "nitrogeno", "n", [[31, 40]]);
    crearSensor("limite", e1, "fosforo", "p", [[30, 20]]);
    crearSensor("sinLecturas", e1, "potasio", "k", []);

    const e2 = estacion("EST-2");
    crearSensor("e2", e2, "humedad_suelo", "hum_suelo", [[120, 30]]);
    const e3 = estacion("EST-3", false);
    crearSensor("e3", e3, "humedad_suelo", "hum_suelo", [[5, 30]]);

    const criterio = (sensorId: number, datos: Partial<typeof criterios.$inferInsert> = {}) =>
        bd.insert(criterios).values({ sensorId, umbral: 25, condicion: "DESCIENDE", fechaCreacion: AHORA, ...datos }).returning().get().id;
    criterio(sensor.normal, { canales: "PLATAFORMA" });
    criterio(sensor.fuera, { umbral: 0, severidad: "CRITICA" });
    criterio(sensor.fuera, { umbral: 30, condicion: "SUPERA" }); // se cumple
    criterio(sensor.sinEvaluar, { habilitado: false });
    criterio(sensor.sinEvaluar, { fechaEliminacion: AHORA });
    criterio(sensor.antigua, { umbral: 50 }); // la lectura antigua lo incumpliría, pero no se evalúa

    // 12 alertas: 2 vigentes antiguas y 10 resueltas más recientes.
    const criterioAlertas = criterio(sensor.e2, { habilitado: false });
    const medicion = bd.select().from(mediciones).where(eq(mediciones.sensorId, sensor.e2)).get()!;
    const otroCriterio = criterio(sensor.e3, { habilitado: false });
    for (let i = 0; i < 12; i++) {
        const vigente = i < 2;
        alertaIds.push(
            bd
                .insert(alertas)
                .values({
                    medicionId: medicion.id,
                    criterioId: vigente ? (i === 0 ? criterioAlertas : otroCriterio) : criterioAlertas,
                    nombre: `Alerta ${i}`,
                    tipo: "ADVERTENCIA",
                    mensaje: `Mensaje ${i}`,
                    estado: vigente ? "VIGENTE" : "RESUELTA",
                    fecha: hace(vigente ? 5000 - i : 1000 - i * 10),
                    fechaResolucion: vigente ? null : hace(900 - i * 10),
                })
                .returning()
                .get().id,
        );
    }
});

function calcular(): EstadoTerreno {
    return estadoTerreno(bd, cuentaMaria, terrenoId, AHORA);
}

function variable(resultado: EstadoTerreno, clave: string): VariableEstado {
    for (const e of resultado.estaciones) {
        const v = e.variables.find((x) => x.sensorId === sensor[clave]);
        if (v) return v;
    }
    throw new Error(`sin variable ${clave}`);
}

const pedir = (handler: (e: APIEvent) => Promise<Response>, token: string | null, id: number, metodo = "GET", cuerpo?: unknown) =>
    handler({
        request: new Request(`http://localhost:3000/api/v1/x/${id}`, {
            method: metodo,
            headers: { "Content-Type": "application/json", ...(token ? { cookie: `${COOKIE_SESION}=${token}` } : {}) },
            body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
        }),
        params: { id: String(id) },
    } as unknown as APIEvent);

describe("estado de las variables (RF04.2, diseno.md §8.1)", () => {
    test("[P-FUN-CU04] NORMAL: lectura reciente que cumple sus criterios activos", () => {
        const v = variable(calcular(), "normal");
        expect(v).toMatchObject({ estado: "NORMAL", valor: 30, unidad: "%", etiqueta: "Humedad del suelo", fecha: hace(10).toISOString() });
        expect(v.criterios).toEqual([expect.objectContaining({ condicion: "DESCIENDE", umbral: 25, incumplido: false })]);
    });

    test("[P-FUN-CU04] FUERA_DE_RANGO: indica cuál criterio incumple", () => {
        const v = variable(calcular(), "fuera");
        expect(v.estado).toBe("FUERA_DE_RANGO");
        expect(v.criterios).toEqual([
            expect.objectContaining({ condicion: "DESCIENDE", umbral: 0, severidad: "CRITICA", incumplido: true }),
            expect.objectContaining({ condicion: "SUPERA", umbral: 30, incumplido: false }),
        ]);
    });

    test("[P-FUN-CU04] SIN_EVALUAR: lectura reciente sin criterios activos (deshabilitados y eliminados no cuentan)", () => {
        const v = variable(calcular(), "sinEvaluar");
        expect(v).toMatchObject({ estado: "SIN_EVALUAR", valor: 70, criterios: [] });
    });

    test("[P-FUN-CU04] SIN_DATOS_RECIENTES: más de 2 intervalos; el valor antiguo no se evalúa", () => {
        const v = variable(calcular(), "antigua");
        expect(v).toMatchObject({ estado: "SIN_DATOS_RECIENTES", fecha: hace(31).toISOString() });
        expect(v.criterios[0].incumplido).toBe(false);
    });

    test("[P-FUN-CU04] exactamente 2 intervalos todavía cuenta como lectura reciente", () => {
        expect(variable(calcular(), "limite").estado).toBe("SIN_EVALUAR");
    });

    test("[P-FUN-CU04] SIN_LECTURAS: el sensor nunca ha reportado", () => {
        expect(variable(calcular(), "sinLecturas")).toMatchObject({ estado: "SIN_LECTURAS", valor: null, fecha: null, serie: [] });
    });
});

describe("estado de las estaciones (RF04.4)", () => {
    test("[P-FUN-CU04] ACTIVA, SIN_DATOS_RECIENTES y DESHABILITADA", () => {
        const r = calcular();
        expect(r.estaciones.map((e) => [e.numeroSerie, e.estado])).toEqual([
            ["EST-1", "ACTIVA"],
            ["EST-2", "SIN_DATOS_RECIENTES"],
            ["EST-3", "DESHABILITADA"],
        ]);
        expect(r.estaciones[1].ultimaLectura).toBe(hace(120).toISOString());
    });
});

describe("serie de 24 h (RF04.3)", () => {
    test("[P-FUN-CU04] agrega a 30 minutos con el promedio y excluye lo anterior a 24 h", () => {
        const { serie } = variable(calcular(), "normal");
        const desde = AHORA.getTime() - 24 * 60 * MIN;
        expect(serie.length).toBeGreaterThanOrEqual(48);
        expect(serie.length).toBeLessThanOrEqual(49);
        for (const p of serie) {
            expect(p.t % (30 * MIN)).toBe(0);
            expect(p.t + 30 * MIN).toBeGreaterThan(desde);
        }
        // Cada intervalo completo tiene una lectura de 30 y otra de 40.
        expect(serie.slice(1, -1).every((p) => p.v === 35)).toBe(true);
        expect(serie.map((p) => p.t)).toEqual([...serie.map((p) => p.t)].sort((a, b) => a - b));
    });
});

describe("alertas recientes (RF04.5)", () => {
    test("[P-FUN-CU04] como máximo 10, las vigentes primero", () => {
        const { alertas: lista } = calcular();
        expect(lista).toHaveLength(10);
        expect(lista.slice(0, 2).map((a) => a.estado)).toEqual(["VIGENTE", "VIGENTE"]);
        expect(lista.slice(2).every((a) => a.estado === "RESUELTA")).toBe(true);
        const fechasResueltas = lista.slice(2).map((a) => a.fecha);
        expect(fechasResueltas).toEqual([...fechasResueltas].sort().reverse());
        expect(lista[0]).toMatchObject({ numeroSerie: expect.any(String), variable: "Humedad del suelo", leida: false });
    });

    test("[P-FUN-CU04] se puede marcar una alerta como leída", async () => {
        const respuesta = await pedir(marcar, tokenMaria, alertaIds[0], "PATCH", { leida: true });
        expect(respuesta.status).toBe(200);
        expect(await respuesta.json()).toMatchObject({ id: alertaIds[0], leida: true });
        expect(bd.select().from(alertas).where(eq(alertas.id, alertaIds[0])).get()!.leida).toBe(true);

        const invalido = await pedir(marcar, tokenMaria, alertaIds[1], "PATCH", { leida: false });
        expect(invalido.status).toBe(400);
    });
});

describe("acceso", () => {
    test("[P-FUN-CU04] la API entrega el estado a la dueña", async () => {
        const respuesta = await pedir(estado, tokenMaria, terrenoId);
        expect(respuesta.status).toBe(200);
        const cuerpo = await respuesta.json();
        expect(cuerpo.terreno).toMatchObject({ id: terrenoId, nombre: "Parcela" });
        expect(cuerpo.estaciones).toHaveLength(3);
    });

    test("[P-SEG-AISLAMIENTO] otro productor recibe 404 en el estado y al marcar una alerta ajena", async () => {
        expect((await pedir(estado, tokenJose, terrenoId)).status).toBe(404);
        expect((await pedir(marcar, tokenJose, alertaIds[2], "PATCH", { leida: true })).status).toBe(404);
        expect(bd.select().from(alertas).where(eq(alertas.id, alertaIds[2])).get()!.leida).toBe(false);
    });

    test("[P-SEG-AISLAMIENTO] el administrador recibe 403 y sin sesión 401", async () => {
        expect((await pedir(estado, tokenAdmin, terrenoId)).status).toBe(403);
        expect((await pedir(estado, null, terrenoId)).status).toBe(401);
    });
});
