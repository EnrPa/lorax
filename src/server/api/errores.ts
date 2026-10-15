// Errores de la API REST (diseno.md §7). Solo servidor.
import { ESTADO_POR_CODIGO, type CamposError, type CodigoError, type CuerpoError } from "~/lib/errores-api";

export type { CamposError, CodigoError, CuerpoError };

/** Error esperado: se responde tal cual al cliente. Los mensajes dicen cómo corregir el problema. */
export class ErrorApi extends Error {
    constructor(
        readonly codigo: CodigoError,
        mensaje: string,
        readonly campos?: CamposError,
        /** Encabezados de la respuesta, p. ej. `Retry-After` en un 429. */
        readonly encabezados?: Record<string, string>,
    ) {
        super(mensaje);
        this.name = "ErrorApi";
    }

    get estado(): number {
        return ESTADO_POR_CODIGO[this.codigo];
    }

    cuerpo(): CuerpoError {
        return { error: { codigo: this.codigo, mensaje: this.message, ...(this.campos && { campos: this.campos }) } };
    }
}

export const noAutenticado = (mensaje = "Tu sesión no es válida o expiró. Inicia sesión nuevamente.") =>
    new ErrorApi("NO_AUTENTICADO", mensaje);

export const prohibido = (mensaje = "No tienes permiso para realizar esta acción.") => new ErrorApi("PROHIBIDO", mensaje);

export const noEncontrado = (mensaje = "No encontramos lo que buscas. Revisa que la dirección sea correcta.") =>
    new ErrorApi("NO_ENCONTRADO", mensaje);

export const conflicto = (mensaje: string, campos?: CamposError) => new ErrorApi("CONFLICTO", mensaje, campos);

export const validacion = (campos: CamposError, mensaje = "Revisa los campos marcados.") =>
    new ErrorApi("VALIDACION", mensaje, campos);

export const noProcesable = (mensaje: string, campos?: CamposError) => new ErrorApi("NO_PROCESABLE", mensaje, campos);

/** 429 con `Retry-After` en segundos (RF01.9). */
export const demasiadosIntentos = (mensaje: string, segundos: number) =>
    new ErrorApi("DEMASIADOS_INTENTOS", mensaje, undefined, { "Retry-After": String(segundos) });
