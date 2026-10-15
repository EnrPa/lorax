// GET /api/v1/auth/sesion — sesión. Devuelve { id, nombre, apellido, correo, rol }.
import type { APIEvent } from "@solidjs/start/server";
import { json, manejar } from "~/server/api/respuestas";
import { requireSesion } from "~/server/auth/guardas";

export const GET = manejar(async ({ request }: APIEvent) => {
    const { cuenta } = await requireSesion(request);
    return json(cuenta, 200, { "Cache-Control": "no-store" });
});
