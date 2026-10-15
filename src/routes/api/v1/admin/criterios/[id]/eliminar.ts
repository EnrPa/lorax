// POST /api/v1/admin/criterios/:id/eliminar — ADMINISTRADOR. { motivo } obligatorio; eliminación lógica (RF07.7, RF07.8).
import type { APIEvent } from "@solidjs/start/server";
import { esquemaMotivo } from "~/lib/esquemas/admin";
import { manejar } from "~/server/api/respuestas";
import { idDeRuta, leerCuerpo } from "~/server/api/validacion";
import { requireRol } from "~/server/auth/guardas";
import { obtenerBd } from "~/server/db/cliente";
import { eliminarCriterioAdmin } from "~/server/servicios/admin";

export const POST = manejar(async ({ request, params }: APIEvent) => {
    const bd = obtenerBd();
    const { cuenta } = await requireRol(request, ["ADMINISTRADOR"], bd);
    const id = idDeRuta(params.id);
    const { motivo } = await leerCuerpo(request, esquemaMotivo);
    eliminarCriterioAdmin(bd, cuenta.id, id, motivo);
    return new Response(null, { status: 204 });
});
