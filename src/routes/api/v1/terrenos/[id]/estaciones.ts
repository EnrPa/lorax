// POST /api/v1/terrenos/:id/estaciones — PRODUCTOR dueño. Agrega una estación con sus sensores (RF02.6).
import type { APIEvent } from "@solidjs/start/server";
import { esquemaEstacion } from "~/lib/esquemas/terrenos";
import { json, manejar } from "~/server/api/respuestas";
import { idDeRuta, leerCuerpo } from "~/server/api/validacion";
import { requireRol } from "~/server/auth/guardas";
import { obtenerBd } from "~/server/db/cliente";
import { agregarEstacion } from "~/server/servicios/terrenos";

export const POST = manejar(async ({ request, params }: APIEvent) => {
    const bd = obtenerBd();
    const { cuenta } = await requireRol(request, ["PRODUCTOR"], bd);
    const terrenoId = idDeRuta(params.id);
    const datos = await leerCuerpo(request, esquemaEstacion);
    return json(agregarEstacion(bd, cuenta.id, terrenoId, datos), 201);
});
