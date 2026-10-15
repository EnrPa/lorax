// GET /api/v1/sensores/:id/lecturas-recientes — PRODUCTOR dueño. Últimas 5 lecturas (RF06.1).
import type { APIEvent } from "@solidjs/start/server";
import { json, manejar } from "~/server/api/respuestas";
import { idDeRuta } from "~/server/api/validacion";
import { requireRol } from "~/server/auth/guardas";
import { obtenerBd } from "~/server/db/cliente";
import { lecturasRecientes } from "~/server/servicios/criterios";

export const GET = manejar(async ({ request, params }: APIEvent) => {
    const bd = obtenerBd();
    const { cuenta } = await requireRol(request, ["PRODUCTOR"], bd);
    return json(lecturasRecientes(bd, cuenta.id, idDeRuta(params.id)), 200, { "Cache-Control": "no-store" });
});
