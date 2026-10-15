import type { APIEvent } from "@solidjs/start/server";
import { and, count, desc, eq } from "drizzle-orm";
import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, test, vi } from "vitest";
import { CRITERIOS_PILOTO, PRODUCTORES } from "../../scripts/datos-piloto";
import {
    CLAVE_INVALIDA,
    Emulador,
    enviar,
    ESTACION_DESCONOCIDA,
    ESTACION_HELADA,
    ESTACION_SEQUIA,
    leerEscenario,
    type Escenario,
} from "../../scripts/emulacion";
import { INTERVALO_MS } from "../../scripts/generacion";
import { sembrar } from "../../scripts/semilla";
import { POST as ingesta } from "~/routes/api/v1/ingesta";
import type { BaseDatos } from "~/server/db/cliente";
import { alertas, criterios, estaciones, eventos, mediciones, sensores } from "~/server/db/esquema";
import { crearBdPrueba, usarComoBdGlobal } from "./bd";

// Aceptación de T5.3: cada escenario del emulador produce la respuesta y el efecto esperados. Las
// tramas pasan por el endpoint de ingesta real, sobre la semilla de los datos piloto.

const CLAVE = process.env.INGESTA_API_KEY!;
const URL_APP = "http://localhost:3000";
const MARIA = PRODUCTORES[0];
const JOSE = PRODUCTORES[1];

let bd: BaseDatos;
let emulador: Emulador;
let carpetaCorreos: string;
let carpetaMensajes: string;
let segundos = 0;

/** El endpoint de ingesta en lugar de la red: mismo contrato, sin servidor. */
const fetchIngesta = ((url: string, init: RequestInit) =>
    ingesta({ request: new Request(url, init) } as unknown as APIEvent)) as unknown as typeof fetch;

/** Una ronda del escenario, con una fecha posterior a la anterior. */
async function ronda(escenario: Escenario) {
    const fecha = new Date(Date.now() + ++segundos * 1000);
    const resultados = [];
    for (const envio of emulador.ronda(escenario, fecha, CLAVE)) resultados.push(await enviar(envio, URL_APP, fetchIngesta));
    return { fecha, resultados };
}

function criterioPiloto(numeroSerie: string, codigo: string) {
    return bd
        .select({ id: criterios.id })
        .from(criterios)
        .innerJoin(sensores, eq(sensores.id, criterios.sensorId))
        .innerJoin(estaciones, eq(estaciones.id, sensores.estacionId))
        .where(and(eq(estaciones.numeroSerie, numeroSerie), eq(sensores.codigo, codigo)))
        .get()!.id;
}

const estadosDe = (criterioId: number) =>
    bd.select({ estado: alertas.estado }).from(alertas).where(eq(alertas.criterioId, criterioId)).orderBy(alertas.id).all().map((a) => a.estado);
const totalMediciones = () => bd.select({ n: count() }).from(mediciones).get()!.n;
const ultimoEvento = () => bd.select().from(eventos).orderBy(desc(eventos.id)).limit(1).get()!;
const archivos = (carpeta: string) =>
    readdirSync(carpeta).map((a) => JSON.parse(readFileSync(join(carpeta, a), "utf8")) as Record<string, string>);

beforeAll(async () => {
    bd = crearBdPrueba();
    await sembrar(bd);
    usarComoBdGlobal(bd);
    carpetaCorreos = mkdtempSync(join(tmpdir(), "lorax-correos-emulador-"));
    carpetaMensajes = mkdtempSync(join(tmpdir(), "lorax-mensajes-emulador-"));
    process.env.CORREOS_DIR = carpetaCorreos;
    process.env.MENSAJES_DIR = carpetaMensajes;
    vi.spyOn(console, "log").mockImplementation(() => {});
    emulador = new Emulador(new Date());
}, 60_000);

