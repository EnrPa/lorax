import type { APIEvent } from "@solidjs/start/server";
import { beforeAll, describe, expect, test } from "vitest";
import type { RespuestaHistorial } from "~/lib/esquemas/historial";
import { GET as exportar } from "~/routes/api/v1/mediciones/exportar";
import { GET as serie } from "~/routes/api/v1/mediciones/serie";
import { COOKIE_SESION } from "~/server/auth/cookie";
import { crearSesion } from "~/server/auth/sesiones";
import type { BaseDatos } from "~/server/db/cliente";
import { clientes, empresas, estaciones, sensores, terrenos } from "~/server/db/esquema";
import { elegirIntervalo } from "~/server/servicios/historial";
import { crearBdPrueba, crearCuenta, usarComoBdGlobal } from "./bd";

const AHORA = new Date("2026-09-26T12:00:00Z");
const MIN = 60_000;
const HORA = 60 * MIN;
const DIA = 24 * HORA;
const antes = (ms: number) => new Date(AHORA.getTime() - ms);

let bd: BaseDatos;
let terrenoId: number;
let terrenoIntervalos: number;
let maria: string;
let jose: string;
let admin: string;

beforeAll(async () => {
    bd = crearBdPrueba();
    usarComoBdGlobal(bd);
    const cuentaMaria = await crearCuenta(bd, { correo: "maria@ejemplo.cl", contrasena: null });
    const cuentaJose = await crearCuenta(bd, { correo: "jose@ejemplo.cl", contrasena: null });
    const cuentaAdmin = await crearCuenta(bd, { correo: "admin@ejemplo.cl", rol: "ADMINISTRADOR", contrasena: null });
    const empresa = bd.insert(empresas).values({ nombre: "E", rut: "76.123.456-0" }).returning().get();
    const cliente = bd.insert(clientes).values({ empresaId: empresa.id, cuentaId: cuentaMaria.id }).returning().get();
    const empresa2 = bd.insert(empresas).values({ nombre: "F", rut: "77.234.567-4" }).returning().get();
    bd.insert(clientes).values({ empresaId: empresa2.id, cuentaId: cuentaJose.id }).run();
    maria = (await crearSesion(bd, cuentaMaria, false)).token;
    jose = (await crearSesion(bd, cuentaJose, false)).token;
    admin = (await crearSesion(bd, cuentaAdmin, false)).token;

    const terreno = (nombre: string) =>
        bd.insert(terrenos).values({ clienteId: cliente.id, nombre, latitud: 0, longitud: 0, fechaUltimaActualizacion: AHORA }).returning().get().id;
    const estacion = (tId: number, serieNum: string) =>
        bd
            .insert(estaciones)
            .values({ terrenoId: tId, tipo: "E", modelo: "M", numeroSerie: serieNum, latitud: 0, longitud: 0, fechaCreacion: AHORA, fechaUltimaActualizacion: AHORA })
            .returning()
            .get().id;
    const sensor = (estacionId: number, tipo: string, codigo: string, unidad: string, intervalo = 900) =>
        bd
            .insert(sensores)
            .values({ estacionId, codigo, tipo, unidad, rangoMinimo: 0, rangoMaximo: 100, intervaloMedicion: intervalo, fechaCreacion: AHORA })
            .returning()
            .get().id;

    // Un nombre con «;» y comillas para probar el escape del CSV.
    terrenoId = terreno('Parcela "Sur"; Los Castaños');
    const sA = sensor(estacion(terrenoId, "EST-1"), "humedad_suelo", "hum_suelo", "%");
    const e2 = estacion(terrenoId, "EST-2");
    const sB = sensor(e2, "humedad_suelo", "hum_suelo", "%");
    sensor(estacion(terrenoId, "EST-3"), "temperatura_aire", "temp_aire", "°C"); // sin humedad del suelo

    // 400 días cada 15 min: EST-1 alterna 10 y 20 (todo intervalo completo: prom 15, mín 10, máx 20);
    // EST-2 vale 12,5 constante.
    const insertar = bd.$client.prepare("INSERT INTO mediciones (sensor_id, valor, fecha, payload) VALUES (?, ?, ?, '{}')");
    bd.$client.transaction(() => {
        const inicio = AHORA.getTime() - 400 * DIA;
        for (let i = 0, t = inicio; t <= AHORA.getTime(); i++, t += 15 * MIN) {
            insertar.run(sA, i % 2 === 0 ? 10 : 20, t);
            insertar.run(sB, 12.5, t);
        }
    })();

    // Terreno con intervalos distintos: 15 min y 5 min.
    terrenoIntervalos = terreno("Intervalos");
    sensor(estacion(terrenoIntervalos, "EST-4"), "humedad_suelo", "hum_suelo", "%", 900);
    sensor(estacion(terrenoIntervalos, "EST-5"), "humedad_suelo", "hum_suelo", "%", 300);
});

