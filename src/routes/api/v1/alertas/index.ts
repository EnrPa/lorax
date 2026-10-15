// GET /api/v1/alertas — PRODUCTOR. ?terrenoId&estado&noLeidas (RF06.10).
import type { APIEvent } from "@solidjs/start/server";
import { esquemaListaAlertas } from "~/lib/esquemas/criterios";
import { json, manejar } from "~/server/api/respuestas";
import { leerConsulta } from "~/server/api/validacion";
import { requireRol } from "~/server/auth/guardas";
import { obtenerBd } from "~/server/db/cliente";
import { listarAlertas } from "~/server/servicios/alertas";

export const GET = manejar(async ({ request }: APIEvent) => {
    const bd = obtenerBd();
    const { cuenta } = await requireRol(request, ["PRODUCTOR"], bd);
    return json(listarAlertas(bd, cuenta.id, leerConsulta(request.url, esquemaListaAlertas)), 200, { "Cache-Control": "no-store" });
});
