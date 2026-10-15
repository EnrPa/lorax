// GET /api/v1/terrenos/:id/estado — PRODUCTOR dueño. Datos del panel (RF04, diseno.md §8.1).
import type { APIEvent } from "@solidjs/start/server";
import { json, manejar } from "~/server/api/respuestas";
import { idDeRuta } from "~/server/api/validacion";
import { requireRol } from "~/server/auth/guardas";
import { obtenerBd } from "~/server/db/cliente";
import { estadoTerreno } from "~/server/servicios/estado";

export const GET = manejar(async ({ request, params }: APIEvent) => {
    const bd = obtenerBd();
    const { cuenta } = await requireRol(request, ["PRODUCTOR"], bd);
    return json(estadoTerreno(bd, cuenta.id, idDeRuta(params.id)), 200, { "Cache-Control": "no-store" });
});
