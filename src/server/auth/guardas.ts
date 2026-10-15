// Guardas de los endpoints: cada uno verifica sesión y rol en el servidor (nunca se confía en la interfaz).
import { noAutenticado, prohibido } from "~/server/api/errores";
import { obtenerBd, type BaseDatos } from "~/server/db/cliente";
import { eventos } from "~/server/db/esquema";
import { leerTokenDeSesion } from "./cookie";
import type { Rol } from "./jwt";
import { validarSesion, type SesionValida } from "./sesiones";

/** Devuelve la sesión válida de la solicitud o lanza 401 NO_AUTENTICADO. */
export async function requireSesion(request: Request, bd: BaseDatos = obtenerBd()): Promise<SesionValida> {
    const token = leerTokenDeSesion(request);
    const sesion = token ? await validarSesion(bd, token) : null;
    if (!sesion) throw noAutenticado();
    return sesion;
}

/**
 * Exige una sesión con alguno de los roles indicados. Si el rol no corresponde, registra un evento
 * ACCESO_DENEGADO (RF07.1) y lanza 403 PROHIBIDO.
 */
export async function requireRol(request: Request, roles: Rol[], bd: BaseDatos = obtenerBd()): Promise<SesionValida> {
    const sesion = await requireSesion(request, bd);
    if (!roles.includes(sesion.cuenta.rol)) {
        const { pathname } = new URL(request.url);
        bd.insert(eventos)
            .values({
                cuentaId: sesion.cuenta.id,
                tipo: "ACCESO_DENEGADO",
                detalle: { metodo: request.method, ruta: pathname, rol: sesion.cuenta.rol, rolesPermitidos: roles },
                fecha: new Date(),
            })
            .run();
        throw prohibido();
    }
    return sesion;
}
