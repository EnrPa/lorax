// Sesiones revocables (diseno.md D3 y §8.4): el JWT va en la cookie y la tabla `sesiones` guarda su SHA-256.
import { and, eq, gt } from "drizzle-orm";
import { createHash, randomUUID } from "node:crypto";
import type { BaseDatos } from "~/server/db/cliente";
import { cuentas, sesiones } from "~/server/db/esquema";
import { sesionHoras, sesionRecordarDias } from "~/server/config";
import type { CuentaSesion } from "~/lib/sesion";
import { firmarToken, verificarToken, type Rol } from "./jwt";

const MS_HORA = 3_600_000;

export type { CuentaSesion };

export interface SesionValida {
    cuenta: CuentaSesion;
    sesionId: number;
    expira: Date;
}

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function duracionSesionMs(recordar: boolean): number {
    return recordar ? sesionRecordarDias() * 24 * MS_HORA : sesionHoras() * MS_HORA;
}

export async function crearSesion(
    bd: BaseDatos,
    cuenta: { id: number; rol: Rol },
    recordar: boolean,
    ahora = new Date(),
): Promise<{ token: string; expira: Date }> {
    const expira = new Date(ahora.getTime() + duracionSesionMs(recordar));

    // El JWT lleva el id de la sesión, así que primero se crea la fila con un hash provisional único.
    const fila = bd
        .insert(sesiones)
        .values({ cuentaId: cuenta.id, tokenHash: `provisional:${randomUUID()}`, fechaCreacion: ahora, fechaExpiracion: expira })
        .returning({ id: sesiones.id })
        .get();
    try {
        const token = await firmarToken({ cuentaId: cuenta.id, rol: cuenta.rol, sesionId: fila.id }, ahora, expira);
        bd.update(sesiones).set({ tokenHash: hashToken(token) }).where(eq(sesiones.id, fila.id)).run();
        return { token, expira };
    } catch (error) {
        bd.delete(sesiones).where(eq(sesiones.id, fila.id)).run();
        throw error;
    }
}

/**
 * Verifica, en este orden: firma y expiración del JWT; que la sesión exista con el mismo hash y no haya
 * vencido; y que la cuenta esté habilitada. Devuelve `null` si algo falla.
 */
export async function validarSesion(bd: BaseDatos, token: string, ahora = new Date()): Promise<SesionValida | null> {
    const datos = await verificarToken(token, ahora);
    if (!datos) return null;

    const fila = bd
        .select({
            sesionId: sesiones.id,
            expira: sesiones.fechaExpiracion,
            id: cuentas.id,
            nombre: cuentas.nombre,
            apellido: cuentas.apellido,
            correo: cuentas.correo,
            rol: cuentas.rol,
        })
        .from(sesiones)
        .innerJoin(cuentas, eq(cuentas.id, sesiones.cuentaId))
        .where(
            and(
                eq(sesiones.id, datos.sesionId),
                eq(sesiones.tokenHash, hashToken(token)),
                gt(sesiones.fechaExpiracion, ahora),
                eq(cuentas.id, datos.cuentaId),
                eq(cuentas.habilitada, true),
            ),
        )
        .get();
    if (!fila) return null;

    const { sesionId, expira, ...cuenta } = fila;
    return { cuenta, sesionId, expira };
}

/** Acepta la base o una transacción abierta. */
type BdOTransaccion = Pick<BaseDatos, "delete">;

export function revocarSesion(bd: BdOTransaccion, sesionId: number) {
    bd.delete(sesiones).where(eq(sesiones.id, sesionId)).run();
}

export function revocarSesionesDeCuenta(bd: BdOTransaccion, cuentaId: number) {
    bd.delete(sesiones).where(eq(sesiones.cuentaId, cuentaId)).run();
}
