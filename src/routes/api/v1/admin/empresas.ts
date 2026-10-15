// GET /api/v1/admin/empresas — ADMINISTRADOR. Para elegir una empresa existente al crear un productor.
import type { APIEvent } from "@solidjs/start/server";
import { json, manejar } from "~/server/api/respuestas";
import { requireRol } from "~/server/auth/guardas";
import { obtenerBd } from "~/server/db/cliente";
import { listarEmpresas } from "~/server/servicios/admin";

export const GET = manejar(async ({ request }: APIEvent) => {
    const bd = obtenerBd();
    await requireRol(request, ["ADMINISTRADOR"], bd);
    return json({ items: listarEmpresas(bd) }, 200, { "Cache-Control": "no-store" });
});
