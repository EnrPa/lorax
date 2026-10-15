// POST /api/v1/admin/cuentas/:id/habilitacion — ADMINISTRADOR. { habilitada, motivo }; al deshabilitar, revoca sesiones.
import type { APIEvent } from "@solidjs/start/server";
import { esquemaHabilitacionCuenta } from "~/lib/esquemas/admin";
import { json, manejar } from "~/server/api/respuestas";
import { idDeRuta, leerCuerpo } from "~/server/api/validacion";
import { requireRol } from "~/server/auth/guardas";
import { obtenerBd } from "~/server/db/cliente";
import { cambiarHabilitacionCuenta } from "~/server/servicios/admin";

export const POST = manejar(async ({ request, params }: APIEvent) => {
    const bd = obtenerBd();
    const { cuenta } = await requireRol(request, ["ADMINISTRADOR"], bd);
    const id = idDeRuta(params.id);
    return json(cambiarHabilitacionCuenta(bd, cuenta.id, id, await leerCuerpo(request, esquemaHabilitacionCuenta)));
});
