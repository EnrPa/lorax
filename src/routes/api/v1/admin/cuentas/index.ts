// GET / POST /api/v1/admin/cuentas — ADMINISTRADOR. Listar productores (?q&habilitada) / crear uno (RF07.2, RF07.3).
import type { APIEvent } from "@solidjs/start/server";
import { esquemaCrearProductor, esquemaListaCuentas } from "~/lib/esquemas/admin";
import { json, manejar } from "~/server/api/respuestas";
import { leerConsulta, leerCuerpo } from "~/server/api/validacion";
import { requireRol } from "~/server/auth/guardas";
import { obtenerBd } from "~/server/db/cliente";
import { crearProductor, listarCuentas } from "~/server/servicios/admin";

export const GET = manejar(async ({ request }: APIEvent) => {
    const bd = obtenerBd();
    await requireRol(request, ["ADMINISTRADOR"], bd);
    return json(listarCuentas(bd, leerConsulta(request.url, esquemaListaCuentas)), 200, { "Cache-Control": "no-store" });
});

export const POST = manejar(async ({ request }: APIEvent) => {
    const bd = obtenerBd();
    const { cuenta } = await requireRol(request, ["ADMINISTRADOR"], bd);
    const datos = await leerCuerpo(request, esquemaCrearProductor);
    return json(await crearProductor(bd, cuenta.id, datos), 201);
});
