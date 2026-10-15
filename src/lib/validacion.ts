// Validación con Zod compartida por cliente y servidor (diseno.md D4).
import { z } from "zod";
import type { CamposError } from "./errores-api";

// Respaldo en español para los mensajes que un esquema no defina.
z.config(z.locales.es());

/** Convierte los problemas de Zod en mensajes por campo; si un campo tiene varios, se queda con el primero. */
export function camposDeZod(error: z.ZodError): CamposError {
    const campos: CamposError = {};
    for (const problema of error.issues) {
        const ruta = problema.path.map(String).join(".") || "cuerpo";
        campos[ruta] ??= problema.message;
    }
    return campos;
}
