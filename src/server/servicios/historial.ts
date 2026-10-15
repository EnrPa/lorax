// Serie histórica y exportación a CSV (RF05, diseno.md §8.3). Solo servidor.
import { and, asc, eq } from "drizzle-orm";
import type { ConsultaHistorial, PeriodoHistorial, RespuestaHistorial, SerieHistorial } from "~/lib/esquemas/historial";
import { diaChile, fechaHoraChile } from "~/lib/fechas";
import { variablePorTipo } from "~/lib/variables";
import type { BaseDatos } from "~/server/db/cliente";
import { estaciones, sensores } from "~/server/db/esquema";
import { terrenoPropio } from "./terrenos";

const MIN = 60_000;
const HORA = 60 * MIN;
const DIA = 24 * HORA;

/** Intervalos de agregación de §8.3, de menor a mayor. */
export const INTERVALOS = [
    { etiqueta: "30 minutos", ms: 30 * MIN },
    { etiqueta: "1 hora", ms: HORA },
    { etiqueta: "3 horas", ms: 3 * HORA },
    { etiqueta: "6 horas", ms: 6 * HORA },
    { etiqueta: "12 horas", ms: 12 * HORA },
    { etiqueta: "1 día", ms: DIA },
    { etiqueta: "1 semana", ms: 7 * DIA },
] as const;

export const MAXIMO_PUNTOS = 500;

/**
 * Sin agregar si la serie estimada (duración / intervalo de medición) tiene 500 puntos o menos; si no,
 * el menor intervalo de la lista que no pase de 500 (§8.3).
 */
export function elegirIntervalo(duracionMs: number, intervaloMedicionMs: number) {
    if (Math.ceil(duracionMs / intervaloMedicionMs) <= MAXIMO_PUNTOS) return null;
    return INTERVALOS.find((i) => Math.ceil(duracionMs / i.ms) <= MAXIMO_PUNTOS) ?? INTERVALOS[INTERVALOS.length - 1];
}

/** Sensores del tipo pedido en las estaciones del terreno (una serie por estación). */
function sensoresDelTipo(bd: BaseDatos, terrenoId: number, tipo: string) {
    return bd
        .select({ sensorId: sensores.id, intervalo: sensores.intervaloMedicion, estacionId: estaciones.id, numeroSerie: estaciones.numeroSerie })
        .from(sensores)
        .innerJoin(estaciones, eq(estaciones.id, sensores.estacionId))
        .where(and(eq(estaciones.terrenoId, terrenoId), eq(sensores.tipo, tipo)))
        .orderBy(asc(estaciones.id))
        .all();
}

const redondear = (v: number) => Math.round(v * 100) / 100;

function periodo(
    bd: BaseDatos,
    lista: ReturnType<typeof sensoresDelTipo>,
    desde: Date,
    hasta: Date,
    intervaloMs: number | null,
): PeriodoHistorial {
    const series = new Map<number, SerieHistorial>(
        lista.map((s) => [s.sensorId, { estacionId: s.estacionId, numeroSerie: s.numeroSerie, puntos: [] }]),
    );
    if (lista.length > 0) {
        const ids = lista.map((s) => s.sensorId);
        const marcadores = ids.map(() => "?").join(",");
        const d = desde.getTime();
        const filas = (
            intervaloMs === null
                ? bd.$client
                      .prepare(
                          `SELECT sensor_id AS s, fecha AS t, valor AS p, valor AS mn, valor AS mx FROM mediciones
                           WHERE sensor_id IN (${marcadores}) AND fecha >= ? AND fecha < ?
                           ORDER BY sensor_id, fecha`,
                      )
                      .all(...ids, d, hasta.getTime())
                : // Los intervalos empiezan en `desde`, así ambos periodos de una comparación quedan alineados.
                  // CAST: better-sqlite3 envía los números como reales, y la división no truncaría.
                  bd.$client
                      .prepare(
                          `SELECT sensor_id AS s, ? + CAST((fecha - ?) / ? AS INTEGER) * ? AS t, avg(valor) AS p, min(valor) AS mn, max(valor) AS mx
                           FROM mediciones
                           WHERE sensor_id IN (${marcadores}) AND fecha >= ? AND fecha < ?
                           GROUP BY sensor_id, CAST((fecha - ?) / ? AS INTEGER)
                           ORDER BY sensor_id, t`,
                      )
                      .all(d, d, intervaloMs, intervaloMs, ...ids, d, hasta.getTime(), d, intervaloMs)
        ) as Array<{ s: number; t: number; p: number; mn: number; mx: number }>;

        for (const f of filas) {
            series.get(f.s)!.puntos.push({ t: f.t, desfase: f.t - d, promedio: redondear(f.p), minimo: f.mn, maximo: f.mx });
        }
    }
    return { desde: desde.toISOString(), hasta: hasta.toISOString(), series: [...series.values()] };
}

