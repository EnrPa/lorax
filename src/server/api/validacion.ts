// Validación de entradas de la API con Zod (diseno.md D4). Solo servidor.
import type { z } from "zod";
import { camposDeZod } from "~/lib/validacion";
import { noEncontrado, validacion } from "./errores";

export { camposDeZod };

function validar<T extends z.ZodType>(esquema: T, datos: unknown): z.output<T> {
    const resultado = esquema.safeParse(datos);
    if (!resultado.success) throw validacion(camposDeZod(resultado.error));
    return resultado.data;
}

/** Lee y valida el cuerpo JSON de la solicitud. */
export async function leerCuerpo<T extends z.ZodType>(request: Request, esquema: T): Promise<z.output<T>> {
    let datos: unknown;
    try {
        datos = await request.json();
    } catch {
        throw validacion(
            { cuerpo: "El cuerpo de la solicitud no es JSON válido." },
            "El cuerpo de la solicitud no es JSON válido.",
        );
    }
    return validar(esquema, datos);
}

/** Valida los parámetros de la URL (`?pagina=1&tamano=20`). Usa `z.coerce` para los números y fechas. */
export function leerConsulta<T extends z.ZodType>(url: string | URL, esquema: T): z.output<T> {
    const parametros = Object.fromEntries(new URL(url).searchParams);
    return validar(esquema, parametros);
}

/** Id numérico de la ruta (`/terrenos/:id`). Uno inválido responde 404, igual que un recurso inexistente. */
export function idDeRuta(valor: string | undefined): number {
    const id = Number(valor);
    if (!Number.isSafeInteger(id) || id < 1) throw noEncontrado();
    return id;
}
