// Enlaces de recuperación y activación (diseno.md §8.4): 32 bytes aleatorios de un solo uso.
// Solo se guarda su SHA-256 en `tokens_recuperacion`.
import { and, eq, gt } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import type { BaseDatos } from "~/server/db/cliente";
import { tokensRecuperacion } from "~/server/db/esquema";
import { hashToken } from "./sesiones";

const MS_HORA = 3_600_000;

export type TipoEnlace = "RECUPERACION" | "ACTIVACION";

export const VIGENCIA_HORAS: Record<TipoEnlace, number> = { RECUPERACION: 1, ACTIVACION: 72 };

type BdOTransaccion = Pick<BaseDatos, "insert" | "update" | "select">;

/** Crea un enlace nuevo e invalida los anteriores no usados de la cuenta. Devuelve el token en claro. */
export function crearEnlace(bd: BdOTransaccion, cuentaId: number, tipo: TipoEnlace, ahora = new Date()): string {
    bd.update(tokensRecuperacion)
        .set({ utilizado: true })
        .where(and(eq(tokensRecuperacion.cuentaId, cuentaId), eq(tokensRecuperacion.utilizado, false)))
        .run();

    const token = randomBytes(32).toString("base64url");
    bd.insert(tokensRecuperacion)
        .values({
            cuentaId,
            tokenHash: hashToken(token),
            fechaCreacion: ahora,
            fechaExpiracion: new Date(ahora.getTime() + VIGENCIA_HORAS[tipo] * MS_HORA),
        })
        .run();
    return token;
}

/** Si el enlace es válido, lo marca como utilizado y devuelve la cuenta; si no, `null`. */
export function consumirEnlace(bd: BdOTransaccion, token: string, ahora = new Date()): number | null {
    const fila = bd
        .select({ id: tokensRecuperacion.id, cuentaId: tokensRecuperacion.cuentaId })
        .from(tokensRecuperacion)
        .where(
            and(
                eq(tokensRecuperacion.tokenHash, hashToken(token)),
                eq(tokensRecuperacion.utilizado, false),
                gt(tokensRecuperacion.fechaExpiracion, ahora),
            ),
        )
        .get();
    if (!fila) return null;

    bd.update(tokensRecuperacion).set({ utilizado: true }).where(eq(tokensRecuperacion.id, fila.id)).run();
    return fila.cuentaId;
}
