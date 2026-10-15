// Evaluación de criterios (RF06.5 a RF06.8, diseno.md §8.2). Solo servidor.
// Una sola implementación para la ingesta, la semilla y `db:al-dia`.
import { and, eq, inArray, isNull } from "drizzle-orm";
import { formatearValor } from "~/lib/formato";
import { variablePorCodigo } from "~/lib/variables";
import type { BaseDatos } from "~/server/db/cliente";
import { alertas, criterios, estaciones, notificaciones, sensores, terrenos } from "~/server/db/esquema";
import type { EvaluadorLecturas } from "~/server/ingesta/ingesta";
import { incumple } from "./estado";

type Transaccion = Parameters<Parameters<BaseDatos["transaction"]>[0]>[0];
type Bd = BaseDatos | Transaccion;

export interface CriterioEvaluable {
    id: number;
    condicion: "SUPERA" | "DESCIENDE";
    umbral: number;
    severidad: "ADVERTENCIA" | "CRITICA";
    canales: string[];
    terreno: string;
    numeroSerie: string;
    /** Id de la alerta vigente, si la hay. */
    vigente: number | null;
}

export interface OpcionesEvaluador {
    /**
     * Estado con que nacen las notificaciones. La ingesta las crea `PENDIENTE` y el despachador las
     * envía; la semilla y `db:al-dia` generan historia simulada y las marcan `ENVIADA` sin enviarlas (§10).
     */
    notificaciones: "PENDIENTE" | "ENVIADA";
}

/** Criterios habilitados y no eliminados de los sensores, con su alerta vigente, agrupados por sensor. */
export function cargarCriterios(bd: Bd, sensorIds: number[]): Map<number, CriterioEvaluable[]> {
    const porSensor = new Map<number, CriterioEvaluable[]>();
    if (!sensorIds.length) return porSensor;
    const filas = bd
        .select({
            criterio: criterios,
            terreno: terrenos.nombre,
            numeroSerie: estaciones.numeroSerie,
            vigente: alertas.id,
        })
        .from(criterios)
        .innerJoin(sensores, eq(sensores.id, criterios.sensorId))
        .innerJoin(estaciones, eq(estaciones.id, sensores.estacionId))
        .innerJoin(terrenos, eq(terrenos.id, estaciones.terrenoId))
        .leftJoin(alertas, and(eq(alertas.criterioId, criterios.id), eq(alertas.estado, "VIGENTE")))
        .where(and(inArray(criterios.sensorId, sensorIds), eq(criterios.habilitado, true), isNull(criterios.fechaEliminacion)))
        .orderBy(criterios.id)
        .all();
    for (const { criterio: c, terreno, numeroSerie, vigente } of filas) {
        const lista = porSensor.get(c.sensorId) ?? [];
        lista.push({
            id: c.id,
            condicion: c.condicion,
            umbral: c.umbral,
            severidad: c.severidad,
            canales: c.canales ? c.canales.split(",") : [],
            terreno,
            numeroSerie,
            vigente,
        });
        porSensor.set(c.sensorId, lista);
    }
    return porSensor;
}

/**
 * Evalúa una lectura contra un criterio (§8.2). Crea la alerta, con una notificación por canal, al
 * incumplir sin alerta vigente, y la resuelve al volver a cumplir. Actualiza `criterio.vigente`, así
 * que se puede evaluar una serie de lecturas en orden con los mismos objetos.
 */
export function crearEvaluador(bd: Bd, opciones: OpcionesEvaluador) {
    const enviadas = opciones.notificaciones === "ENVIADA";

    return function evaluar(criterio: CriterioEvaluable, codigo: string, valor: number, medicionId: number, ms: number): void {
        const incumplida = incumple(criterio, valor);
        if (incumplida && criterio.vigente === null) {
            const variable = variablePorCodigo(codigo)!;
            const sentido = criterio.condicion === "SUPERA" ? "sobre" : "bajo";
            const nombre = `${variable.etiqueta} ${sentido} el umbral`;
            const mensaje =
                `${nombre} en ${criterio.terreno} (${criterio.numeroSerie}): ` +
                `${formatearValor(valor, variable.unidad)} (umbral ${formatearValor(criterio.umbral, variable.unidad)})`;
            const fecha = new Date(ms);
            const alerta = bd
                .insert(alertas)
                .values({ medicionId, criterioId: criterio.id, nombre, tipo: criterio.severidad, mensaje, estado: "VIGENTE", leida: false, fecha })
                .returning({ id: alertas.id })
                .get();
            criterio.vigente = alerta.id;
            if (criterio.canales.length) {
                bd.insert(notificaciones)
                    .values(
                        criterio.canales.map((canal) => ({
                            alertaId: alerta.id,
                            canal: canal as (typeof notificaciones.$inferInsert)["canal"],
                            estado: opciones.notificaciones,
                            intentos: enviadas ? 1 : 0,
                            fechaUltimoIntento: enviadas ? fecha : null,
                        })),
                    )
                    .run();
            }
        } else if (!incumplida && criterio.vigente !== null) {
            bd.update(alertas).set({ estado: "RESUELTA", fechaResolucion: new Date(ms) }).where(eq(alertas.id, criterio.vigente)).run();
            criterio.vigente = null;
        }
    };
}

/** Evaluación de la ingesta: recibe solo lecturas nuevas y posteriores a la última de su sensor (§6). */
export const evaluarLecturasIngesta: EvaluadorLecturas = (tx, lecturas) => {
    const porSensor = cargarCriterios(tx, [...new Set(lecturas.map((l) => l.sensorId))]);
    const evaluar = crearEvaluador(tx, { notificaciones: "PENDIENTE" });
    for (const l of lecturas) {
        for (const criterio of porSensor.get(l.sensorId) ?? []) evaluar(criterio, l.codigo, l.valor, l.medicionId, l.fecha.getTime());
    }
};
