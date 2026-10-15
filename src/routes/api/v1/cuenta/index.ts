// GET / PATCH /api/v1/cuenta — sesión. Perfil: solo se editan nombre, apellido y teléfono.
import type { APIEvent } from "@solidjs/start/server";
import { esquemaPerfil } from "~/lib/esquemas/cuenta";
import { json, manejar } from "~/server/api/respuestas";
import { leerCuerpo } from "~/server/api/validacion";
import { requireSesion } from "~/server/auth/guardas";
import { obtenerBd } from "~/server/db/cliente";
import { actualizarPerfil, obtenerPerfil } from "~/server/servicios/cuenta";

export const GET = manejar(async ({ request }: APIEvent) => {
    const bd = obtenerBd();
    const { cuenta } = await requireSesion(request, bd);
    return json(obtenerPerfil(bd, cuenta.id), 200, { "Cache-Control": "no-store" });
});

export const PATCH = manejar(async ({ request }: APIEvent) => {
    const bd = obtenerBd();
    const { cuenta } = await requireSesion(request, bd);
    const datos = await leerCuerpo(request, esquemaPerfil);
    return json(actualizarPerfil(bd, cuenta.id, datos));
});
