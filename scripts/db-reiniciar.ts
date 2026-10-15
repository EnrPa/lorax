// Borra la base SQLite (con sus archivos -wal y -shm) para recrearla desde cero.
// `npm run db:reiniciar` ejecuta después las migraciones. Requiere la app detenida.
import { rmSync } from "node:fs";

const archivo = process.env.DB_ARCHIVO || "./data/lorax.db";

for (const sufijo of ["", "-wal", "-shm"]) {
    rmSync(archivo + sufijo, { force: true });
}
console.log(`Base de datos borrada: ${archivo}`);
