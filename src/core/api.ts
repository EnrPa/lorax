// Cliente de la API REST (/api/v1). Lo usan las páginas; nunca acceden a la base de datos.
import type { CamposError, CodigoError, CuerpoError } from "~/lib/errores-api";

export const BASE_API = "/api/v1";

/** Error devuelto por la API, con los mensajes por campo para mostrarlos junto a cada campo del formulario. */
export class ErrorCliente extends Error {
    constructor(
        readonly estado: number,
        readonly codigo: CodigoError,
        mensaje: string,
        readonly campos: CamposError = {},
    ) {
        super(mensaje);
        this.name = "ErrorCliente";
    }
}

type Metodo = "GET" | "POST" | "PATCH" | "DELETE";

function esCuerpoError(datos: unknown): datos is CuerpoError {
    return typeof datos === "object" && datos !== null && "error" in datos;
}

/** Sin sesión válida: se lleva al usuario a iniciar sesión (RF01.8). */
function irALogin() {
    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.assign("/login");
    }
}

async function solicitar<T>(metodo: Metodo, ruta: string, cuerpo?: unknown): Promise<T> {
    let respuesta: Response;
    try {
        respuesta = await fetch(BASE_API + ruta, {
            method: metodo,
            credentials: "same-origin",
            headers: {
                Accept: "application/json",
                ...(cuerpo !== undefined && { "Content-Type": "application/json" }),
            },
            body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
        });
    } catch {
        throw new ErrorCliente(0, "INTERNO", "No pudimos conectarnos. Revisa tu conexión a internet e intenta de nuevo.");
    }

    if (respuesta.status === 401) irALogin();

    const datos: unknown = respuesta.status === 204 ? null : await respuesta.json().catch(() => null);
    if (!respuesta.ok) {
        if (esCuerpoError(datos)) {
            const { codigo, mensaje, campos } = datos.error;
            throw new ErrorCliente(respuesta.status, codigo, mensaje, campos);
        }
        throw new ErrorCliente(respuesta.status, "INTERNO", "Ocurrió un problema en el servidor. Intenta de nuevo en unos minutos.");
    }
    return datos as T;
}

export const api = {
    get: <T>(ruta: string) => solicitar<T>("GET", ruta),
    post: <T>(ruta: string, cuerpo?: unknown) => solicitar<T>("POST", ruta, cuerpo ?? {}),
    patch: <T>(ruta: string, cuerpo: unknown) => solicitar<T>("PATCH", ruta, cuerpo),
    delete: <T>(ruta: string) => solicitar<T>("DELETE", ruta),
};
