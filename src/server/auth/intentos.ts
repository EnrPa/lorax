// Límite de intentos de inicio de sesión (RF01.9, diseno.md §8.4). Solo servidor.
// Los fallos se cuentan por el correo ingresado, exista o no la cuenta, a partir de los eventos
// ACCESO_FALLIDO: así el 429 no revela qué correos están registrados y no hace falta otra tabla.
import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";
import type { BaseDatos } from "~/server/db/cliente";
import { eventos } from "~/server/db/esquema";

export const MAX_FALLOS = 5;
export const VENTANA_MS = 15 * 60_000;
export const BLOQUEO_MS = 15 * 60_000;

/** Causas que cuentan como fallo. Un intento durante el bloqueo (INTENTOS_EXCEDIDOS) no cuenta. */
export type CausaFallo = "CREDENCIALES_INVALIDAS" | "CUENTA_DESHABILITADA";
const CAUSAS_QUE_CUENTAN: CausaFallo[] = ["CREDENCIALES_INVALIDAS", "CUENTA_DESHABILITADA"];

/**
 * Fin del bloqueo, o `null` si no hay. Con `MAX_FALLOS` fallos dentro de `VENTANA_MS`, el correo queda
 * bloqueado `BLOQUEO_MS` desde el último de ellos. `fallos` son instantes en ms, en orden ascendente.
 */
export function finDelBloqueo(fallos: number[], ahora: number): number | null {
    let fin: number | null = null;
    for (let i = MAX_FALLOS - 1; i < fallos.length; i++) {
        if (fallos[i]! - fallos[i - (MAX_FALLOS - 1)]! <= VENTANA_MS) fin = Math.max(fin ?? 0, fallos[i]! + BLOQUEO_MS);
    }
    return fin !== null && fin > ahora ? fin : null;
}

/** Fin del bloqueo del correo (en minúsculas), según sus fallos recientes. */
export function bloqueoDe(bd: BaseDatos, correo: string, ahora: Date): Date | null {
    // Solo importan los fallos que aún pueden formar una racha que bloquee hasta después de ahora.
    const desde = new Date(ahora.getTime() - VENTANA_MS - BLOQUEO_MS);
    const filas = bd
        .select({ fecha: eventos.fecha })
        .from(eventos)
        .where(
            and(
                eq(eventos.tipo, "ACCESO_FALLIDO"),
                gte(eventos.fecha, desde),
                eq(sql`json_extract(${eventos.detalle}, '$.correo')`, correo),
                inArray(sql`json_extract(${eventos.detalle}, '$.causa')`, CAUSAS_QUE_CUENTAN),
            ),
        )
        .orderBy(asc(eventos.fecha))
        .all();
    const fin = finDelBloqueo(
        filas.map((f) => f.fecha.getTime()),
        ahora.getTime(),
    );
    return fin === null ? null : new Date(fin);
}

/**
 * Registra un intento fallido. Sin responsable (`cuenta_id` nulo): puede venir de un tercero. Nunca
 * guarda la contraseña.
 */
export function registrarFallo(bd: BaseDatos, correo: string, causa: CausaFallo | "INTENTOS_EXCEDIDOS", ahora: Date) {
    bd.insert(eventos)
        .values({ tipo: "ACCESO_FALLIDO", detalle: { correo: correo.slice(0, 255), causa }, fecha: ahora })
        .run();
}

/** «Demasiados intentos. Vuelve a intentarlo en N minutos.» */
export function mensajeBloqueo(minutos: number): string {
    return `Demasiados intentos. Vuelve a intentarlo en ${minutos} ${minutos === 1 ? "minuto" : "minutos"}.`;
}
