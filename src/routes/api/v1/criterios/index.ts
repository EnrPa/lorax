// GET / POST /api/v1/criterios — PRODUCTOR. Listar mis umbrales (?terrenoId) / crear uno (RF06.1, RF06.2).
import type { APIEvent } from "@solidjs/start/server";
import { esquemaCriterio, esquemaListaCriterios } from "~/lib/esquemas/criterios";
import { json, manejar } from "~/server/api/respuestas";
import { leerConsulta, leerCuerpo } from "~/server/api/validacion";
import { requireRol } from "~/server/auth/guardas";
import { obtenerBd } from "~/server/db/cliente";
import { crearCriterio, listarCriterios } from "~/server/servicios/criterios";

export const GET = manejar(async ({ request }: APIEvent) => {
    const bd = obtenerBd();
    const { cuenta } = await requireRol(request, ["PRODUCTOR"], bd);
    return json(listarCriterios(bd, cuenta.id, leerConsulta(request.url, esquemaListaCriterios)), 200, { "Cache-Control": "no-store" });
});

export const POST = manejar(async ({ request }: APIEvent) => {
    const bd = obtenerBd();
    const { cuenta } = await requireRol(request, ["PRODUCTOR"], bd);
    return json(crearCriterio(bd, cuenta.id, await leerCuerpo(request, esquemaCriterio)), 201);
});
