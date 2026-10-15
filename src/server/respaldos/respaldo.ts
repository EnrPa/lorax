// Respaldo diario de la base (RNF04, diseno.md §11). Solo servidor.
// `VACUUM INTO` escribe una copia consistente aunque la aplicación esté escribiendo (modo WAL).
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { diaChile, sumarDias } from "~/lib/fechas";
import type { BaseDatos } from "~/server/db/cliente";
import { carpetaRespaldos } from "~/server/config";

export const RETENCION_DIAS = 30;
const PATRON = /^lorax-(\d{4}-\d{2}-\d{2})\.db$/;

export interface ResultadoRespaldo {
    archivo: string;
    /** `false` si el respaldo del día ya existía. */
    creado: boolean;
    /** Respaldos borrados por la retención. */
    eliminados: string[];
}

/** Respaldos diarios de la carpeta, del más antiguo al más reciente. Ignora otros archivos. */
export function listarRespaldos(carpeta = carpetaRespaldos()): Array<{ archivo: string; dia: string }> {
    if (!existsSync(carpeta)) return [];
    return readdirSync(carpeta)
        .map((nombre) => ({ nombre, dia: PATRON.exec(nombre)?.[1] }))
        .filter((r): r is { nombre: string; dia: string } => r.dia !== undefined)
        .sort((a, b) => a.dia.localeCompare(b.dia))
        .map((r) => ({ archivo: join(carpeta, r.nombre), dia: r.dia }));
}

/**
 * Crea `lorax-<día de Chile>.db` si aún no existe (uno por día) y borra los respaldos de más de
 * `RETENCION_DIAS` días según la fecha del nombre.
 */
export function crearRespaldo(bd: BaseDatos, ahora = new Date(), carpeta = carpetaRespaldos()): ResultadoRespaldo {
    mkdirSync(carpeta, { recursive: true });
    const dia = diaChile(ahora);
    const archivo = join(carpeta, `lorax-${dia}.db`);

    let creado = false;
    if (!existsSync(archivo)) {
        // Primero a un archivo temporal: un respaldo interrumpido nunca queda con el nombre del día.
        const temporal = `${archivo}.tmp`;
        rmSync(temporal, { force: true });
        bd.$client.prepare("VACUUM INTO ?").run(resolve(temporal));
        renameSync(temporal, archivo);
        creado = true;
    }

    // Se conservan los últimos 30 días: del día actual hacia atrás, 29 días.
    const limite = sumarDias(dia, -RETENCION_DIAS);
    const eliminados = listarRespaldos(carpeta)
        .filter((r) => r.dia <= limite)
        .map((r) => {
            rmSync(r.archivo, { force: true });
            return r.archivo;
        });
    return { archivo, creado, eliminados };
}

/** Fecha del respaldo más reciente (la de su archivo), o `null` si no hay. */
export function ultimoRespaldo(carpeta = carpetaRespaldos()): { fecha: Date } | null {
    const ultimo = listarRespaldos(carpeta).at(-1);
    return ultimo ? { fecha: statSync(ultimo.archivo).mtime } : null;
}
