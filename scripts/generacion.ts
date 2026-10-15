// Piezas compartidas por la semilla y `db:al-dia`: ventanas de sequía, tramas y evaluación de criterios.
// La evaluación es la misma de la ingesta: vive en src/server/servicios/evaluacion.ts.
import { DIAS_DE_HISTORIA, INTERVALO_SEGUNDOS, SITUACIONES } from "./datos-piloto";
import type { Lecturas, Meta, VentanaSequia } from "./modelo-valores";

export const MS_HORA = 3_600_000;
export const MS_DIA = 24 * MS_HORA;
export const INTERVALO_MS = INTERVALO_SEGUNDOS * 1000;

/** La historia termina en la hora dada, redondeada hacia abajo al intervalo de medición. */
export function finDeHistoria(ahora: Date): Date {
    return new Date(Math.floor(ahora.getTime() / INTERVALO_MS) * INTERVALO_MS);
}

/** Primera medición de la semilla que termina en `fin`. */
export function inicioDeHistoria(fin: Date): Date {
    return new Date(fin.getTime() - DIAS_DE_HISTORIA * MS_DIA + INTERVALO_MS);
}

/** Episodios de sequía de la estación (solo EST-0001), relativos al fin de la semilla. */
export function ventanasDeSequia(numeroSerie: string, finSemilla: Date): VentanaSequia[] {
    const { sequias } = SITUACIONES;
    if (numeroSerie !== sequias.numeroSerie) return [];
    const haceDias = (dias: number) => finSemilla.getTime() - dias * MS_DIA;
    return sequias.episodios.map((e) => ({
        desde: haceDias(e.desdeDias),
        // El último episodio no tiene fin: la humedad del suelo sigue bajo el umbral.
        hasta: e.hastaDias === null ? null : haceDias(e.hastaDias),
    }));
}

/** Trama con el mismo formato que la ingesta (diseno.md §6); se guarda como `payload` de cada medición. */
export function tramaDe(numeroSerie: string, fecha: Date, valores: Lecturas, meta: Meta) {
    const lecturas = Object.entries(valores).map(([codigo, valor]) => ({ codigo, valor }));
    const payload = JSON.stringify({ numero_serie: numeroSerie, fecha: fecha.toISOString(), lecturas, meta });
    return { lecturas, payload };
}

export { cargarCriterios, crearEvaluador, type CriterioEvaluable } from "~/server/servicios/evaluacion";
