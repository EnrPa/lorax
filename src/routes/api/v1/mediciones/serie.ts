// GET /api/v1/mediciones/serie — PRODUCTOR dueño. ?terrenoId&tipo&desde&hasta[&compararDesde] (RF05, §8.3).
import type { APIEvent } from "@solidjs/start/server";
import { esquemaConsultaHistorial } from "~/lib/esquemas/historial";
import { json, manejar } from "~/server/api/respuestas";
import { leerConsulta } from "~/server/api/validacion";
import { requireRol } from "~/server/auth/guardas";
import { obtenerBd } from "~/server/db/cliente";
import { serieHistorica } from "~/server/servicios/historial";

export const GET = manejar(async ({ request }: APIEvent) => {
    const bd = obtenerBd();
    const { cuenta } = await requireRol(request, ["PRODUCTOR"], bd);
    const consulta = leerConsulta(request.url, esquemaConsultaHistorial);
    return json(serieHistorica(bd, cuenta.id, consulta), 200, { "Cache-Control": "no-store" });
});
