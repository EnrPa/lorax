// GET /api/v1/terrenos/:id — PRODUCTOR dueño. Detalle con estaciones y sensores; un terreno ajeno responde 404.
import type { APIEvent } from "@solidjs/start/server";
import { json, manejar } from "~/server/api/respuestas";
import { idDeRuta } from "~/server/api/validacion";
import { requireRol } from "~/server/auth/guardas";
import { obtenerBd } from "~/server/db/cliente";
import { obtenerTerreno } from "~/server/servicios/terrenos";

export const GET = manejar(async ({ request, params }: APIEvent) => {
    const bd = obtenerBd();
    const { cuenta } = await requireRol(request, ["PRODUCTOR"], bd);
    return json(obtenerTerreno(bd, cuenta.id, idDeRuta(params.id)), 200, { "Cache-Control": "no-store" });
});
