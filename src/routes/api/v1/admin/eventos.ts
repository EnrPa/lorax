// GET /api/v1/admin/eventos — ADMINISTRADOR. ?tipo&desde&hasta (RF07.10).
import type { APIEvent } from "@solidjs/start/server";
import { esquemaListaEventos } from "~/lib/esquemas/admin";
import { json, manejar } from "~/server/api/respuestas";
import { leerConsulta } from "~/server/api/validacion";
import { requireRol } from "~/server/auth/guardas";
import { obtenerBd } from "~/server/db/cliente";
import { listarEventos } from "~/server/servicios/admin";

export const GET = manejar(async ({ request }: APIEvent) => {
    const bd = obtenerBd();
    await requireRol(request, ["ADMINISTRADOR"], bd);
    return json(listarEventos(bd, leerConsulta(request.url, esquemaListaEventos)), 200, { "Cache-Control": "no-store" });
});
