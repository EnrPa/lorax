// `npm run restaurar <archivo>` (diseno.md §11): restaura un respaldo y verifica los conteos.
// Requiere la aplicación detenida, igual que `npm run db:reiniciar`.
import { ARCHIVO_POR_DEFECTO } from "~/server/db/cliente";
import { carpetaRespaldos } from "~/server/config";
import { listarRespaldos } from "~/server/respaldos/respaldo";
import { restaurar } from "~/server/respaldos/restauracion";

const archivo = process.argv[2];
if (!archivo) {
    console.error("Uso: npm run restaurar <archivo>   (con la aplicación detenida)");
    const disponibles = listarRespaldos();
    if (disponibles.length) {
        console.error("\nRespaldos disponibles:");
        for (const r of disponibles) console.error(`  ${r.archivo}`);
    }
    process.exit(1);
}

const destino = process.env.DB_ARCHIVO || ARCHIVO_POR_DEFECTO;
try {
    const { conteos, copiaPrevia } = restaurar(archivo, destino, carpetaRespaldos());
    if (copiaPrevia) console.log(`Copia de la base anterior: ${copiaPrevia}`);
    console.log(`Base restaurada en ${destino} desde ${archivo}.\n`);
    console.table(conteos.map((c) => ({ tabla: c.tabla, "filas en el respaldo": c.respaldo, "filas restauradas": c.restaurada })));
    console.log("\nRestauración verificada: los conteos de todas las tablas coinciden.");
} catch (error) {
    console.error(`No se pudo restaurar: ${(error as Error).message}`);
    process.exit(1);
}
