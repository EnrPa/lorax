// POST /api/v1/auth/logout — sesión. Revoca la sesión en el servidor (RF01.7) y borra la cookie.
import type { APIEvent } from "@solidjs/start/server";
import { manejar } from "~/server/api/respuestas";
import { cookieBorrada } from "~/server/auth/cookie";
import { requireSesion } from "~/server/auth/guardas";
import { revocarSesion } from "~/server/auth/sesiones";
import { obtenerBd } from "~/server/db/cliente";

export const POST = manejar(async ({ request }: APIEvent) => {
    const bd = obtenerBd();
    const { sesionId } = await requireSesion(request, bd);
    revocarSesion(bd, sesionId);
    return new Response(null, { status: 204, headers: { "Set-Cookie": cookieBorrada() } });
});
