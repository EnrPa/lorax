// Estado de salud del servicio (RNF04, diseno.md §7 y §11). Solo servidor.
import { sql } from "drizzle-orm";
import type { BaseDatos } from "~/server/db/cliente";
import { mediciones } from "~/server/db/esquema";
import { ERRORES_PERMANENTES, MAX_INTENTOS } from "~/server/notificaciones/despacho";
import { ultimoRespaldo } from "~/server/respaldos/respaldo";

export interface Salud {
    estado: "ok" | "error";
    bd: { ok: boolean; latenciaMs: number | null };
    /** Fecha de la medición más reciente, como aproximación de la última trama recibida. */
    ultimaIngesta: string | null;
    /**
     * `pendientes`: por enviar, incluidas las fallidas que aún se reintentarán. `fallidas`: las que ya no
     * se reintentan. Nulo si la base no responde.
     */
    notificaciones: { pendientes: number; fallidas: number } | null;
    /** Respaldo diario más reciente (§11), o nulo si no hay. */
    ultimoRespaldo: { fecha: string } | null;
}

function respaldo(): Salud["ultimoRespaldo"] {
    try {
        const ultimo = ultimoRespaldo();
        return ultimo ? { fecha: ultimo.fecha.toISOString() } : null;
    } catch (error) {
        console.error("[salud] No se pudo leer la carpeta de respaldos:", error);
        return null;
    }
}

export function consultarSalud(bd: BaseDatos): Salud {
    try {
        const t0 = performance.now();
        bd.$client.prepare("SELECT 1").get();
        const latenciaMs = Math.round((performance.now() - t0) * 100) / 100;

        // max(fecha) usa el índice único (sensor_id, fecha) sin recorrer la tabla completa.
        const fila = bd
            .select({ ultima: sql<number | null>`max(${mediciones.fecha})` })
            .from(mediciones)
            .get();
        const ultima = fila?.ultima ?? null;

        const permanentes = ERRORES_PERMANENTES.map(() => "?").join(", ");
        const n = bd.$client
            .prepare(
                `SELECT coalesce(sum(estado = 'PENDIENTE'), 0) AS pendientes,
                        coalesce(sum(estado = 'FALLIDA' AND intentos < ? AND coalesce(error, '') NOT IN (${permanentes})), 0) AS porReintentar,
                        coalesce(sum(estado = 'FALLIDA'), 0) AS fallidas
                 FROM notificaciones`,
            )
            .get(MAX_INTENTOS, ...ERRORES_PERMANENTES) as { pendientes: number; porReintentar: number; fallidas: number };

        return {
            estado: "ok",
            bd: { ok: true, latenciaMs },
            ultimaIngesta: ultima === null ? null : new Date(ultima).toISOString(),
            notificaciones: { pendientes: n.pendientes + n.porReintentar, fallidas: n.fallidas - n.porReintentar },
            ultimoRespaldo: respaldo(),
        };
    } catch (error) {
        console.error("[salud] La base de datos no responde:", error);
        return { estado: "error", bd: { ok: false, latenciaMs: null }, ultimaIngesta: null, notificaciones: null, ultimoRespaldo: respaldo() };
    }
}