describe("[T5.3] Escenarios del emulador", () => {
    test("[T5.3] los nombres de escenario se validan", () => {
        expect(leerEscenario("silencio:EST-0003")).toEqual({ tipo: "silencio", numeroSerie: "EST-0003" });
        expect(() => leerEscenario("tormenta")).toThrow(/No conozco el escenario/);
        expect(() => leerEscenario("silencio:EST-9999")).toThrow(/datos piloto/);
        expect(() => leerEscenario("normal:EST-0001")).toThrow(/No conozco/);
    });

    test("[T5.3] «normal» nunca incumple los umbrales del piloto durante un día completo", () => {
        const otro = new Emulador(new Date());
        const inicio = Date.now();
        for (let i = 1; i <= 96; i++) {
            for (const envio of otro.ronda({ tipo: "normal" }, new Date(inicio + i * INTERVALO_MS), CLAVE)) {
                const trama = envio.trama as { lecturas: Array<{ codigo: string; valor: number }> };
                for (const c of CRITERIOS_PILOTO.filter((c) => c.numeroSerie === envio.numeroSerie)) {
                    const valor = trama.lecturas.find((l) => l.codigo === c.codigo)!.valor;
                    expect(c.condicion === "DESCIENDE" ? valor >= c.umbral : valor <= c.umbral, `${envio.numeroSerie} ${c.codigo} ${valor}`).toBe(true);
                }
            }
        }
    });

    test("[T5.3] normal: las 8 estaciones reportan, EST-0003 vuelve a estar al día y la alerta vigente de EST-0001 se resuelve", async () => {
        const humedad = criterioPiloto(ESTACION_SEQUIA, "hum_suelo");
        expect(estadosDe(humedad).at(-1)).toBe("VIGENTE");

        const { fecha, resultados } = await ronda({ tipo: "normal" });
        expect(resultados).toHaveLength(8);
        for (const r of resultados) expect(r).toMatchObject({ estado: 200, cuerpo: { aceptadas: 6, duplicadas: 0 } });

        const est3 = bd.select().from(sensores).innerJoin(estaciones, eq(estaciones.id, sensores.estacionId)).where(eq(estaciones.numeroSerie, "EST-0003")).all();
        for (const { sensores: s } of est3) expect(s.fechaUltimaLectura?.getTime()).toBe(fecha.getTime());
        expect(estadosDe(humedad).at(-1)).toBe("RESUELTA");
    });

    test("[T5.3] sequia: alerta nueva de humedad del suelo y correo a la productora; repetirla no la duplica", async () => {
        const humedad = criterioPiloto(ESTACION_SEQUIA, "hum_suelo");
        const correosAntes = archivos(carpetaCorreos).length;
        const { resultados } = await ronda({ tipo: "sequia" });
        for (const r of resultados) expect(r.estado).toBe(200);
        expect(estadosDe(humedad).at(-1)).toBe("VIGENTE");

        const correos = archivos(carpetaCorreos);
        expect(correos).toHaveLength(correosAntes + 1);
        expect(correos.find((c) => c.texto?.includes(ESTACION_SEQUIA))).toMatchObject({
            para: MARIA.correo,
            asunto: "Alerta LoRax: Humedad del suelo bajo el umbral",
        });

        const vigentes = estadosDe(humedad).length;
        await ronda({ tipo: "sequia" });
        expect(estadosDe(humedad)).toHaveLength(vigentes);
        expect(archivos(carpetaCorreos)).toHaveLength(correosAntes + 1);
    });

    test("[T5.3] helada: alerta crítica de temperatura, con correo y SMS simulado a José", async () => {
        const temperatura = criterioPiloto(ESTACION_HELADA, "temp_aire");
        const { resultados } = await ronda({ tipo: "helada" });
        for (const r of resultados) expect(r.estado).toBe(200);
        expect(estadosDe(temperatura).at(-1)).toBe("VIGENTE");
        const alerta = bd.select().from(alertas).where(eq(alertas.criterioId, temperatura)).orderBy(desc(alertas.id)).get()!;
        expect(alerta.tipo).toBe("CRITICA");

        expect(archivos(carpetaCorreos).some((c) => c.para === JOSE.correo && c.texto?.includes(ESTACION_HELADA))).toBe(true);
        expect(archivos(carpetaMensajes).some((m) => m.canal === "SMS" && m.para === JOSE.telefono && m.texto?.includes(ESTACION_HELADA))).toBe(true);
    });

    test("[T5.3] silencio:EST-0003: reportan todas menos esa estación", async () => {
        const { resultados } = await ronda({ tipo: "silencio", numeroSerie: "EST-0003" });
        expect(resultados.map((r) => r.numeroSerie)).not.toContain("EST-0003");
        expect(resultados).toHaveLength(7);
        for (const r of resultados) expect(r.estado).toBe(200);
    });

    test.each([
        ["malformada", 400, "ESTRUCTURA_INVALIDA"],
        ["desconocida", 422, "ESTACION_DESCONOCIDA"],
        ["credencial-invalida", 401, "CREDENCIAL_INVALIDA"],
    ] as const)("[T5.3] %s: responde %i, no guarda nada y registra el evento", async (nombre, estado, causa) => {
        const antes = totalMediciones();
        const { resultados } = await ronda(leerEscenario(nombre));
        expect(resultados).toHaveLength(1);
        expect(resultados[0]!.estado).toBe(estado);
        expect(totalMediciones()).toBe(antes);
        const evento = ultimoEvento();
        expect(evento.tipo).toBe("TRAMA_RECHAZADA");
        expect(evento.detalle).toMatchObject({ causa });
        // La API key del emulador nunca queda en el evento.
        expect(JSON.stringify(evento.detalle)).not.toContain(CLAVE);
        expect(JSON.stringify(evento.detalle)).not.toContain(CLAVE_INVALIDA);
        if (nombre === "desconocida") expect(evento.detalle).toMatchObject({ trama: { numero_serie: ESTACION_DESCONOCIDA } });
    });

    test("[T5.3] sin conexión: el resultado lo indica en vez de fallar", async () => {
        const sinRed = (() => Promise.reject(new TypeError("fetch failed"))) as unknown as typeof fetch;
        const [envio] = emulador.ronda({ tipo: "desconocida" }, new Date(Date.now() + ++segundos * 1000), CLAVE);
        expect(await enviar(envio!, URL_APP, sinRed)).toMatchObject({ estado: null, cuerpo: "fetch failed" });
    });
});
