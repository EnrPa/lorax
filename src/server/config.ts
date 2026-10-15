// Configuración leída del entorno (.env, ver .env.example). Solo servidor.
// Se lee en cada llamada para que las pruebas puedan cambiar las variables.

function numero(nombre: string, porDefecto: number): number {
    const valor = Number(process.env[nombre]);
    return Number.isFinite(valor) && valor > 0 ? valor : porDefecto;
}

export function secretoJwt(): Uint8Array {
    const secreto = process.env.JWT_SECRET;
    if (!secreto) throw new Error("Falta JWT_SECRET en .env (ver .env.example).");
    return new TextEncoder().encode(secreto);
}

export const sesionHoras = () => numero("SESION_HORAS", 8);
export const sesionRecordarDias = () => numero("SESION_RECORDAR_DIAS", 30);
export const appUrl = () => process.env.APP_URL || "http://localhost:3000";

/** Clave del encabezado `X-Api-Key` de la ingesta. Vacía: se rechaza toda trama. */
export const apiKeyIngesta = () => process.env.INGESTA_API_KEY || "";

/** Carpeta de los correos escritos a archivo (D6). `CORREOS_DIR` solo se usa en las pruebas. */
export const carpetaCorreos = () => process.env.CORREOS_DIR || "./data/correos";

/** Carpeta de los SMS y WhatsApp simulados (D6). `MENSAJES_DIR` solo se usa en las pruebas. */
export const carpetaMensajes = () => process.env.MENSAJES_DIR || "./data/mensajes";

/** Carpeta de los respaldos diarios (diseno.md §11). */
export const carpetaRespaldos = () => process.env.RESPALDOS_DIR || "./respaldos";

export const REMITENTE_CORREO = "LoRax <no-responder@lorax.local>";
