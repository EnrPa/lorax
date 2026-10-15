// PATCH / DELETE /api/v1/criterios/:id — PRODUCTOR dueño. Habilitar o deshabilitar / eliminación lógica (RF06.4).
// Deshabilitar o eliminar resuelve la alerta vigente del criterio (diseno.md §8.2).
import type { APIEvent } from "@solidjs/start/server";
import { esquemaHabilitacion } from "~/lib/esquemas/criterios";
import { json, manejar } from "~/server/api/respuestas";
import { idDeRuta, leerCuerpo } from "~/server/api/validacion";
import { requireRol } from "~/server/auth/guardas";
import { obtenerBd } from "~/server/db/cliente";
import { cambiarHabilitacion, eliminarCriterio } from "~/server/servicios/criterios";

export const PATCH = manejar(async ({ request, params }: APIEvent) => {
    const bd = obtenerBd();
    const { cuenta } = await requireRol(request, ["PRODUCTOR"], bd);
    const id = idDeRuta(params.id);
    const { habilitado } = await leerCuerpo(request, esquemaHabilitacion);
    return json(cambiarHabilitacion(bd, cuenta.id, id, habilitado));
});

export const DELETE = manejar(async ({ request, params }: APIEvent) => {
    const bd = obtenerBd();
    const { cuenta } = await requireRol(request, ["PRODUCTOR"], bd);
    eliminarCriterio(bd, cuenta.id, idDeRuta(params.id));
    return new Response(null, { status: 204 });
});
