// JWT de sesión, HS256 (diseno.md D3 y §8.4). Solo servidor.
import { jwtVerify, SignJWT } from "jose";
import type { Rol } from "~/lib/sesion";
import { ROLES } from "~/server/db/esquema";
import { secretoJwt } from "~/server/config";

export type { Rol };

export interface DatosToken {
    /** Id de la cuenta. */
    cuentaId: number;
    rol: Rol;
    /** Id de la fila de `sesiones`. */
    sesionId: number;
}

export async function firmarToken(datos: DatosToken, emitido: Date, expira: Date): Promise<string> {
    return new SignJWT({ rol: datos.rol, sid: datos.sesionId })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(String(datos.cuentaId))
        .setIssuedAt(Math.floor(emitido.getTime() / 1000))
        .setExpirationTime(Math.floor(expira.getTime() / 1000))
        .sign(secretoJwt());
}

/** Devuelve los datos si la firma y la expiración son válidas; si no, `null`. */
export async function verificarToken(token: string, ahora = new Date()): Promise<DatosToken | null> {
    try {
        const { payload } = await jwtVerify(token, secretoJwt(), { algorithms: ["HS256"], currentDate: ahora });
        const cuentaId = Number(payload.sub);
        const sesionId = Number(payload.sid);
        const rol = payload.rol as Rol;
        if (!Number.isInteger(cuentaId) || !Number.isInteger(sesionId) || !ROLES.includes(rol)) return null;
        return { cuentaId, rol, sesionId };
    } catch {
        return null;
    }
}
