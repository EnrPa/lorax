import { beforeAll, describe, expect, test } from "vitest";
import { ponerAlDia } from "../../scripts/al-dia";
import { estacionesPiloto } from "../../scripts/datos-piloto";
import { finDeHistoria, inicioDeHistoria, ventanasDeSequia } from "../../scripts/generacion";
import { ModeloEstacion } from "../../scripts/modelo-valores";
import { sembrar } from "../../scripts/semilla";
import type { BaseDatos } from "~/server/db/cliente";
import { crearBdPrueba } from "./bd";

// db:al-dia (diseno.md §10): completa las mediciones faltantes con el mismo generador de la semilla.
const T0 = new Date("2026-09-26T12:00:00Z");
const HORA = 3_600_000;

function medicionesDe(bd: BaseDatos, serie: string, desde: number) {
    return bd.$client
        .prepare(
            `SELECT s.codigo, m.fecha, m.valor FROM mediciones m
             JOIN sensores s ON s.id = m.sensor_id JOIN estaciones e ON e.id = s.estacion_id
             WHERE e.numero_serie = ? AND m.fecha > ? ORDER BY m.fecha, s.codigo`,
        )
        .all(serie, desde) as Array<{ codigo: string; fecha: number; valor: number }>;
}

const alertas = (bd: BaseDatos) =>
    bd.$client.prepare("SELECT estado, count(*) AS n FROM alertas GROUP BY estado ORDER BY estado").all();

let unPaso: BaseDatos;
let dosPasos: BaseDatos;

beforeAll(async () => {
    unPaso = crearBdPrueba();
    dosPasos = crearBdPrueba();
    await sembrar(unPaso, T0);
    await sembrar(dosPasos, T0);
}, 60_000);

describe("db:al-dia", () => {
    test("[T2.2] completa cada 15 minutos desde la última lectura hasta ahora", () => {
        const antes = alertas(unPaso);
        const r = ponerAlDia(unPaso, new Date(T0.getTime() + 2 * HORA + 7 * 60_000));
        // 2 h = 8 intervalos × 6 sensores, en las 7 estaciones que reportan.
        expect(r.porEstacion).toEqual(
            Object.fromEntries(["EST-0001", "EST-0002", "EST-0004", "EST-0005", "EST-0006", "EST-0007", "EST-0008"].map((s) => [s, 48])),
        );
        expect(r.hasta.toISOString()).toBe("2026-09-26T14:00:00.000Z");

        const fechas = new Set(medicionesDe(unPaso, "EST-0002", T0.getTime()).map((m) => m.fecha));
        expect(fechas.size).toBe(8);

        const ultimas = unPaso.$client.prepare("SELECT DISTINCT fecha_ultima_lectura AS f FROM sensores s JOIN estaciones e ON e.id = s.estacion_id WHERE e.numero_serie = 'EST-0002'").all();
        expect(ultimas).toEqual([{ f: r.hasta.getTime() }]);
        expect(alertas(unPaso)).toEqual(antes);
    });

    test("[T2.2] respeta las situaciones preparadas: EST-0003 no se completa y EST-0001 sigue bajo 25 %", () => {
        expect(medicionesDe(unPaso, "EST-0003", T0.getTime() - 3 * HORA)).toHaveLength(0);

        const humedad = medicionesDe(unPaso, "EST-0001", T0.getTime()).filter((m) => m.codigo === "hum_suelo");
        expect(humedad).toHaveLength(8);
        for (const m of humedad) expect(m.valor).toBeLessThan(25);

        // La alerta vigente de EST-0001 sigue siendo una sola.
        expect(alertas(unPaso)).toContainEqual({ estado: "VIGENTE", n: 1 });
    });

    test("[T2.2] ejecutarlo de nuevo no duplica nada", () => {
        const r = ponerAlDia(unPaso, new Date(T0.getTime() + 2 * HORA + 10 * 60_000));
        expect(r.mediciones).toBe(0);
    });

    test("[T2.2] el generador, reproducido desde el inicio, da exactamente las mediciones de la semilla", () => {
        const piloto = estacionesPiloto().find((e) => e.numeroSerie === "EST-0001")!;
        const fin = finDeHistoria(T0);
        const modelo = new ModeloEstacion(piloto, piloto.terreno.clima, ventanasDeSequia(piloto.numeroSerie, fin));
        const guardadas = medicionesDe(unPaso, "EST-0001", 0).filter((m) => m.fecha <= fin.getTime());
        const regeneradas: typeof guardadas = [];
        for (let ms = inicioDeHistoria(fin).getTime(); ms <= fin.getTime(); ms += 15 * 60_000) {
            const valores = modelo.lecturas(new Date(ms));
            modelo.meta();
            for (const codigo of Object.keys(valores).sort()) {
                regeneradas.push({ codigo, fecha: ms, valor: valores[codigo as keyof typeof valores] });
            }
        }
        expect(regeneradas).toEqual(guardadas);
    });

    test("[T2.2] la historia continúa igual, se complete de una vez o en varios pasos", () => {
        ponerAlDia(dosPasos, new Date(T0.getTime() + 1 * HORA));
        ponerAlDia(dosPasos, new Date(T0.getTime() + 2 * HORA));
        for (const serie of ["EST-0001", "EST-0005", "EST-0008"]) {
            expect(medicionesDe(dosPasos, serie, T0.getTime())).toEqual(medicionesDe(unPaso, serie, T0.getTime()));
        }
    });
});
