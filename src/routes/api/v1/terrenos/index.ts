// GET / POST /api/v1/terrenos — PRODUCTOR. Listar mis terrenos / crear terreno + estación + sensores (RF02).
import type { APIEvent } from "@solidjs/start/server";
import { esquemaPaginacion } from "~/lib/esquemas/paginacion";
import { esquemaCrearTerreno } from "~/lib/esquemas/terrenos";
import { json, manejar } from "~/server/api/respuestas";
import { leerConsulta, leerCuerpo } from "~/server/api/validacion";
import { requireRol } from "~/server/auth/guardas";
import { obtenerBd } from "~/server/db/cliente";
import { crearTerreno, listarTerrenos } from "~/server/servicios/terrenos";

export const GET = manejar(async ({ request }: APIEvent) => {
    const bd = obtenerBd();
    const { cuenta } = await requireRol(request, ["PRODUCTOR"], bd);
    const { pagina, tamano } = leerConsulta(request.url, esquemaPaginacion);
    return json(listarTerrenos(bd, cuenta.id, pagina, tamano), 200, { "Cache-Control": "no-store" });
});

export const POST = manejar(async ({ request }: APIEvent) => {
    const bd = obtenerBd();
    const { cuenta } = await requireRol(request, ["PRODUCTOR"], bd);
    const datos = await leerCuerpo(request, esquemaCrearTerreno);
    return json(crearTerreno(bd, cuenta.id, datos), 201);
});
