// Conexión a SQLite (diseno.md D2). Solo servidor.
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import * as esquema from "./esquema";

export const ARCHIVO_POR_DEFECTO = "./data/lorax.db";

/** Abre una conexión nueva. Las pruebas usan `":memory:"`; la aplicación usa `obtenerBd()`. */
export function crearConexion(archivo: string) {
    if (archivo !== ":memory:") mkdirSync(dirname(archivo), { recursive: true });
    const sqlite = new Database(archivo);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    sqlite.pragma("busy_timeout = 5000");
    return drizzle({ client: sqlite, schema: esquema });
}

export type BaseDatos = ReturnType<typeof crearConexion>;

// Singleton en globalThis: la recarga en caliente de Vinxi no abre una segunda conexión.
const global = globalThis as typeof globalThis & { __loraxBd?: BaseDatos };

export function obtenerBd(): BaseDatos {
    global.__loraxBd ??= crearConexion(process.env.DB_ARCHIVO || ARCHIVO_POR_DEFECTO);
    return global.__loraxBd;
}
