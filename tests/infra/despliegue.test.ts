import { existsSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { crearConexion } from "~/server/db/cliente";
import { aplicarMigraciones } from "~/server/db/migrar";
import { compilar, iniciarProduccion } from "../produccion";

// P-INF-DESPLIEGUE (diseno.md §12): la versión de producción se compila con `npm run build`, arranca con
// `node .output/server/index.mjs` y responde. Corre con `npm run test:infra`, aparte de `npm test`.

test("[P-INF-DESPLIEGUE] build + start: la versión de producción arranca, responde y hace su respaldo", async () => {
    compilar();

    // Base migrada y vacía, en una carpeta temporal: el despliegue no toca data/lorax.db.
    const carpeta = mkdtempSync(join(tmpdir(), "lorax-despliegue-"));
    const archivoBd = join(carpeta, "lorax.db");
    const bd = crearConexion(archivoBd);
    aplicarMigraciones(bd);
    bd.$client.close();

    const servidor = await iniciarProduccion(3201, {
        DB_ARCHIVO: archivoBd,
        RESPALDOS_DIR: join(carpeta, "respaldos"),
        CORREOS_DIR: join(carpeta, "correos"),
        MENSAJES_DIR: join(carpeta, "mensajes"),
        JWT_SECRET: "secreto-solo-para-la-prueba-de-despliegue-0123456789",
        INGESTA_API_KEY: "clave-solo-para-la-prueba-de-despliegue-0123456789",
    });
    const URL = servidor.url;

    try {
        const salud = await fetch(`${URL}/api/salud`);
        expect(salud.status, servidor.salida()).toBe(200);
        expect(await salud.json()).toMatchObject({ estado: "ok", bd: { ok: true }, notificaciones: { pendientes: 0, fallidas: 0 } });

        // Páginas servidas, con los encabezados de seguridad de producción (sin la excepción de Vite).
        const login = await fetch(`${URL}/login`, { headers: { Accept: "text/html" } });
        expect(login.status).toBe(200);
        expect(login.headers.get("content-security-policy")).toContain("connect-src 'self';");
        expect(login.headers.get("content-security-policy")).not.toContain("ws:");

        // En producción, la bandeja de desarrollo no existe (diseno.md §9).
        expect((await fetch(`${URL}/api/v1/dev/correos`)).status).toBe(404);

        // La primera petición inició la tarea de respaldo: aparece el respaldo del día.
        const respaldos = join(carpeta, "respaldos");
        await expect
            .poll(() => (existsSync(respaldos) ? readdirSync(respaldos).filter((f) => /^lorax-\d{4}-\d{2}-\d{2}\.db$/.test(f)) : []), { timeout: 10_000 })
            .toHaveLength(1);
        expect((await (await fetch(`${URL}/api/salud`)).json()).ultimoRespaldo).toMatchObject({ fecha: expect.any(String) });
    } finally {
        servidor.detener();
    }
});
