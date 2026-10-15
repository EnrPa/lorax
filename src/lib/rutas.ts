// Reglas de acceso a las páginas (diseno.md §8.4 y §9). Sin componentes: lo usan el middleware
// (servidor) y el menú (cliente). La autorización real la hace cada endpoint de la API.
import type { CuentaSesion, Rol } from "./sesion";

/** Páginas que no exigen sesión (RF01.8). */
export const RUTAS_PUBLICAS: readonly string[] = ["/login", "/restablecer"];

/**
 * Páginas que solo existen en desarrollo. Son públicas porque quien recupera su contraseña todavía
 * no tiene sesión; con NODE_ENV=production responden 404 (diseno.md §9).
 */
export const RUTAS_SOLO_DESARROLLO: readonly string[] = ["/dev/correos"];

/**
 * En el servidor manda NODE_ENV (se puede cambiar al ejecutar); en el navegador, el modo con que
 * se compiló la aplicación.
 */
export function modoDesarrollo(): boolean {
    if (typeof process !== "undefined" && process.env?.NODE_ENV) return process.env.NODE_ENV !== "production";
    return import.meta.env.DEV;
}

export function esRutaSoloDesarrollo(ruta: string): boolean {
    return RUTAS_SOLO_DESARROLLO.includes(ruta);
}

/** Roles que pueden ver cada página. Una ruta que no está aquí (la 404) admite cualquier sesión. */
export const ROLES_POR_RUTA: Record<string, readonly Rol[]> = {
    "/": ["PRODUCTOR"],
    "/historial": ["PRODUCTOR"],
    "/alertas": ["PRODUCTOR"],
    "/ajustes": ["PRODUCTOR", "ADMINISTRADOR"],
    "/admin": ["ADMINISTRADOR"],
};

export function esRutaPublica(ruta: string, desarrollo = modoDesarrollo()): boolean {
    return RUTAS_PUBLICAS.includes(ruta) || (desarrollo && esRutaSoloDesarrollo(ruta));
}

/** Página de inicio de cada rol (RF01.1). */
export function inicioDe(rol: Rol): string {
    return rol === "ADMINISTRADOR" ? "/admin" : "/";
}

export type AccesoPagina = { tipo: "permitir" } | { tipo: "redirigir"; destino: string } | { tipo: "no-encontrada" };

/** Decisión del middleware para una petición de página. */
export function accesoPagina(
    ruta: string,
    cuenta: Pick<CuentaSesion, "rol"> | null,
    desarrollo = modoDesarrollo(),
): AccesoPagina {
    // En producción, las páginas de desarrollo no existen, haya o no sesión.
    if (!desarrollo && esRutaSoloDesarrollo(ruta)) return { tipo: "no-encontrada" };
    const destino = redireccionPara(ruta, cuenta, desarrollo);
    return destino ? { tipo: "redirigir", destino } : { tipo: "permitir" };
}

/**
 * Adónde redirigir una petición de página, o `null` si puede verse:
 * - sin sesión, a `/login`;
 * - con sesión en `/login`, al inicio de su rol;
 * - en una página de otro rol, al inicio del propio (el productor en `/admin` va a `/`, y al revés).
 */
export function redireccionPara(
    ruta: string,
    cuenta: Pick<CuentaSesion, "rol"> | null,
    desarrollo = modoDesarrollo(),
): string | null {
    if (esRutaPublica(ruta, desarrollo)) {
        return cuenta && ruta === "/login" ? inicioDe(cuenta.rol) : null;
    }
    if (!cuenta) return "/login";

    const permitidos = ROLES_POR_RUTA[ruta];
    if (permitidos && !permitidos.includes(cuenta.rol)) return inicioDe(cuenta.rol);
    return null;
}
