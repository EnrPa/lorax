// GET /api/salud — público. 200 si la base responde; 503 si no.
import { obtenerBd } from "~/server/db/cliente";
import { json, manejar } from "~/server/api/respuestas";
import { consultarSalud } from "~/server/servicios/salud";

export const GET = manejar(() => {
    const salud = consultarSalud(obtenerBd());
    return json(salud, salud.estado === "ok" ? 200 : 503, { "Cache-Control": "no-store" });
});
