// Tarea del respaldo diario (RNF04, diseno.md §11): al arrancar y cada hora revisa si falta el respaldo
// del día. Así, un reinicio del servidor no se salta ningún día. Solo servidor.
import { obtenerBd, type BaseDatos } from "~/server/db/cliente";
import { crearRespaldo } from "./respaldo";

export const INTERVALO_RESPALDO_MS = 60 * 60_000;

// Una sola tarea por proceso: la recarga en caliente no crea temporizadores duplicados.
const global = globalThis as typeof globalThis & { __loraxRespaldos?: ReturnType<typeof setInterval> };

function ronda(bd: () => BaseDatos) {
    try {
        const { archivo, creado, eliminados } = crearRespaldo(bd());
        if (creado) console.log(`[respaldo] Respaldo del día creado: ${archivo}`);
        if (eliminados.length) console.log(`[respaldo] Retención de 30 días: se borraron ${eliminados.length} respaldos antiguos.`);
    } catch (error) {
        console.error("[respaldo] No se pudo crear el respaldo del día:", error);
    }
}

/** Inicia la tarea si no está corriendo. La primera revisión no bloquea la petición que la inicia. */
export function iniciarRespaldos(bd: () => BaseDatos = obtenerBd, intervalo = INTERVALO_RESPALDO_MS): boolean {
    if (global.__loraxRespaldos) return false;
    setImmediate(() => ronda(bd));
    global.__loraxRespaldos = setInterval(() => ronda(bd), intervalo);
    global.__loraxRespaldos.unref?.();
    return true;
}

export function detenerRespaldos() {
    if (global.__loraxRespaldos) clearInterval(global.__loraxRespaldos);
    global.__loraxRespaldos = undefined;
}
