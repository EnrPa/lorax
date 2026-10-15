import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { cookieSesion } from "~/server/auth/cookie";
import { encabezadosSeguridad } from "~/server/auth/seguridad";
import { ARCHIVO_POR_DEFECTO, crearConexion } from "~/server/db/cliente";

// Pruebas documentales de seguridad (diseno.md §12, fase 6). Verifican en el código lo que la tesis
// declara: la base es un archivo local sin puerto de red, y el cifrado en tránsito no aplica en local
// (HTTP en localhost), pero queda activo en cuanto APP_URL usa https.

const APP_URL_ORIGINAL = process.env.APP_URL;
afterEach(() => {
    process.env.APP_URL = APP_URL_ORIGINAL;
});

describe("[P-SEG-EXPOSICION-BD] La base de datos no se expone en la red", () => {
    test("[P-SEG-EXPOSICION-BD] SQLite se abre como un archivo local, sin host ni puerto", () => {
        expect(ARCHIVO_POR_DEFECTO).toBe("./data/lorax.db");
        const archivo = join(mkdtempSync(join(tmpdir(), "lorax-exposicion-")), "lorax.db");
        const bd = crearConexion(archivo);
        try {
            expect(bd.$client.name).toBe(archivo);
            expect(bd.$client.memory).toBe(false);
        } finally {
            bd.$client.close();
        }
        // drizzle-kit también apunta a un archivo, nunca a una URL de servidor.
        expect(readFileSync("drizzle.config.ts", "utf8")).toMatch(/dialect: "sqlite"[\s\S]*dbCredentials: \{ url: archivo \}/);
    });

    test("[P-SEG-EXPOSICION-BD] no hay clientes de bases de datos de red entre las dependencias", () => {
        const { dependencies, devDependencies } = JSON.parse(readFileSync("package.json", "utf8"));
        const todas = Object.keys({ ...dependencies, ...devDependencies });
        expect(todas).toContain("better-sqlite3");
        for (const red of ["pg", "postgres", "mysql", "mysql2", "mssql", "mongodb", "redis"]) expect(todas).not.toContain(red);
    });

    test("[P-SEG-EXPOSICION-BD] la base, los correos y los respaldos quedan fuera del repositorio", () => {
        const ignorados = readFileSync(".gitignore", "utf8").split("\n").map((l) => l.trim());
        expect(ignorados).toEqual(expect.arrayContaining(["/data", "/respaldos", ".env"]));
    });
});

describe("[P-SEG-CIFRADO] Cifrado en tránsito", () => {
    test("[P-SEG-CIFRADO] en local (http) no aplica: la cookie va sin Secure y no hay HSTS", () => {
        process.env.APP_URL = "http://localhost:3000";
        const cookie = cookieSesion("token", new Date(Date.now() + 3_600_000));
        expect(cookie).toContain("HttpOnly");
        expect(cookie).toContain("SameSite=Lax");
        expect(cookie).not.toContain("Secure");
        expect(encabezadosSeguridad(process.env.APP_URL, false)).not.toHaveProperty("Strict-Transport-Security");
    });

    test("[P-SEG-CIFRADO] con APP_URL en https, la cookie lleva Secure y la respuesta trae HSTS", () => {
        process.env.APP_URL = "https://lorax.example";
        expect(cookieSesion("token", new Date(Date.now() + 3_600_000))).toContain("Secure");
        expect(encabezadosSeguridad(process.env.APP_URL, false)["Strict-Transport-Security"]).toMatch(/max-age=31536000/);
    });
});
