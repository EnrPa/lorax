// POST /api/v1/auth/restablecer — público. { token, contrasena }: guarda la contraseña y revoca las sesiones.
import type { APIEvent } from "@solidjs/start/server";
import { esquemaRestablecer } from "~/lib/esquemas/auth";
import { manejar } from "~/server/api/respuestas";
import { leerCuerpo } from "~/server/api/validacion";
import { obtenerBd } from "~/server/db/cliente";
import { restablecerContrasena } from "~/server/servicios/recuperacion";

export const POST = manejar(async ({ request }: APIEvent) => {
    const { token, contrasena } = await leerCuerpo(request, esquemaRestablecer);
    await restablecerContrasena(obtenerBd(), token, contrasena);
    return new Response(null, { status: 204 });
});
