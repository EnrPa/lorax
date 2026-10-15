// `npm run historico -- --anios 4 [--archivo data/carga/lorax.db] [--reemplazar]` (diseno.md §11):
// crea una base nueva para las pruebas de carga. Nunca usa la base de la aplicación (data/lorax.db).
import { existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { ARCHIVO_POR_DEFECTO, crearConexion } from "~/server/db/cliente";
import { aplicarMigraciones } from "~/server/db/migrar";
import { ARCHIVO_CARGA, generarHistorico } from "./historico";

const argumentos = process.argv.slice(2);
const valor = (nombre: string) => {
    const i = argumentos.indexOf(nombre);
    return i >= 0 ? argumentos[i + 1] : undefined;
};
const anios = Number(valor("--anios") ?? 4);
const archivo = valor("--archivo") ?? ARCHIVO_CARGA;

if (!Number.isFinite(anios) || anios <= 0 || anios > 10) {
    console.error("Uso: npm run historico -- --anios <1 a 10> [--archivo <ruta>] [--reemplazar]");
    process.exit(1);
}
if (resolve(archivo) === resolve(process.env.DB_ARCHIVO || ARCHIVO_POR_DEFECTO)) {
    console.error(`${archivo} es la base de la aplicación. La carga masiva va en una base aparte (por defecto ${ARCHIVO_CARGA}).`);
    process.exit(1);
}
if (existsSync(archivo)) {
    if (!argumentos.includes("--reemplazar")) {
        console.error(`${archivo} ya existe. Usa --reemplazar para generarla de nuevo.`);
        process.exit(1);
    }
    for (const sufijo of ["", "-wal", "-shm"]) rmSync(archivo + sufijo, { force: true });
}

mkdirSync(dirname(archivo), { recursive: true });
const bd = crearConexion(archivo);
aplicarMigraciones(bd);
const t0 = performance.now();
let ultimoAviso = 0;

try {
    const r = await generarHistorico(bd, {
        anios,
        alProgreso: (hechas, total) => {
            const porcentaje = Math.floor((hechas / total) * 100);
            if (porcentaje >= ultimoAviso + 10) {
                ultimoAviso = porcentaje;
                console.log(`  ${porcentaje} % (${((performance.now() - t0) / 1000).toFixed(0)} s)`);
            }
        },
    });
    const segundos = ((performance.now() - t0) / 1000).toFixed(1);
    const mb = (statSync(archivo).size / 1024 / 1024).toFixed(0);
    console.log(`Histórico de ${anios} años generado en ${archivo} (${segundos} s, ${mb} MB)`);
    console.log(`  Desde ${r.inicio.toISOString()} hasta ${r.semilla.fin.toISOString()}`);
    console.log(`  ${r.mediciones.toLocaleString("es-CL")} mediciones; ${r.semilla.alertas} alertas (de los últimos 30 días)`);
    console.log(`  Lecturas anteriores que incumplen criterios del piloto: ${r.incumplimientosAnteriores}`);
} catch (error) {
    console.error((error as Error).message);
    process.exitCode = 1;
} finally {
    bd.$client.close();
}
