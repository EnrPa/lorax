import { eq, isNull, sql } from "drizzle-orm";
import { beforeAll, describe, expect, test } from "vitest";
import { CONTRASENA_DEMO, PRODUCTORES, SITUACIONES } from "../../scripts/datos-piloto";
import { finDeHistoria, sembrar, type ResumenSemilla } from "../../scripts/semilla";
import { esRutValido } from "~/lib/rut";
import type { BaseDatos } from "~/server/db/cliente";
import { alertas, criterios, cuentas, empresas, estaciones, eventos, notificaciones, sensores } from "~/server/db/esquema";
import { crearBdPrueba } from "./bd";

const ahora = new Date("2026-09-26T12:07:00Z");
const fin = finDeHistoria(ahora);
let bd: BaseDatos;
let resumen: ResumenSemilla;
let duracionMs: number;

beforeAll(async () => {
    bd = crearBdPrueba();
    const t0 = performance.now();
    resumen = await sembrar(bd, ahora);
    duracionMs = performance.now() - t0;
}, 60_000);

function ultimaLecturaDe(numeroSerie: string) {
    return bd
        .select({ fecha: sensores.fechaUltimaLectura })
        .from(sensores)
        .innerJoin(estaciones, eq(estaciones.id, sensores.estacionId))
        .where(eq(estaciones.numeroSerie, numeroSerie))
        .all()
        .map((s) => s.fecha?.getTime());
}

describe("conteos", () => {
    test("[T0.4] 1 administrador, 4 productores, 3 terrenos, 8 estaciones, 48 sensores y 3 criterios", () => {
        const porRol = bd.select({ rol: cuentas.rol, total: sql<number>`count(*)` }).from(cuentas).groupBy(cuentas.rol).all();
        expect(Object.fromEntries(porRol.map((r) => [r.rol, r.total]))).toEqual({ ADMINISTRADOR: 1, PRODUCTOR: 4 });
        expect(resumen).toMatchObject({ terrenos: 3, estaciones: 8, sensores: 48, criterios: 3 });
    });

    test("[T0.4] unas 138 mil mediciones: 30 días de 48 sensores cada 15 minutos", () => {
        // 48 sensores × 2.880 mediciones, menos 3 h (12 mediciones) de los 6 sensores de la estación silenciosa.
        expect(resumen.mediciones).toBe(48 * 2880 - 12 * 6);
    });

    test("[T0.4] la semilla tarda menos de 1 minuto", () => {
        expect(duracionMs).toBeLessThan(60_000);
    });

    test("[T0.4] no se puede sembrar dos veces la misma base", async () => {
        await expect(sembrar(bd, ahora)).rejects.toThrow(/db:reiniciar/);
    });
});

describe("cuentas y empresas", () => {
    test("[T0.4] las contraseñas se guardan con scrypt y no en texto plano", () => {
        for (const cuenta of bd.select().from(cuentas).all()) {
            expect(cuenta.contrasenaHash).toMatch(/^scrypt\$131072\$8\$1\$[^$]+\$[^$]+$/);
            expect(cuenta.contrasenaHash).not.toContain(CONTRASENA_DEMO);
        }
    });

    test("[T0.4] los RUT de las empresas son válidos", () => {
        const ruts = bd.select({ rut: empresas.rut }).from(empresas).all();
        expect(ruts).toHaveLength(4);
        expect(ruts.every((e) => esRutValido(e.rut))).toBe(true);
    });

    test("[T0.4] el productor 4 está deshabilitado y la productora 3 no tiene terrenos", () => {
        const deshabilitadas = bd.select({ correo: cuentas.correo }).from(cuentas).where(eq(cuentas.habilitada, false)).all();
        expect(deshabilitadas.map((c) => c.correo)).toEqual([PRODUCTORES[3].correo]);
        expect(PRODUCTORES[2].terrenos).toHaveLength(0);
    });
});

describe("situaciones preparadas (diseno.md §10)", () => {
    test("[T0.4] EST-0001 tiene una alerta vigente no leída por humedad del suelo bajo 25 %", () => {
        const vigentes = bd.select().from(alertas).where(eq(alertas.estado, "VIGENTE")).all();
        expect(vigentes).toHaveLength(1);
        expect(vigentes[0].leida).toBe(false);
        expect(vigentes[0].mensaje).toMatch(/^Humedad del suelo bajo el umbral en Parcela Los Castaños \(EST-0001\): \d+,\d % \(umbral 25 %\)$/);
    });

    test("[T0.4] hay una alerta resuelta leída y otra resuelta sin leer", () => {
        const resueltas = bd.select().from(alertas).where(eq(alertas.estado, "RESUELTA")).orderBy(alertas.fecha).all();
        expect(resueltas.map((a) => a.leida)).toEqual([true, false]);
        for (const alerta of resueltas) expect(alerta.fechaResolucion!.getTime()).toBeGreaterThan(alerta.fecha.getTime());
    });

    test("[T0.4] cada alerta nace de una medición real bajo el umbral y tiene sus notificaciones", () => {
        const filas = bd.$client
            .prepare(
                `SELECT a.id, m.valor, m.fecha AS fecha_medicion, a.fecha
                 FROM alertas a JOIN mediciones m ON m.id = a.medicion_id`,
            )
            .all() as Array<{ id: number; valor: number; fecha_medicion: number; fecha: number }>;
        expect(filas).toHaveLength(3);
        for (const fila of filas) {
            expect(fila.valor).toBeLessThan(25);
            expect(fila.fecha).toBe(fila.fecha_medicion);
            const canales = bd.select({ canal: notificaciones.canal }).from(notificaciones).where(eq(notificaciones.alertaId, fila.id)).all();
            expect(canales.map((c) => c.canal).sort()).toEqual(["CORREO", "PLATAFORMA"]);
        }
    });

    test("[T0.4] los criterios de EST-0005 y EST-0007 no tienen alertas, porque sus datos no los incumplen", () => {
        const conAlertas = bd.selectDistinct({ criterioId: alertas.criterioId }).from(alertas).all();
        expect(conAlertas).toHaveLength(1);
    });

    test("[T0.4] EST-0003 dejó de reportar hace 3 horas y las demás reportan hasta el fin de la historia", () => {
        const horas = SITUACIONES.estacionSilenciosa.horasSinReportar;
        expect(new Set(ultimaLecturaDe("EST-0003"))).toEqual(new Set([fin.getTime() - horas * 3_600_000]));
        for (const serie of ["EST-0001", "EST-0002", "EST-0004", "EST-0005", "EST-0006", "EST-0007", "EST-0008"]) {
            expect(new Set(ultimaLecturaDe(serie))).toEqual(new Set([fin.getTime()]));
        }
    });

    test("[T0.4] hay sensores sin criterios, para el estado «sin evaluar»", () => {
        const sinCriterios = bd
            .select({ id: sensores.id })
            .from(sensores)
            .leftJoin(criterios, eq(criterios.sensorId, sensores.id))
            .where(isNull(criterios.id))
            .all();
        expect(sinCriterios).toHaveLength(45);
    });

    test("[T0.4] unos 10 eventos administrativos, de acceso y de ingesta", () => {
        const porTipo = bd.select({ tipo: eventos.tipo, total: sql<number>`count(*)` }).from(eventos).groupBy(eventos.tipo).all();
        expect(Object.fromEntries(porTipo.map((e) => [e.tipo, e.total]))).toEqual({
            OPERACION_ADMINISTRATIVA: 5,
            ACCESO_FALLIDO: 2,
            TRAMA_RECHAZADA: 3,
        });
    });
});
