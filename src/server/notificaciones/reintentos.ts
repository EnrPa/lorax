// Tarea periódica de notificaciones (RF06.9, diseno.md §8.5): cada 60 s despacha las pendientes y los
// reintentos cuya espera ya pasó. Solo servidor.
import { obtenerBd, type BaseDatos } from "~/server/db/cliente";
import { despacharNotificaciones } from "./despacho";

export const INTERVALO_REINTENTOS_MS = 60_000;

// Una sola tarea por proceso: la recarga en caliente no crea temporizadores duplicados.
const global = globalThis as typeof globalThis & { __loraxReintentos?: ReturnType<typeof setInterval> };

/** Inicia la tarea si no está corriendo. Devuelve `false` si ya lo estaba. */
export function iniciarReintentos(bd: () => BaseDatos = obtenerBd, intervalo = INTERVALO_REINTENTOS_MS): boolean {
    if (global.__loraxReintentos) return false;
    global.__loraxReintentos = setInterval(() => {
        // Un error en una ronda queda en el log; la tarea sigue con la siguiente.
        despacharNotificaciones(bd()).catch((error) => console.error("[notificaciones] Falló la ronda de reintentos:", error));
    }, intervalo);
    // No mantiene vivo el proceso por sí sola (scripts y pruebas pueden terminar).
    global.__loraxReintentos.unref?.();
    console.log(`[notificaciones] Tarea de reintentos iniciada (cada ${intervalo / 1000} s).`);
    return true;
}

export function detenerReintentos() {
    if (global.__loraxReintentos) clearInterval(global.__loraxReintentos);
    global.__loraxReintentos = undefined;
}
