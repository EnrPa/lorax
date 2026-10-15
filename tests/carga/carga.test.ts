import Database from "better-sqlite3";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { cpus, platform, release, tmpdir, totalmem } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { CONTRASENA_DEMO, PRODUCTORES } from "../../scripts/datos-piloto";
import { Emulador } from "../../scripts/emulacion";
import { ARCHIVO_CARGA } from "../../scripts/historico";
import type { RespuestaHistorial } from "~/lib/esquemas/historial";
import { diaChile } from "~/lib/fechas";
import { VARIABLES } from "~/lib/variables";
import { compilar, iniciarProduccion, type ServidorProduccion } from "../produccion";

// Pruebas de carga (diseno.md §11 y §12; RNF01 y RNF06), sobre la versión de producción y la base de
// `npm run historico -- --anios 4`. Trabajan sobre una copia de esa base, para que cada ejecución parta
// igual, y escriben el informe en evidencia/carga.json y evidencia/carga.md.

const P95_MAXIMO_MS = 3000; // RNF01
const PUERTO = 3202;
const COPIA = "./data/carga/prueba.db";
const CLAVE = "clave-solo-para-las-pruebas-de-carga-0123456789";
const MARIA = PRODUCTORES[0].correo;
const JOSE = PRODUCTORES[1].correo;
const DIA_MS = 24 * 3_600_000;

let servidor: ServidorProduccion;
const tiempos = new Map<string, number[]>();
const errores = new Map<string, number>();
let ingesta: { tramas: number; lecturas: number; perdidas: number; segundos: number } | null = null;
let planIndice = "";

/** Mide una petición hasta recibir el cuerpo completo; un código distinto de 2xx cuenta como error. */
async function medir(grupo: string, url: string, init?: RequestInit): Promise<Response> {
    const t0 = performance.now();
    const respuesta = await fetch(`${servidor.url}${url}`, init);
    const cuerpo = await respuesta.arrayBuffer();
    const ms = performance.now() - t0;
    tiempos.set(grupo, [...(tiempos.get(grupo) ?? []), ms]);
    if (!respuesta.ok) errores.set(grupo, (errores.get(grupo) ?? 0) + 1);
    return new Response(cuerpo, { status: respuesta.status, headers: respuesta.headers });
}

function percentil(lista: number[], p: number): number {
    const orden = [...lista].sort((a, b) => a - b);
    return orden[Math.max(0, Math.ceil((p / 100) * orden.length) - 1)] ?? 0;
}

const p95 = (grupo: string) => percentil(tiempos.get(grupo) ?? [], 95);

async function sesion(correo: string): Promise<string> {
    const respuesta = await fetch(`${servidor.url}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo, contrasena: CONTRASENA_DEMO, recordar: false }),
    });
    expect(respuesta.status).toBe(200);
    return respuesta.headers.get("set-cookie")!.split(";")[0]!;
}

async function terrenosDe(cookie: string): Promise<number[]> {
    const lista = (await (await fetch(`${servidor.url}/api/v1/terrenos`, { headers: { cookie } })).json()) as { items: Array<{ id: number }> };
    return lista.items.map((t) => t.id);
}

const serie = (terrenoId: number, tipo: string, dias: number) => {
    const hasta = new Date();
    const desde = new Date(hasta.getTime() - dias * DIA_MS);
    return `/api/v1/mediciones/serie?terrenoId=${terrenoId}&tipo=${tipo}&desde=${desde.toISOString()}&hasta=${hasta.toISOString()}`;
};

beforeAll(async () => {
    if (!existsSync(ARCHIVO_CARGA)) throw new Error(`Falta la base de carga ${ARCHIVO_CARGA}: ejecuta antes \`npm run historico -- --anios 4\`.`);
    for (const sufijo of ["", "-wal", "-shm"]) rmSync(COPIA + sufijo, { force: true });
    copyFileSync(ARCHIVO_CARGA, COPIA);

    // Sin el respaldo diario durante las mediciones: copiar 2 GB en plena prueba falsearía los tiempos.
    // La tarea encuentra un archivo con el nombre de hoy y no hace nada.
    const carpeta = mkdtempSync(join(tmpdir(), "lorax-carga-"));
    mkdirSync(join(carpeta, "respaldos"));
    writeFileSync(join(carpeta, "respaldos", `lorax-${diaChile(new Date())}.db`), "");

    compilar();
    servidor = await iniciarProduccion(PUERTO, {
        DB_ARCHIVO: COPIA,
        RESPALDOS_DIR: join(carpeta, "respaldos"),
        CORREOS_DIR: join(carpeta, "correos"),
        MENSAJES_DIR: join(carpeta, "mensajes"),
        JWT_SECRET: "secreto-solo-para-las-pruebas-de-carga-0123456789",
        INGESTA_API_KEY: CLAVE,
    });
});

afterAll(() => {
    servidor?.detener();
    escribirInforme();
    for (const sufijo of ["", "-wal", "-shm"]) rmSync(COPIA + sufijo, { force: true });
});

