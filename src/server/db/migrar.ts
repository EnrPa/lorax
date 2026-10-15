import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { resolve } from "node:path";
import type { BaseDatos } from "./cliente";

// Relativa a la raíz del proyecto: los scripts, las pruebas y la app corren desde ahí.
export const CARPETA_MIGRACIONES = resolve("src/server/db/migraciones");

export function aplicarMigraciones(bd: BaseDatos) {
    migrate(bd, { migrationsFolder: CARPETA_MIGRACIONES });
}