type Filtros = { terrenoId?: number; tipo?: string; desde?: Date | string; hasta?: Date | string; compararDesde?: Date };

function url(ruta: string, f: Filtros) {
    const p = new URLSearchParams();
    p.set("terrenoId", String(f.terrenoId ?? terrenoId));
    p.set("tipo", f.tipo ?? "humedad_suelo");
    const iso = (v: Date | string) => (typeof v === "string" ? v : v.toISOString());
    if (f.desde !== undefined) p.set("desde", iso(f.desde));
    if (f.hasta !== undefined) p.set("hasta", iso(f.hasta));
    if (f.compararDesde) p.set("compararDesde", f.compararDesde.toISOString());
    return `http://localhost:3000/api/v1/mediciones/${ruta}?${p}`;
}

function pedir(handler: (e: APIEvent) => Promise<Response>, ruta: string, f: Filtros, token: string | null = maria) {
    return handler({ request: new Request(url(ruta, f), { headers: token ? { cookie: `${COOKIE_SESION}=${token}` } : {} }) } as APIEvent);
}

async function consultar(f: Filtros): Promise<RespuestaHistorial> {
    const r = await pedir(serie, "serie", f);
    expect(r.status).toBe(200);
    return r.json();
}

describe("serie histórica (CU05)", () => {
    test("[P-FUN-CU05] rango válido de 24 h: mediciones sin agregar, una serie por estación con el sensor", async () => {
        const r = await consultar({ desde: antes(DIA), hasta: AHORA });
        expect(r.intervalo).toBeNull();
        expect(r.variable).toEqual({ tipo: "humedad_suelo", etiqueta: "Humedad del suelo", unidad: "%" });
        expect(r.periodo.series.map((s) => s.numeroSerie)).toEqual(["EST-1", "EST-2"]); // EST-3 no tiene el sensor
        // Semiabierto: incluye la lectura de `desde` y excluye la de `hasta`.
        const puntos = r.periodo.series[1].puntos;
        expect(puntos).toHaveLength(96);
        expect(puntos[0]).toEqual({ t: antes(DIA).getTime(), desfase: 0, promedio: 12.5, minimo: 12.5, maximo: 12.5 });
        expect(puntos.at(-1)!.t).toBe(AHORA.getTime() - 15 * MIN);
    });

    test("[P-FUN-CU05] rango invertido o igual responde 400 con el mensaje", async () => {
        for (const [desde, hasta] of [[AHORA, antes(DIA)], [AHORA, AHORA]]) {
            const r = await pedir(serie, "serie", { desde, hasta });
            expect(r.status).toBe(400);
            expect((await r.json()).error.campos.desde).toBe("La fecha inicial debe ser anterior a la final");
        }
    });

    test("[P-FUN-CU05] más de 1 año (366 días) responde 400", async () => {
        expect((await pedir(serie, "serie", { desde: antes(367 * DIA), hasta: AHORA })).status).toBe(400);
        expect((await pedir(serie, "serie", { desde: antes(366 * DIA), hasta: AHORA })).status).toBe(200);
    });

    test("[P-FUN-CU05] un periodo sin mediciones responde 200 con las series vacías", async () => {
        const r = await consultar({ desde: new Date("2020-01-01T00:00:00Z"), hasta: new Date("2020-01-02T00:00:00Z") });
        expect(r.periodo.series.map((s) => s.puntos.length)).toEqual([0, 0]);
    });

    test("[P-FUN-CU05] agrega en el menor intervalo que deja 500 puntos o menos", async () => {
        const casos: Array<[number, string | null, number]> = [
            [DIA, null, 96],
            [7 * DIA, "30 minutos", 336],
            [30 * DIA, "3 horas", 240],
            [366 * DIA, "1 día", 366],
        ];
        for (const [duracion, etiqueta, puntos] of casos) {
            const r = await consultar({ desde: antes(duracion), hasta: AHORA });
            expect(r.intervalo?.etiqueta ?? null, String(duracion / DIA)).toBe(etiqueta);
            expect(r.periodo.series[0].puntos).toHaveLength(puntos);
            expect(r.periodo.series[0].puntos.length).toBeLessThanOrEqual(500);
        }
    });

    test("[P-FUN-CU05] cada punto agregado trae promedio, mínimo y máximo, y los intervalos empiezan en `desde`", async () => {
        const desde = antes(30 * DIA);
        const r = await consultar({ desde, hasta: AHORA });
        const [a, b] = r.periodo.series;
        for (const p of a.puntos) {
            expect(p).toMatchObject({ promedio: 15, minimo: 10, maximo: 20 });
            expect((p.t - desde.getTime()) % (3 * HORA)).toBe(0);
        }
        expect(b.puntos.every((p) => p.promedio === 12.5)).toBe(true);
    });

    test("[P-FUN-CU05] si los sensores tienen intervalos distintos, se usa el menor", async () => {
        const r = await consultar({ terrenoId: terrenoIntervalos, desde: antes(3 * DIA), hasta: AHORA });
        expect(r.intervaloMedicionMs).toBe(5 * MIN);
        // 3 días / 15 min = 288 (sin agregar), pero 3 días / 5 min = 864 → 30 minutos.
        expect(r.intervalo?.etiqueta).toBe("30 minutos");
        expect(elegirIntervalo(3 * DIA, 15 * MIN)).toBeNull();
    });

    test("[P-FUN-CU05] la comparación dura lo mismo, usa el mismo intervalo y se alinea por desfase", async () => {
        const desde = antes(7 * DIA);
        const r = await consultar({ desde, hasta: AHORA, compararDesde: antes(14 * DIA) });
        expect(r.comparacion).not.toBeNull();
        expect(r.comparacion!.desde).toBe(antes(14 * DIA).toISOString());
        expect(r.comparacion!.hasta).toBe(desde.toISOString());
        const actual = r.periodo.series[0].puntos;
        const comparada = r.comparacion!.series[0].puntos;
        expect(comparada.map((p) => p.desfase)).toEqual(actual.map((p) => p.desfase));
        expect(comparada[0].t).toBe(antes(14 * DIA).getTime());
    });

    test("[P-FUN-CU05] una variable fuera del catálogo responde 400", async () => {
        expect((await pedir(serie, "serie", { tipo: "ph", desde: antes(DIA), hasta: AHORA })).status).toBe(400);
    });
});

