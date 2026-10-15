// GET /api/v1/mediciones/exportar — PRODUCTOR dueño. Mismos filtros que la serie, sin comparación.
// CSV sin agregar, en streaming, con BOM y separador «;» (RF05.7, §8.3).
import type { APIEvent } from "@solidjs/start/server";
import { esquemaConsultaHistorial } from "~/lib/esquemas/historial";
import { manejar } from "~/server/api/respuestas";
import { leerConsulta } from "~/server/api/validacion";
import { requireRol } from "~/server/auth/guardas";
import { obtenerBd } from "~/server/db/cliente";
import { exportarCsv } from "~/server/servicios/historial";

export const GET = manejar(async ({ request }: APIEvent) => {
    const bd = obtenerBd();
    const { cuenta } = await requireRol(request, ["PRODUCTOR"], bd);
    const { compararDesde: _sinComparacion, ...consulta } = leerConsulta(request.url, esquemaConsultaHistorial);
    const { nombre, cuerpo } = exportarCsv(bd, cuenta.id, consulta);
    return new Response(cuerpo, {
        headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${nombre}"`,
            "Cache-Control": "no-store",
        },
    });
});