describe("[P-CAR] Carga con 4 años de datos (RNF01 y RNF06)", () => {
    test("[P-CAR-HISTORICO] el panel y el historial de 1 año responden en menos de 3 s (p95)", async () => {
        const maria = await sesion(MARIA);
        const jose = await sesion(JOSE);
        const terrenos = [...(await terrenosDe(maria)).map((id) => ({ id, cookie: maria })), ...(await terrenosDe(jose)).map((id) => ({ id, cookie: jose }))];
        expect(terrenos).toHaveLength(3);

        // Una consulta de calentamiento de cada tipo, que no se cuenta.
        await fetch(`${servidor.url}/api/v1/terrenos/${terrenos[0]!.id}/estado`, { headers: { cookie: maria } });
        await fetch(`${servidor.url}${serie(terrenos[0]!.id, "humedad_suelo", 365)}`, { headers: { cookie: maria } });

        for (let ronda = 0; ronda < 10; ronda++) {
            for (const t of terrenos) await medir("Panel de estado", `/api/v1/terrenos/${t.id}/estado`, { headers: { cookie: t.cookie } });
        }
        for (let ronda = 0; ronda < 5; ronda++) {
            for (const { tipo } of VARIABLES) {
                const res = await medir("Historial de 1 año", serie(terrenos[0]!.id, tipo, 365), { headers: { cookie: maria } });
                const cuerpo = (await res.json()) as RespuestaHistorial;
                expect(cuerpo.periodo.series).toHaveLength(4); // una por estación de la Parcela Los Castaños
                expect(cuerpo.intervalo?.ms).toBe(DIA_MS); // 1 año se agrega por día (§8.3)
            }
        }

        for (const grupo of ["Panel de estado", "Historial de 1 año"]) {
            expect(errores.get(grupo) ?? 0, grupo).toBe(0);
            expect(p95(grupo), `${grupo}: p95`).toBeLessThan(P95_MAXIMO_MS);
        }
    });

    test("[P-CAR-CONCURRENCIA] 20 usuarios simultáneos: sin errores y p95 menor que 3 s", async () => {
        const usuarios = [];
        for (let i = 0; i < 20; i++) {
            const cookie = await sesion(i % 2 === 0 ? MARIA : JOSE);
            usuarios.push({ cookie, terrenoId: (await terrenosDe(cookie))[0]! });
        }

        const GRUPO = "20 usuarios simultáneos";
        await Promise.all(
            usuarios.map(async ({ cookie, terrenoId }) => {
                const headers = { cookie };
                for (let ronda = 0; ronda < 5; ronda++) {
                    await medir(GRUPO, `/api/v1/terrenos/${terrenoId}/estado`, { headers });
                    await medir(GRUPO, serie(terrenoId, "temperatura_aire", 7), { headers });
                    await medir(GRUPO, serie(terrenoId, "humedad_suelo", 365), { headers });
                    await medir(GRUPO, `/api/v1/alertas?terrenoId=${terrenoId}`, { headers });
                }
            }),
        );
        expect(tiempos.get(GRUPO)).toHaveLength(20 * 5 * 4);
        expect(errores.get(GRUPO) ?? 0).toBe(0);
        expect(p95(GRUPO)).toBeLessThan(P95_MAXIMO_MS);
    });

    test("[P-CAR-INGESTA] 768 tramas (un día de las 8 estaciones), de a 10 en paralelo: cero pérdidas", async () => {
        const contar = () => {
            const bd = new Database(COPIA, { readonly: true });
            try {
                return (bd.prepare("SELECT count(*) AS n FROM mediciones").get() as { n: number }).n;
            } finally {
                bd.close();
            }
        };
        const antes = contar();

        // Un día de tramas, desfasadas 7 s de la grilla de 15 min para no coincidir con lecturas existentes.
        const inicio = Date.now() - DIA_MS;
        const emulador = new Emulador(new Date(inicio));
        const envios = [];
        for (let k = 0; k < 96; k++) envios.push(...emulador.ronda({ tipo: "normal" }, new Date(inicio + k * 15 * 60_000 + 7_000), CLAVE));
        expect(envios).toHaveLength(768);

        let aceptadas = 0;
        const t0 = performance.now();
        const pendientes = [...envios];
        await Promise.all(
            Array.from({ length: 10 }, async () => {
                for (let envio = pendientes.shift(); envio; envio = pendientes.shift()) {
                    const res = await medir("Ingesta (por trama)", "/api/v1/ingesta", {
                        method: "POST",
                        headers: { "Content-Type": "application/json", "X-Api-Key": envio.clave },
                        body: JSON.stringify(envio.trama),
                    });
                    if (res.ok) aceptadas += ((await res.json()) as { aceptadas: number }).aceptadas;
                }
            }),
        );
        const segundos = (performance.now() - t0) / 1000;

        const nuevas = contar() - antes;
        ingesta = { tramas: envios.length, lecturas: envios.length * 6, perdidas: envios.length * 6 - nuevas, segundos };
        expect(errores.get("Ingesta (por trama)") ?? 0).toBe(0);
        expect(aceptadas).toBe(768 * 6);
        expect(nuevas).toBe(768 * 6);
    });

    test("[P-CAR-HISTORICO] RNF06: las consultas por sensor y rango usan el índice único (sensor_id, fecha)", () => {
        const bd = new Database(COPIA, { readonly: true });
        try {
            // Misma forma que las consultas del historial (src/server/servicios/historial.ts).
            const plan = bd
                .prepare("EXPLAIN QUERY PLAN SELECT sensor_id, avg(valor) FROM mediciones WHERE sensor_id IN (1, 7) AND fecha >= ? AND fecha < ? GROUP BY sensor_id")
                .all(0, Date.now()) as Array<{ detail: string }>;
            planIndice = plan.map((p) => p.detail).join(" | ");
        } finally {
            bd.close();
        }
        expect(planIndice).toMatch(/USING (COVERING )?INDEX mediciones_sensor_fecha_unico/);
    });
});