export function serieHistorica(bd: BaseDatos, cuentaId: number, consulta: ConsultaHistorial): RespuestaHistorial {
    const terreno = terrenoPropio(bd, cuentaId, consulta.terrenoId);
    const variable = variablePorTipo(consulta.tipo)!;
    const lista = sensoresDelTipo(bd, terreno.id, consulta.tipo);

    // Si los sensores tienen intervalos distintos, manda el menor (§8.3).
    const intervaloMedicionMs = lista.length ? Math.min(...lista.map((s) => s.intervalo)) * 1000 : null;
    const duracion = consulta.hasta.getTime() - consulta.desde.getTime();
    const intervalo = intervaloMedicionMs === null ? null : elegirIntervalo(duracion, intervaloMedicionMs);
    const ms = intervalo?.ms ?? null;

    return {
        terreno: { id: terreno.id, nombre: terreno.nombre },
        variable: { tipo: variable.tipo, etiqueta: variable.etiqueta, unidad: variable.unidad },
        intervalo: intervalo ? { etiqueta: intervalo.etiqueta, ms: intervalo.ms } : null,
        intervaloMedicionMs,
        periodo: periodo(bd, lista, consulta.desde, consulta.hasta, ms),
        comparacion: consulta.compararDesde
            ? periodo(bd, lista, consulta.compararDesde, new Date(consulta.compararDesde.getTime() + duracion), ms)
            : null,
    };
}

// ——— CSV ———

/** «Parcela Los Castaños» → «parcela-los-castanos»; «humedad_suelo» → «humedad-suelo». */
export function slug(texto: string): string {
    return texto
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

/** Campo de CSV: entre comillas si contiene `;`, comillas o saltos de línea. */
function campo(valor: string): string {
    return /[;"\r\n]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
}

const decimal = (v: number) => String(v).replace(".", ",");

export const ENCABEZADO_CSV = "fecha_hora;terreno;estacion;variable;valor;unidad";
const TAMANO_LOTE = 5000;

/**
 * CSV sin agregar, en streaming (§8.3). Se lee por lotes con un cursor (fecha, sensor) en vez de un
 * iterador abierto: better-sqlite3 no permite otras consultas en la conexión mientras un iterador vive,
 * y la descarga puede durar lo que tarde el navegador en leerla.
 */
export function exportarCsv(bd: BaseDatos, cuentaId: number, consulta: ConsultaHistorial): { nombre: string; cuerpo: ReadableStream<Uint8Array> } {
    const terreno = terrenoPropio(bd, cuentaId, consulta.terrenoId);
    const variable = variablePorTipo(consulta.tipo)!;
    const lista = sensoresDelTipo(bd, terreno.id, consulta.tipo);
    const serie = new Map(lista.map((s) => [s.sensorId, s.numeroSerie]));
    const ids = lista.map((s) => s.sensorId);

    const nombre =
        `historial_${slug(terreno.nombre)}_${slug(consulta.tipo)}_` +
        `${diaChile(consulta.desde)}_${diaChile(consulta.hasta.getTime() - 1)}.csv`;

    const lote =
        ids.length === 0
            ? null
            : bd.$client.prepare(
                  `SELECT sensor_id AS s, fecha AS f, valor AS v FROM mediciones
                   WHERE sensor_id IN (${ids.map(() => "?").join(",")}) AND fecha >= ? AND fecha < ?
                     AND (fecha > ? OR (fecha = ? AND sensor_id > ?))
                   ORDER BY fecha, sensor_id LIMIT ${TAMANO_LOTE}`,
              );

    const codificador = new TextEncoder();
    // Cursor: última (fecha, sensor) enviada. Empieza justo antes de `desde`.
    let cursor = { fecha: consulta.desde.getTime() - 1, sensor: 0 };
    let terminado = false;
    const fijos = `;${campo(terreno.nombre)}`;

    const cuerpo = new ReadableStream<Uint8Array>({
        start(controlador) {
            // BOM: Excel en Chile abre el archivo como UTF-8.
            controlador.enqueue(codificador.encode(`﻿${ENCABEZADO_CSV}\r\n`));
        },
        pull(controlador) {
            if (terminado || !lote) {
                controlador.close();
                return;
            }
            const filas = lote.all(...ids, consulta.desde.getTime(), consulta.hasta.getTime(), cursor.fecha, cursor.fecha, cursor.sensor) as Array<{
                s: number;
                f: number;
                v: number;
            }>;
            if (filas.length === 0) {
                terminado = true;
                controlador.close();
                return;
            }
            let texto = "";
            for (const r of filas) {
                texto += `${fechaHoraChile(r.f)}${fijos};${campo(serie.get(r.s)!)};${campo(variable.etiqueta)};${decimal(r.v)};${campo(variable.unidad)}\r\n`;
            }
            const ultima = filas[filas.length - 1];
            cursor = { fecha: ultima.f, sensor: ultima.s };
            if (filas.length < TAMANO_LOTE) terminado = true;
            controlador.enqueue(codificador.encode(texto));
        },
    });

    return { nombre, cuerpo };
}

