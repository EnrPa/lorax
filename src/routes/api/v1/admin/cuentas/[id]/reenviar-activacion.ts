// POST /api/v1/admin/cuentas/:id/reenviar-activacion — ADMINISTRADOR. Solo cuentas pendientes; si no, 409.
import type { APIEvent } from "@solidjs/start/server";
import { esquemaReenviar } from "~/lib/esquemas/admin";
import { manejar } from "~/server/api/respuestas";
import { idDeRuta, leerCuerpo } from "~/server/api/validacion";
import { requireRol } from "~/server/auth/guardas";
import { obtenerBd } from "~/server/db/cliente";
import { reenviarActivacion } from "~/server/servicios/admin";

export const POST = manejar(async ({ request, params }: APIEvent) => {
    const bd = obtenerBd();
    const { cuenta } = await requireRol(request, ["ADMINISTRADOR"], bd);
    const id = idDeRuta(params.id);
    const { motivo } = await leerCuerpo(request, esquemaReenviar);
    await reenviarActivacion(bd, cuenta.id, id, motivo);
    return new Response(null, { status: 204 });
});