describe("exportación a CSV (RF05.7)", () => {
    test("[P-FUN-CU05] UTF-8 con BOM, separador «;», coma decimal, hora de Chile y sin agregar", async () => {
        const desde = new Date("2026-09-25T03:00:00Z"); // 25-09 00:00 en Chile
        const hasta = new Date("2026-09-26T03:00:00Z");
        const r = await pedir(exportar, "exportar", { desde, hasta });
        expect(r.status).toBe(200);
        expect(r.headers.get("content-type")).toBe("text/csv; charset=utf-8");
        expect(r.headers.get("content-disposition")).toBe(
            'attachment; filename="historial_parcela-sur-los-castanos_humedad-suelo_2026-09-25_2026-09-25.csv"',
        );

        const bytes = new Uint8Array(await r.arrayBuffer());
        expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
        const lineas = new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes).replace(/^﻿/, "").trimEnd().split("\r\n");

        expect(lineas[0]).toBe("fecha_hora;terreno;estacion;variable;valor;unidad");
        // 24 h × 4 por hora × 2 estaciones, sin agregar.
        expect(lineas).toHaveLength(1 + 96 * 2);
        expect(lineas[1]).toBe('2026-09-25 00:00:00;"Parcela ""Sur""; Los Castaños";EST-1;Humedad del suelo;10;%');
        expect(lineas[2]).toBe('2026-09-25 00:00:00;"Parcela ""Sur""; Los Castaños";EST-2;Humedad del suelo;12,5;%');
        expect(lineas.at(-1)).toMatch(/^2026-09-25 23:45:00;/);
    });

    test("[P-FUN-CU05] un periodo largo sale completo, por lotes", async () => {
        const r = await pedir(exportar, "exportar", { desde: antes(60 * DIA), hasta: AHORA });
        const texto = await r.text();
        expect(texto.trimEnd().split("\r\n")).toHaveLength(1 + 60 * 96 * 2);
    });
});

describe("acceso", () => {
    test("[P-SEG-AISLAMIENTO] otro productor recibe 404; el administrador, 403; sin sesión, 401", async () => {
        const f = { desde: antes(DIA), hasta: AHORA };
        expect((await pedir(serie, "serie", f, jose)).status).toBe(404);
        expect((await pedir(exportar, "exportar", f, jose)).status).toBe(404);
        expect((await pedir(serie, "serie", f, admin)).status).toBe(403);
        expect((await pedir(serie, "serie", f, null)).status).toBe(401);
    });
});
