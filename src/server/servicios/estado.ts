// Estado del terreno para el panel (RF04, diseno.md §8.1). Todo el cálculo ocurre aquí.
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type {
    CriterioEstado,
    EstacionEstado,
    EstadoEstacion,
    EstadoTerreno,
    EstadoVariable,
    VariableEstado,
} from "~/lib/esquemas/estado";
import { variablePorTipo } from "~/lib/variables";
import type { BaseDatos } from "~/server/db/cliente";
import { criterios, estaciones, sensores } from "~/server/db/esquema";
import { alertasRecientes } from "./alertas";
import { terrenoPropio } from "./terrenos";

const MS_24_HORAS = 24 * 3_600_000;
const MS_30_MIN = 30 * 60_000;

type FilaSensor = typeof sensores.$inferSelect;

/** «Lectura reciente»: la última tiene 2 intervalos de medición o menos (§8.1). */
export function tieneLecturaReciente(sensor: Pick<FilaSensor, "fechaUltimaLectura" | "intervaloMedicion">, ahora: Date): boolean {
    if (!sensor.fechaUltimaLectura) return false;
    return ahora.getTime() - sensor.fechaUltimaLectura.getTime() <= 2 * sensor.intervaloMedicion * 1000;
}

export function incumple(criterio: { condicion: string; umbral: number }, valor: number): boolean {
    return criterio.condicion === "SUPERA" ? valor > criterio.umbral : valor < criterio.umbral;
}

/** Estado de una variable, en el orden de §8.1. */
export function estadoVariable(
    sensor: Pick<FilaSensor, "fechaUltimaLectura" | "intervaloMedicion">,
    valor: number | null,
    activos: Array<{ condicion: string; umbral: number }>,
    ahora: Date,
): EstadoVariable {
    if (!sensor.fechaUltimaLectura || valor === null) return "SIN_LECTURAS";
    if (!tieneLecturaReciente(sensor, ahora)) return "SIN_DATOS_RECIENTES";
    if (activos.length === 0) return "SIN_EVALUAR";
    if (activos.some((c) => incumple(c, valor))) return "FUERA_DE_RANGO";
    return "NORMAL";
}

/** Estado de una estación (§8.1): mismo umbral de «lectura reciente» que los sensores. */
export function estadoEstacion(habilitada: boolean, filas: FilaSensor[], ahora: Date): EstadoEstacion {
    if (!habilitada) return "DESHABILITADA";
    return filas.some((s) => tieneLecturaReciente(s, ahora)) ? "ACTIVA" : "SIN_DATOS_RECIENTES";
}

export function estadoTerreno(bd: BaseDatos, cuentaId: number, terrenoId: number, ahora = new Date()): EstadoTerreno {
    const terreno = terrenoPropio(bd, cuentaId, terrenoId);
    const filasEstaciones = bd.select().from(estaciones).where(eq(estaciones.terrenoId, terreno.id)).orderBy(asc(estaciones.id)).all();
    const idsEstaciones = filasEstaciones.map((e) => e.id);
    const filasSensores = idsEstaciones.length
        ? bd.select().from(sensores).where(inArray(sensores.estacionId, idsEstaciones)).orderBy(asc(sensores.id)).all()
        : [];
    const idsSensores = filasSensores.map((s) => s.id);
    const marcadores = idsSensores.map(() => "?").join(",");
    const sqlite = bd.$client;

    // Valor vigente: la medición cuya fecha coincide con la última lectura (usa el índice único).
    const ultimos = new Map<number, number>();
    const series = new Map<number, Array<{ t: number; v: number }>>();
    if (idsSensores.length) {
        const filas = sqlite
            .prepare(
                `SELECT m.sensor_id AS sensorId, m.valor FROM mediciones m
                 JOIN sensores s ON s.id = m.sensor_id AND m.fecha = s.fecha_ultima_lectura
                 WHERE s.id IN (${marcadores})`,
            )
            .all(...idsSensores) as Array<{ sensorId: number; valor: number }>;
        for (const f of filas) ultimos.set(f.sensorId, f.valor);

        // Serie de 24 h agregada a 30 min, en una sola consulta.
        const puntos = sqlite
            .prepare(
                `SELECT sensor_id AS sensorId, (fecha / ${MS_30_MIN}) * ${MS_30_MIN} AS t, round(avg(valor), 2) AS v
                 FROM mediciones
                 WHERE sensor_id IN (${marcadores}) AND fecha > ? AND fecha <= ?
                 GROUP BY sensor_id, fecha / ${MS_30_MIN}
                 ORDER BY sensor_id, t`,
            )
            .all(...idsSensores, ahora.getTime() - MS_24_HORAS, ahora.getTime()) as Array<{ sensorId: number; t: number; v: number }>;
        for (const p of puntos) {
            const serie = series.get(p.sensorId) ?? [];
            serie.push({ t: p.t, v: p.v });
            series.set(p.sensorId, serie);
        }
    }

    // Criterios activos: habilitados y no eliminados.
    const activosPorSensor = new Map<number, Array<typeof criterios.$inferSelect>>();
    if (idsSensores.length) {
        const filas = bd
            .select()
            .from(criterios)
            .where(and(inArray(criterios.sensorId, idsSensores), eq(criterios.habilitado, true), isNull(criterios.fechaEliminacion)))
            .orderBy(asc(criterios.id))
            .all();
        for (const c of filas) activosPorSensor.set(c.sensorId, [...(activosPorSensor.get(c.sensorId) ?? []), c]);
    }

    const estacionesEstado: EstacionEstado[] = filasEstaciones.map((estacion) => {
        const propios = filasSensores.filter((s) => s.estacionId === estacion.id);
        const variables: VariableEstado[] = propios.map((sensor) => {
            const valor = ultimos.get(sensor.id) ?? null;
            const activos = activosPorSensor.get(sensor.id) ?? [];
            const estado = estadoVariable(sensor, valor, activos, ahora);
            const detalle: CriterioEstado[] = activos.map((c) => ({
                id: c.id,
                condicion: c.condicion,
                umbral: c.umbral,
                severidad: c.severidad,
                // Solo cuenta si la lectura es reciente: un valor antiguo no se evalúa ni se destaca.
                incumplido: estado === "FUERA_DE_RANGO" && valor !== null && incumple(c, valor),
            }));
            return {
                sensorId: sensor.id,
                tipo: sensor.tipo,
                etiqueta: variablePorTipo(sensor.tipo)?.etiqueta ?? sensor.tipo,
                unidad: sensor.unidad,
                valor,
                fecha: sensor.fechaUltimaLectura?.toISOString() ?? null,
                estado,
                criterios: detalle,
                serie: series.get(sensor.id) ?? [],
            };
        });
        const ultima = Math.max(...propios.map((s) => s.fechaUltimaLectura?.getTime() ?? Number.NEGATIVE_INFINITY));
        return {
            id: estacion.id,
            numeroSerie: estacion.numeroSerie,
            tipo: estacion.tipo,
            modelo: estacion.modelo,
            estado: estadoEstacion(estacion.habilitada, propios, ahora),
            ultimaLectura: Number.isFinite(ultima) ? new Date(ultima).toISOString() : null,
            variables,
        };
    });

    return {
        terreno: {
            id: terreno.id,
            nombre: terreno.nombre,
            latitud: terreno.latitud,
            longitud: terreno.longitud,
            superficie: terreno.superficie,
            tipoCultivo: terreno.tipoCultivo,
        },
        generado: ahora.toISOString(),
        estaciones: estacionesEstado,
        alertas: alertasRecientes(bd, terreno.id),
    };
}
