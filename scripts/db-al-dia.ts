// `npm run db:al-dia`: pone al día los datos piloto. Funciona con el servidor encendido (modo WAL).
import { ARCHIVO_POR_DEFECTO, crearConexion } from "~/server/db/cliente";
import { ponerAlDia } from "./al-dia";

const archivo = process.env.DB_ARCHIVO || ARCHIVO_POR_DEFECTO;
const bd = crearConexion(archivo);
const t0 = performance.now();

try {
    const r = ponerAlDia(bd);
    const segundos = ((performance.now() - t0) / 1000).toFixed(1);
    if (r.mediciones === 0) {
        console.log(`Los datos ya estaban al día hasta ${r.hasta.toISOString()}.`);
    } else {
        console.log(`Datos al día hasta ${r.hasta.toISOString()} (${segundos} s): ${r.mediciones} mediciones nuevas, ${r.alertasNuevas} alertas nuevas.`);
        for (const [serie, n] of Object.entries(r.porEstacion)) console.log(`  ${serie}: ${n}`);
    }
    console.log("  EST-0003 no se completa: sigue «sin datos recientes», como en los datos piloto.");
} catch (error) {
    console.error((error as Error).message);
    process.exitCode = 1;
} finally {
    bd.$client.close();
}
