// Historial de mediciones (RF05, diseno.md §8.3). Compartido por la pantalla y la API.
import { z } from "zod";
import { VARIABLES } from "~/lib/variables";

export const MENSAJE_RANGO_INVERTIDO = "La fecha inicial debe ser anterior a la final";
export const MENSAJE_RANGO_MAXIMO = "El periodo puede ser de hasta 1 año. Elige un rango más corto.";
/** 1 año = 366 días, para que el atajo «1 año» funcione también en años bisiestos (§8.3). */
export const RANGO_MAXIMO_MS = 366 * 24 * 3_600_000;

const TIPOS = VARIABLES.map((v) => v.tipo) as [string, ...string[]];

const instante = (mensaje: string) =>
    z.iso.datetime({ offset: true, error: mensaje }).transform((v) => new Date(v));

/** Parámetros de GET /mediciones/serie y /mediciones/exportar. */
export const esquemaConsultaHistorial = z
    .object({
        terrenoId: z.coerce.number({ error: "Elige un terreno." }).int().positive("Elige un terreno."),
        tipo: z.enum(TIPOS, { error: "Elige una variable de la lista." }),
        desde: instante("Indica la fecha inicial."),
        hasta: instante("Indica la fecha final."),
        compararDesde: instante("Indica cuándo empieza el periodo a comparar.").optional(),
    })
    .refine((d) => d.desde < d.hasta, { path: ["desde"], message: MENSAJE_RANGO_INVERTIDO })
    .refine((d) => d.hasta.getTime() - d.desde.getTime() <= RANGO_MAXIMO_MS, { path: ["hasta"], message: MENSAJE_RANGO_MAXIMO });

export type ConsultaHistorial = z.output<typeof esquemaConsultaHistorial>;

export interface PuntoHistorial {
    /** Inicio del intervalo (o instante de la medición, sin agregar), en ms. */
    t: number;
    /** Desfase desde el inicio de su periodo, en ms: alinea el periodo comparado. */
    desfase: number;
    promedio: number;
    minimo: number;
    maximo: number;
}

export interface SerieHistorial {
    estacionId: number;
    numeroSerie: string;
    puntos: PuntoHistorial[];
}

export interface PeriodoHistorial {
    desde: string;
    hasta: string;
    series: SerieHistorial[];
}

export interface RespuestaHistorial {
    terreno: { id: number; nombre: string };
    variable: { tipo: string; etiqueta: string; unidad: string };
    /** Intervalo de agregación; nulo si las mediciones van sin agregar. */
    intervalo: { etiqueta: string; ms: number } | null;
    /** Intervalo de medición usado para decidir la agregación (el menor de los sensores). */
    intervaloMedicionMs: number | null;
    periodo: PeriodoHistorial;
    comparacion: PeriodoHistorial | null;
}
