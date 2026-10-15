import { defineConfig } from "drizzle-kit";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

if (existsSync(".env")) process.loadEnvFile(".env");

const archivo = process.env.DB_ARCHIVO || "./data/lorax.db";
mkdirSync(dirname(archivo), { recursive: true });

export default defineConfig({
    dialect: "sqlite",
    schema: "./src/server/db/esquema.ts",
    out: "./src/server/db/migraciones",
    dbCredentials: { url: archivo },
});
