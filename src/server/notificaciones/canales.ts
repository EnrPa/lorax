// Canales de notificación (RF06.6, diseno.md D6 y §8.5). Solo servidor.
// Plataforma y correo son reales (el correo se escribe a archivo); SMS y WhatsApp son simulados en
// data/mensajes/, con la misma interfaz que tendría un proveedor real.
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { appUrl, carpetaMensajes } from "~/server/config";
import { enviarCorreo } from "~/server/correo/correo";
import type { CANALES } from "~/server/db/esquema";

export type Canal = (typeof CANALES)[number];

export const ERROR_SIN_TELEFONO = "La cuenta no tiene teléfono registrado";
export const ERROR_FALLA_SIMULADA = "Falla simulada (NOTIF_SIMULAR_FALLO)";

/**
 * `NOTIF_SIMULAR_FALLO=CORREO,SMS`: esos canales fallan como falla pasajera, para probar los reintentos
 * (§8.5). Se lee en cada envío. `PLATAFORMA` no se simula: ese canal no envía nada.
 */
function simularFallo(canal: Canal) {
    const canales = (process.env.NOTIF_SIMULAR_FALLO ?? "").split(",").map((c) => c.trim().toUpperCase());
    if (canales.includes(canal)) throw new Error(ERROR_FALLA_SIMULADA);
}

/** Falla que no se arregla reintentando: se registra una vez y no se reintenta (§8.5). */
export class FallaPermanente extends Error {
    constructor(
        readonly causa: string,
        mensaje: string,
    ) {
        super(mensaje);
    }
}

export interface Aviso {
    canal: Canal;
    destinatario: { correo: string; telefono: string | null };
    alerta: { nombre: string; mensaje: string };
}

/** Envía el aviso por su canal. Lanza `FallaPermanente` o, ante una falla pasajera, cualquier otro error. */
export async function enviarAviso({ canal, destinatario, alerta }: Aviso, ahora: Date): Promise<void> {
    switch (canal) {
        case "PLATAFORMA":
            // La alerta ya está en la plataforma: aparece en el panel, en Alertas y en el indicador del menú.
            return;
        case "CORREO":
            simularFallo(canal);
            await enviarCorreo(
                {
                    para: destinatario.correo,
                    asunto: `Alerta LoRax: ${alerta.nombre}`,
                    texto: `${alerta.mensaje}.\n\nRevisa tus alertas en ${appUrl()}/alertas`,
                },
                ahora,
            );
            return;
        case "SMS":
        case "WHATSAPP":
            if (!destinatario.telefono) throw new FallaPermanente("SIN_TELEFONO", ERROR_SIN_TELEFONO);
            simularFallo(canal);
            await escribirMensaje(canal, destinatario.telefono, `LoRax: ${alerta.mensaje}.`, ahora);
            return;
    }
}

/** Mensaje simulado: un JSON por mensaje, como los correos de data/correos/. */
async function escribirMensaje(canal: "SMS" | "WHATSAPP", para: string, texto: string, ahora: Date) {
    const mensaje = { id: randomUUID(), fecha: ahora.toISOString(), canal, para, texto };
    const carpeta = carpetaMensajes();
    await mkdir(carpeta, { recursive: true });
    await writeFile(join(carpeta, `${mensaje.fecha.replace(/[:.]/g, "-")}_${mensaje.id}.json`), JSON.stringify(mensaje, null, 2), "utf8");
    console.log(`[${canal.toLowerCase()}] Mensaje simulado escrito en ${carpeta}`);
}
