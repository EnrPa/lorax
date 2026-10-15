// `npm run db:semilla`: carga los datos piloto en la base de DB_ARCHIVO. Requiere la app detenida.
import { ARCHIVO_POR_DEFECTO, crearConexion } from "~/server/db/cliente";
import { sembrar } from "./semilla";

const archivo = process.env.DB_ARCHIVO || ARCHIVO_POR_DEFECTO;
const bd = crearConexion(archivo);
const t0 = performance.now();

try {
    const r = await sembrar(bd);
    const segundos = ((performance.now() - t0) / 1000).toFixed(1);
    console.log(`Semilla cargada en ${archivo} (${segundos} s)`);
    console.log(`  Historia: ${r.inicio.toISOString()} → ${r.fin.toISOString()}`);
    console.log(
        `  ${r.cuentas} cuentas, ${r.terrenos} terrenos, ${r.estaciones} estaciones, ${r.sensores} sensores, ${r.criterios} criterios`,
    );
    console.log(`  ${r.mediciones} mediciones, ${r.alertas} alertas, ${r.notificaciones} notificaciones, ${r.eventos} eventos`);
} catch (error) {
    console.error((error as Error).message);
    process.exitCode = 1;
} finally {
    bd.$client.close();
}
