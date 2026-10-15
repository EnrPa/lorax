// Respuesta de GET /terrenos/:id/estado (diseno.md §8.1). La lógica vive en el servidor; la interfaz
// solo presenta estos datos.
import { z } from "zod";

export type EstadoVariable = "NORMAL" | "FUERA_DE_RANGO" | "SIN_DATOS_RECIENTES" | "SIN_EVALUAR" | "SIN_LECTURAS";
export type EstadoEstacion = "ACTIVA" | "SIN_DATOS_RECIENTES" | "DESHABILITADA";

export interface CriterioEstado {
    id: number;
    condicion: "SUPERA" | "DESCIENDE";
    umbral: number;
    severidad: "ADVERTENCIA" | "CRITICA";
    /** La última lectura lo incumple. */
    incumplido: boolean;
}

export interface VariableEstado {
    sensorId: number;
    tipo: string;
    etiqueta: string;
    unidad: string;
    valor: number | null;
    /** Fecha de la última lectura (ISO). */
    fecha: string | null;
    estado: EstadoVariable;
    /** Criterios activos (habilitados y no eliminados). */
    criterios: CriterioEstado[];
    /** Últimas 24 h agregadas a 30 min: `t` es el inicio del intervalo (ms) y `v` el promedio. */
    serie: Array<{ t: number; v: number }>;
}

export interface EstacionEstado {
    id: number;
    numeroSerie: string;
    tipo: string;
    modelo: string;
    estado: EstadoEstacion;
    ultimaLectura: string | null;
    variables: VariableEstado[];
}

export interface AlertaResumen {
    id: number;
    nombre: string;
    mensaje: string;
    severidad: string;
    estado: "VIGENTE" | "RESUELTA";
    leida: boolean;
    fecha: string;
    fechaResolucion: string | null;
    /** P. ej. «Criterio eliminado» cuando la alerta se resolvió por esa causa (§8.2). */
    descripcion: string | null;
    numeroSerie: string;
    terreno: string;
    variable: string;
}

export interface EstadoTerreno {
    terreno: { id: number; nombre: string; latitud: number; longitud: number; superficie: number | null; tipoCultivo: string | null };
    /** Instante del cálculo (ISO); la interfaz lo usa para las fechas relativas. */
    generado: string;
    estaciones: EstacionEstado[];
    /** Las 10 más recientes del terreno, vigentes primero. */
    alertas: AlertaResumen[];
}

/** PATCH /alertas/:id */
export const esquemaMarcarLeida = z.object({
    leida: z.literal(true, { error: "Solo se puede marcar la alerta como leída." }),
});
