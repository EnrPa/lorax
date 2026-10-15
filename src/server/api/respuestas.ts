// Respuestas JSON de la API REST (diseno.md §7). Solo servidor.
import { ErrorApi, type CuerpoError } from "./errores";

export function json(datos: unknown, estado = 200, encabezados?: HeadersInit): Response {
    return Response.json(datos, { status: estado, headers: encabezados });
}

export function responderError(error: unknown): Response {
    if (error instanceof ErrorApi) return json(error.cuerpo(), error.estado, error.encabezados);

    // Error inesperado: se registra en el servidor y el cliente recibe un mensaje genérico, sin detalles internos.
    console.error("[api] Error inesperado:", error);
    const cuerpo: CuerpoError = {
        error: { codigo: "INTERNO", mensaje: "Ocurrió un problema en el servidor. Intenta de nuevo en unos minutos." },
    };
    return json(cuerpo, 500);
}

/**
 * Envuelve un manejador de ruta: lo que lance se convierte en una respuesta con el formato de error de §7.
 * Uso: `export const GET = manejar(async (evento) => json(datos));`
 */
export function manejar<E>(handler: (evento: E) => Response | Promise<Response>): (evento: E) => Promise<Response> {
    return async (evento) => {
        try {
            return await handler(evento);
        } catch (error) {
            return responderError(error);
        }
    };
}
