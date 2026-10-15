// Formato de error de la API REST (diseno.md §7). Compartido por cliente y servidor.

export const ESTADO_POR_CODIGO = {
    NO_AUTENTICADO: 401,
    PROHIBIDO: 403,
    NO_ENCONTRADO: 404,
    CONFLICTO: 409,
    VALIDACION: 400,
    NO_PROCESABLE: 422,
    DEMASIADOS_INTENTOS: 429,
    INTERNO: 500,
} as const;

export type CodigoError = keyof typeof ESTADO_POR_CODIGO;

/** Mensajes por campo, indexados por ruta: `{ "estacion.numeroSerie": "Ya existe…" }`. */
export type CamposError = Record<string, string>;

export interface CuerpoError {
    error: { codigo: CodigoError; mensaje: string; campos?: CamposError };
}
