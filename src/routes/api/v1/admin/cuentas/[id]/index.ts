// GET / PATCH /api/v1/admin/cuentas/:id — ADMINISTRADOR. Detalle sin mediciones / datos generales (RF07.4, RF07.5).
import type { APIEvent } from "@solidjs/start/server";
import { esquemaActualizarCuenta } from "~/lib/esquemas/admin";
import { json, manejar } from "~/server/api/respuestas";
import { idDeRuta, leerCuerpo } from "~/server/api/validacion";
import { requireRol } from "~/server/auth/guardas";
import { obtenerBd } from "~/server/db/cliente";
import { actualizarCuenta, detalleCuenta } from "~/server/servicios/admin";

export const GET = manejar(async ({ request, params }: APIEvent) => {
    const bd = obtenerBd();
    await requireRol(request, ["ADMINISTRADOR"], bd);
    return json(detalleCuenta(bd, idDeRuta(params.id)), 200, { "Cache-Control": "no-store" });
});

export const PATCH = manejar(async ({ request, params }: APIEvent) => {
    const bd = obtenerBd();
    const { cuenta } = await requireRol(request, ["ADMINISTRADOR"], bd);
    const id = idDeRuta(params.id);
    return json(await actualizarCuenta(bd, cuenta.id, id, await leerCuerpo(request, esquemaActualizarCuenta)));
});
