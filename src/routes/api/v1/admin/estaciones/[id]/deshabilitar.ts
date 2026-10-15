// POST /api/v1/admin/estaciones/:id/deshabilitar — ADMINISTRADOR. { motivo } obligatorio (RF07.6, RF07.8).
import type { APIEvent } from "@solidjs/start/server";
import { esquemaMotivo } from "~/lib/esquemas/admin";
import { json, manejar } from "~/server/api/respuestas";
import { idDeRuta, leerCuerpo } from "~/server/api/validacion";
import { requireRol } from "~/server/auth/guardas";
import { obtenerBd } from "~/server/db/cliente";
import { deshabilitarEstacion } from "~/server/servicios/admin";

export const POST = manejar(async ({ request, params }: APIEvent) => {
    const bd = obtenerBd();
    const { cuenta } = await requireRol(request, ["ADMINISTRADOR"], bd);
    const id = idDeRuta(params.id);
    const { motivo } = await leerCuerpo(request, esquemaMotivo);
    return json(deshabilitarEstacion(bd, cuenta.id, id, motivo));
});
