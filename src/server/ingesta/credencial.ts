// Credencial del servidor de red LoRaWAN (RF03.1). Solo servidor.
import { createHash, timingSafeEqual } from "node:crypto";
import { apiKeyIngesta } from "~/server/config";

// Se comparan huellas de igual largo, así la comparación no revela el largo de la clave.
const huella = (valor: string) => createHash("sha256").update(valor).digest();

/** Compara en tiempo constante. Sin `INGESTA_API_KEY` configurada, ninguna clave es válida. */
export function apiKeyValida(recibida: string | null): boolean {
    const esperada = apiKeyIngesta();
    if (!esperada || !recibida) return false;
    return timingSafeEqual(huella(recibida), huella(esperada));
}
