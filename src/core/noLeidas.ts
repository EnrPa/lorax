// Cantidad de alertas no leídas para el indicador del menú (RF06.10). Solo se consulta desde el navegador.
import { createRoot, createSignal } from "solid-js";
import { api } from "~/core/api";

const [cantidad, setCantidad] = createRoot(() => createSignal<number | null>(null));

export const noLeidas = cantidad;

/** Vuelve a pedir la cantidad; lo llaman el menú (cada 60 s) y las pantallas al marcar alertas como leídas. */
export async function refrescarNoLeidas(): Promise<void> {
    try {
        setCantidad((await api.get<{ cantidad: number }>("/alertas/no-leidas/cantidad")).cantidad);
    } catch {
        // Sin conexión o sin sesión: se mantiene el último valor; el cliente de la API ya maneja el 401.
    }
}
