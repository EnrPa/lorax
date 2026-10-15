// POST /api/v1/auth/login — público. { correo, contrasena, recordar } → cookie de sesión + { cuenta }.
import type { APIEvent } from "@solidjs/start/server";
import { esquemaLogin } from "~/lib/esquemas/auth";
import { json, manejar } from "~/server/api/respuestas";
import { leerCuerpo } from "~/server/api/validacion";
import { cookieSesion } from "~/server/auth/cookie";
import { obtenerBd } from "~/server/db/cliente";
import { iniciarSesion } from "~/server/servicios/autenticacion";

export const POST = manejar(async ({ request }: APIEvent) => {
    const datos = await leerCuerpo(request, esquemaLogin);
    const { cuenta, token, expira } = await iniciarSesion(obtenerBd(), datos);
    return json({ cuenta }, 200, { "Set-Cookie": cookieSesion(token, expira) });
});
