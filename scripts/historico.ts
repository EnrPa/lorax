// Carga masiva para las pruebas de carga (diseno.md §11, RNF01 y RNF06): los datos piloto con N años de
// mediciones de los 48 sensores cada 15 minutos.
//
// Primero se siembran los datos piloto normales (los últimos 30 días, con todas sus situaciones
// preparadas) y después se agrega la historia anterior, en transacciones por estación y mes para no
// inflar el archivo -wal. La historia anterior se genera sin sequías: sus valores no incumplen los
// criterios del piloto, por eso no se evalúa (se comprueba al final, en `incumplimientosAnteriores`).
import { eq } from "drizzle-orm";
import type { BaseDatos } from "~/server/db/cliente";
import { estaciones, sensores } from "~/server/db/esquema";
import { CRITERIOS_PILOTO, estacionesPiloto } from "./datos-piloto";
import { INTERVALO_MS, MS_DIA, tramaDe } from "./generacion";
import { ModeloEstacion } from "./modelo-valores";
import { sembrar, type ResumenSemilla } from "./semilla";

/** Base de las pruebas de carga: nunca la de la aplicación. */
export const ARCHIVO_CARGA = "./data/carga/lorax.db";

const DIAS_POR_TANDA = 30;

export interface ResumenHistorico {
    semilla: ResumenSemilla;
    inicio: Date;
    mediciones: number;
    /** Lecturas anteriores a la semilla que incumplirían un criterio del piloto; debe ser 0. */
    incumplimientosAnteriores: number;
}

export async function generarHistorico(
    bd: BaseDatos,
    opciones: { anios: number; ahora?: Date; alProgreso?: (hechas: number, total: number) => void },
): Promise<ResumenHistorico> {
    const semilla = await sembrar(bd, opciones.ahora);
    const sqlite = bd.$client;
    // Carga masiva: no hace falta esperar al disco en cada transacción. Si se corta, se vuelve a generar.
    sqlite.pragma("synchronous = OFF");

    const finAnterior = semilla.inicio.getTime(); // la primera medición de la semilla, excluida
    const inicio = new Date(finAnterior - Math.round(opciones.anios * 365) * MS_DIA);
    const insertar = sqlite.prepare("INSERT INTO mediciones (sensor_id, valor, fecha, payload) VALUES (?, ?, ?, ?)");

    const piloto = estacionesPiloto();
    const pasosPorEstacion = Math.ceil((finAnterior - inicio.getTime()) / INTERVALO_MS);
    const total = pasosPorEstacion * piloto.length;
    let hechas = 0;

    for (const estacion of piloto) {
        const fila = bd.select({ id: estaciones.id }).from(estaciones).where(eq(estaciones.numeroSerie, estacion.numeroSerie)).get()!;
        const porCodigo = new Map(
            bd.select({ id: sensores.id, codigo: sensores.codigo }).from(sensores).where(eq(sensores.estacionId, fila.id)).all().map((s) => [s.codigo, s.id]),
        );
        // Sin ventanas de sequía: en la historia anterior la humedad del suelo se riega con normalidad.
        const modelo = new ModeloEstacion(estacion, estacion.terreno.clima);

        for (let desde = inicio.getTime(); desde < finAnterior; desde += DIAS_POR_TANDA * MS_DIA) {
            const hasta = Math.min(desde + DIAS_POR_TANDA * MS_DIA, finAnterior);
            sqlite.transaction(() => {
                for (let ms = desde; ms < hasta; ms += INTERVALO_MS) {
                    const fecha = new Date(ms);
                    const { lecturas, payload } = tramaDe(estacion.numeroSerie, fecha, modelo.lecturas(fecha), modelo.meta());
                    for (const { codigo, valor } of lecturas) insertar.run(porCodigo.get(codigo)!, valor, ms, payload);
                    hechas++;
                }
            })();
            opciones.alProgreso?.(hechas, total);
        }
    }

    sqlite.pragma("synchronous = NORMAL");
    // Estadísticas para el planificador de consultas y archivo -wal vacío.
    sqlite.exec("ANALYZE");
    sqlite.pragma("wal_checkpoint(TRUNCATE)");

    return {
        semilla,
        inicio,
        mediciones: (sqlite.prepare("SELECT count(*) AS n FROM mediciones").get() as { n: number }).n,
        incumplimientosAnteriores: incumplimientosAnteriores(bd, finAnterior),
    };
}

/** Lecturas anteriores a la semilla que incumplen algún criterio del piloto (deberían ser 0). */
function incumplimientosAnteriores(bd: BaseDatos, antesDe: number): number {
    let total = 0;
    for (const c of CRITERIOS_PILOTO) {
        const condicion = c.condicion === "SUPERA" ? "m.valor > ?" : "m.valor < ?";
        total += (
            bd.$client
                .prepare(
                    `SELECT count(*) AS n FROM mediciones m
                     JOIN sensores s ON s.id = m.sensor_id JOIN estaciones e ON e.id = s.estacion_id
                     WHERE e.numero_serie = ? AND s.codigo = ? AND m.fecha < ? AND ${condicion}`,
                )
                .get(c.numeroSerie, c.codigo, antesDe, c.umbral) as { n: number }
        ).n;
    }
    return total;
}

