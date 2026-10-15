// Restauración de un respaldo (RNF04, diseno.md §11), con la aplicación detenida. Solo servidor.
// La usa `npm run restaurar <archivo>` (scripts/restaurar.ts).
import Database from "better-sqlite3";
import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

export interface ConteoTabla {
    tabla: string;
    respaldo: number;
    restaurada: number;
}

export interface ResultadoRestauracion {
    conteos: ConteoTabla[];
    /** Copia de la base que había antes, o `null` si no existía. */
    copiaPrevia: string | null;
}

/** Filas por tabla de una base. Falla si el archivo no es una base SQLite íntegra. */
export function contarFilas(archivo: string): Record<string, number> {
    let bd: Database.Database | null = null;
    try {
        bd = new Database(archivo, { readonly: true, fileMustExist: true });
        const integridad = bd.pragma("integrity_check", { simple: true });
        if (integridad !== "ok") throw new Error(`integridad: ${String(integridad)}`);
        const tablas = bd
            .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
            .all() as Array<{ name: string }>;
        if (!tablas.length) throw new Error("no tiene tablas");
        return Object.fromEntries(
            tablas.map(({ name }) => [name, (bd!.prepare(`SELECT count(*) AS n FROM "${name}"`).get() as { n: number }).n]),
        );
    } catch (error) {
        throw new Error(`${archivo} no es una base de datos válida de LoRax (${(error as Error).message}).`);
    } finally {
        bd?.close();
    }
}

const sello = (ahora: Date) => ahora.toISOString().slice(0, 19).replace(/[T:]/g, "-");

function reemplazar(origen: string, destino: string) {
    for (const sufijo of ["", "-wal", "-shm"]) rmSync(destino + sufijo, { force: true });
    copyFileSync(origen, destino);
}

/**
 * Reemplaza `destino` por el respaldo y verifica que cada tabla tenga las mismas filas. Antes guarda
 * una copia de la base actual en `carpetaCopias`; si la verificación falla, la vuelve a poner.
 */
export function restaurar(respaldo: string, destino: string, carpetaCopias: string, ahora = new Date()): ResultadoRestauracion {
    if (!existsSync(respaldo)) throw new Error(`No existe el archivo ${respaldo}.`);
    if (resolve(respaldo) === resolve(destino)) throw new Error("El respaldo y la base de la aplicación son el mismo archivo.");
    const esperado = contarFilas(respaldo);

    // Copia de la base actual, consistente aunque tenga cambios en el archivo -wal.
    let copiaPrevia: string | null = null;
    if (existsSync(destino)) {
        mkdirSync(carpetaCopias, { recursive: true });
        copiaPrevia = join(carpetaCopias, `antes-de-restaurar-${sello(ahora)}.db`);
        const actual = new Database(destino, { fileMustExist: true });
        try {
            actual.prepare("VACUUM INTO ?").run(resolve(copiaPrevia));
        } finally {
            actual.close();
        }
    }

    reemplazar(respaldo, destino);

    const obtenido = contarFilas(destino);
    const tablas = [...new Set([...Object.keys(esperado), ...Object.keys(obtenido)])].sort();
    const conteos = tablas.map((tabla) => ({ tabla, respaldo: esperado[tabla] ?? -1, restaurada: obtenido[tabla] ?? -1 }));
    const distintas = conteos.filter((c) => c.respaldo !== c.restaurada);
    if (distintas.length) {
        if (copiaPrevia) reemplazar(copiaPrevia, destino);
        throw new Error(
            `Los conteos no coinciden en ${distintas.map((c) => c.tabla).join(", ")}. Se volvió a la base anterior.`,
        );
    }
    return { conteos, copiaPrevia };
}
