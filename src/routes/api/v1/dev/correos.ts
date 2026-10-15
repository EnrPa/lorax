// GET /api/v1/dev/correos — bandeja de correos escritos a archivo (diseno.md D6).
// Solo en desarrollo: con NODE_ENV=production responde 404, con o sin sesión (diseno.md §9).
import { modoDesarrollo } from "~/lib/rutas";
import { noEncontrado } from "~/server/api/errores";
import { json, manejar } from "~/server/api/respuestas";
import { listarCorreos } from "~/server/correo/correo";

export const GET = manejar(async () => {
    if (!modoDesarrollo()) throw noEncontrado();
    return json({ items: await listarCorreos() }, 200, { "Cache-Control": "no-store" });
});
