// PATCH /api/v1/alertas/:id — PRODUCTOR dueño. { leida: true } (RF04.5). Una alerta ajena responde 404.
import type { APIEvent } from "@solidjs/start/server";
import { esquemaMarcarLeida } from "~/lib/esquemas/estado";
import { json, manejar } from "~/server/api/respuestas";
import { idDeRuta, leerCuerpo } from "~/server/api/validacion";
import { requireRol } from "~/server/auth/guardas";
import { obtenerBd } from "~/server/db/cliente";
import { marcarLeida } from "~/server/servicios/alertas";

export const PATCH = manejar(async ({ request, params }: APIEvent) => {
    const bd = obtenerBd();
    const { cuenta } = await requireRol(request, ["PRODUCTOR"], bd);
    const alertaId = idDeRuta(params.id);
    await leerCuerpo(request, esquemaMarcarLeida);
    return json(marcarLeida(bd, cuenta.id, alertaId));
});
