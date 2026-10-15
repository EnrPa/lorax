// GET /api/v1/alertas/no-leidas/cantidad — PRODUCTOR. Para el indicador del menú (RF06.10).
import type { APIEvent } from "@solidjs/start/server";
import { json, manejar } from "~/server/api/respuestas";
import { requireRol } from "~/server/auth/guardas";
import { obtenerBd } from "~/server/db/cliente";
import { contarNoLeidas } from "~/server/servicios/alertas";

export const GET = manejar(async ({ request }: APIEvent) => {
    const bd = obtenerBd();
    const { cuenta } = await requireRol(request, ["PRODUCTOR"], bd);
    return json({ cantidad: contarNoLeidas(bd, cuenta.id) }, 200, { "Cache-Control": "no-store" });
});