function escribirInforme() {
    const base = new Database(ARCHIVO_CARGA, { readonly: true });
    const filas = (tabla: string) => (base.prepare(`SELECT count(*) AS n FROM ${tabla}`).get() as { n: number }).n;
    const rango = base.prepare("SELECT min(fecha) AS desde, max(fecha) AS hasta FROM mediciones").get() as { desde: number; hasta: number };
    const resumenBase = {
        archivo: ARCHIVO_CARGA,
        tamanoMB: Math.round(statSync(ARCHIVO_CARGA).size / 1024 / 1024),
        mediciones: filas("mediciones"),
        sensores: filas("sensores"),
        desde: new Date(rango.desde).toISOString(),
        hasta: new Date(rango.hasta).toISOString(),
    };
    base.close();

    const resultados = [...tiempos].map(([grupo, lista]) => ({
        grupo,
        consultas: lista.length,
        errores: errores.get(grupo) ?? 0,
        p50Ms: Math.round(percentil(lista, 50)),
        p95Ms: Math.round(percentil(lista, 95)),
        maxMs: Math.round(Math.max(...lista)),
    }));
    const informe = {
        fecha: new Date().toISOString(),
        equipo: { cpu: cpus()[0]?.model ?? "?", nucleos: cpus().length, memoriaGB: Math.round(totalmem() / 1024 ** 3), sistema: `${platform()} ${release()}`, node: process.version },
        base: resumenBase,
        umbralP95Ms: P95_MAXIMO_MS,
        resultados,
        ingesta: ingesta && { ...ingesta, segundos: Math.round(ingesta.segundos * 10) / 10, lecturasPorSegundo: Math.round(ingesta.lecturas / ingesta.segundos) },
        planIndice,
    };

    mkdirSync("evidencia", { recursive: true });
    writeFileSync("evidencia/carga.json", JSON.stringify(informe, null, 2) + "\n");
    const ms = (n: number) => `${n.toLocaleString("es-CL")} ms`;
    const md = [
        "# Pruebas de carga",
        "",
        `Generado por \`npm run test:carga\` (${new Date(informe.fecha).toLocaleString("es-CL", { timeZone: "America/Santiago" })}).`,
        "",
        "## Base de datos",
        "",
        `- Archivo: \`${resumenBase.archivo}\` (${resumenBase.tamanoMB.toLocaleString("es-CL")} MB).`,
        `- ${resumenBase.mediciones.toLocaleString("es-CL")} mediciones de ${resumenBase.sensores} sensores, del ${resumenBase.desde.slice(0, 10)} al ${resumenBase.hasta.slice(0, 10)}.`,
        `- Plan de consulta por sensor y rango: \`${planIndice}\`.`,
        "",
        "## Tiempos de respuesta (versión de producción)",
        "",
        `Umbral de RNF01: p95 menor que ${ms(P95_MAXIMO_MS)}.`,
        "",
        "| Grupo | Consultas | Errores | p50 | p95 | Máximo |",
        "|---|---|---|---|---|---|",
        ...resultados.map((r) => `| ${r.grupo} | ${r.consultas} | ${r.errores} | ${ms(r.p50Ms)} | ${ms(r.p95Ms)} | ${ms(r.maxMs)} |`),
        "",
        "## Ingesta",
        "",
        informe.ingesta
            ? `- ${informe.ingesta.tramas} tramas (${informe.ingesta.lecturas.toLocaleString("es-CL")} lecturas) de a 10 en paralelo, en ${informe.ingesta.segundos.toLocaleString("es-CL")} s (${informe.ingesta.lecturasPorSegundo.toLocaleString("es-CL")} lecturas por segundo). Lecturas perdidas: ${informe.ingesta.perdidas}.`
            : "- No se ejecutó.",
        "",
        "## Equipo",
        "",
        `- ${informe.equipo.cpu}, ${informe.equipo.nucleos} núcleos, ${informe.equipo.memoriaGB} GB de memoria; ${informe.equipo.sistema}; Node.js ${informe.equipo.node}.`,
        "",
    ].join("\n");
    writeFileSync("evidencia/carga.md", md);
}
