// POST /api/v1/cuenta/contrasena — sesión. { actual, nueva }.
import type { APIEvent } from "@solidjs/start/server";
import { esquemaCambioContrasena } from "~/lib/esquemas/cuenta";
import { manejar } from "~/server/api/respuestas";
import { leerCuerpo } from "~/server/api/validacion";
import { requireSesion } from "~/server/auth/guardas";
import { obtenerBd } from "~/server/db/cliente";
import { cambiarContrasena } from "~/server/servicios/cuenta";

export const POST = manejar(async ({ request }: APIEvent) => {
    const bd = obtenerBd();
    const { cuenta } = await requireSesion(request, bd);
    const { actual, nueva } = await leerCuerpo(request, esquemaCambioContrasena);
    await cambiarContrasena(bd, cuenta.id, actual, nueva);
    return new Response(null, { status: 204 });
});
