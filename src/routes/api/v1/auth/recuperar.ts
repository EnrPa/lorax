// POST /api/v1/auth/recuperar — público. Siempre 202 con el mismo mensaje, exista o no la cuenta (RF01.5).
import type { APIEvent } from "@solidjs/start/server";
import { esquemaRecuperar, MENSAJE_RECUPERACION } from "~/lib/esquemas/auth";
import { json, manejar } from "~/server/api/respuestas";
import { leerCuerpo } from "~/server/api/validacion";
import { obtenerBd } from "~/server/db/cliente";
import { solicitarRecuperacion } from "~/server/servicios/recuperacion";

export const POST = manejar(async ({ request }: APIEvent) => {
    const { correo } = await leerCuerpo(request, esquemaRecuperar);
    await solicitarRecuperacion(obtenerBd(), correo);
    return json({ mensaje: MENSAJE_RECUPERACION }, 202);
});
