// Cookie de sesión (diseno.md §8.4). Solo servidor.
import { appUrl } from "~/server/config";

export const COOKIE_SESION = "lorax_sesion";

function atributos(maxAgeSegundos: number): string {
    const partes = ["Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAgeSegundos}`];
    if (appUrl().startsWith("https://")) partes.push("Secure");
    return partes.join("; ");
}

/** Encabezado Set-Cookie con el token; dura lo mismo que la sesión. */
export function cookieSesion(token: string, expira: Date, ahora = new Date()): string {
    const maxAge = Math.max(0, Math.floor((expira.getTime() - ahora.getTime()) / 1000));
    return `${COOKIE_SESION}=${token}; ${atributos(maxAge)}`;
}

/** Encabezado Set-Cookie que borra la cookie en el navegador. */
export function cookieBorrada(): string {
    return `${COOKIE_SESION}=; ${atributos(0)}`;
}

export function leerTokenDeSesion(request: Request): string | null {
    const cabecera = request.headers.get("cookie");
    if (!cabecera) return null;
    for (const par of cabecera.split(";")) {
        const [nombre, ...valor] = par.trim().split("=");
        if (nombre === COOKIE_SESION) return valor.join("=") || null;
    }
    return null;
}
