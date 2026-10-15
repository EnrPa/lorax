// POST /api/v1/ingesta — API key (X-Api-Key). Tramas del servidor de red LoRaWAN o del emulador (RF03, diseno.md §6).
import type { APIEvent } from "@solidjs/start/server";
import { json, manejar } from "~/server/api/respuestas";
import { obtenerBd } from "~/server/db/cliente";
import { recibirTrama } from "~/server/ingesta/ingesta";

export const POST = manejar(async ({ request }: APIEvent) => json(await recibirTrama(obtenerBd(), request), 200, { "Cache-Control": "no-store" }));
