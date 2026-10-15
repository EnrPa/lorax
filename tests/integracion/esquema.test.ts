import { eq } from "drizzle-orm";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, test } from "vitest";
import { crearConexion, type BaseDatos } from "~/server/db/cliente";
import {
    alertas,
    clientes,
    criterios,
    cuentas,
    empresas,
    estaciones,
    mediciones,
    sensores,
    terrenos,
} from "~/server/db/esquema";
import { crearBdPrueba, errorSqlite } from "./bd";

const ahora = new Date("2026-09-26T12:00:00Z");
let bd: BaseDatos;
let sensorId: number;
let medicionId: number;
let criterioId: number;

beforeAll(() => {
    bd = crearBdPrueba();
    const empresa = bd.insert(empresas).values({ nombre: "Agrícola Prueba SpA", rut: "76.086.428-5" }).returning().get();
    const cuenta = bd
        .insert(cuentas)
        .values({ correo: "maria@ejemplo.cl", nombre: "María", apellido: "González", rol: "PRODUCTOR" })
        .returning()
        .get();
    const cliente = bd.insert(clientes).values({ empresaId: empresa.id, cuentaId: cuenta.id }).returning().get();
    const terreno = bd
        .insert(terrenos)
        .values({ clienteId: cliente.id, nombre: "Parcela", latitud: -38.95, longitud: -72.62, fechaUltimaActualizacion: ahora })
        .returning()
        .get();
    const estacion = bd
        .insert(estaciones)
        .values({
            terrenoId: terreno.id,
            tipo: "Estación",
            modelo: "M1",
            numeroSerie: "EST-0001",
            latitud: -38.95,
            longitud: -72.62,
            fechaCreacion: ahora,
            fechaUltimaActualizacion: ahora,
        })
        .returning()
        .get();
    sensorId = bd
        .insert(sensores)
        .values({
            estacionId: estacion.id,
            codigo: "hum_suelo",
            tipo: "humedad_suelo",
            unidad: "%",
            rangoMinimo: 0,
            rangoMaximo: 100,
            fechaCreacion: ahora,
        })
        .returning()
        .get().id;
    medicionId = bd
        .insert(mediciones)
        .values({ sensorId, valor: 31.5, fecha: ahora, payload: { numero_serie: "EST-0001" } })
        .returning()
        .get().id;
    criterioId = bd
        .insert(criterios)
        .values({ sensorId, umbral: 25, condicion: "DESCIENDE", fechaCreacion: ahora })
        .returning()
        .get().id;
});

describe("valores por defecto", () => {
    test("[T0.3] una cuenta nueva queda habilitada y sin contraseña (pendiente de activación)", () => {
        const cuenta = bd.select().from(cuentas).where(eq(cuentas.correo, "maria@ejemplo.cl")).get();
        expect(cuenta?.habilitada).toBe(true);
        expect(cuenta?.contrasenaHash).toBeNull();
    });

    test("[T0.3] sensor, criterio y medición toman sus valores por defecto", () => {
        const sensor = bd.select().from(sensores).where(eq(sensores.id, sensorId)).get();
        expect(sensor?.intervaloMedicion).toBe(900);
        const criterio = bd.select().from(criterios).where(eq(criterios.id, criterioId)).get();
        expect(criterio).toMatchObject({ severidad: "ADVERTENCIA", habilitado: true, canales: "", fechaEliminacion: null });
        const medicion = bd.select().from(mediciones).where(eq(mediciones.id, medicionId)).get();
        expect(medicion?.fecha).toEqual(ahora);
        expect(medicion?.payload).toEqual({ numero_serie: "EST-0001" });
    });
});

describe("inmutabilidad de mediciones", () => {
    test("[T0.3] el trigger rechaza UPDATE", () => {
        const error = errorSqlite(() =>
            bd.update(mediciones).set({ valor: 99 }).where(eq(mediciones.id, medicionId)).run(),
        );
        expect(error).toContain("Las mediciones no se pueden modificar");
        expect(bd.select().from(mediciones).where(eq(mediciones.id, medicionId)).get()?.valor).toBe(31.5);
    });

    test("[T0.3] el trigger rechaza DELETE", () => {
        const error = errorSqlite(() => bd.delete(mediciones).where(eq(mediciones.id, medicionId)).run());
        expect(error).toContain("Las mediciones no se pueden eliminar");
        expect(bd.select().from(mediciones).all()).toHaveLength(1);
    });
});

describe("restricciones únicas", () => {
    test("[T0.3] el correo es único sin distinguir mayúsculas", () => {
        const error = errorSqlite(() =>
            bd.insert(cuentas).values({ correo: "MARIA@Ejemplo.cl", nombre: "Otra", apellido: "Persona", rol: "PRODUCTOR" }).run(),
        );
        expect(error).toMatch(/UNIQUE constraint failed/);
    });

    test("[T0.3] el número de serie de una estación es único", () => {
        const terreno = bd.select().from(terrenos).get()!;
        const error = errorSqlite(() =>
            bd
                .insert(estaciones)
                .values({
                    terrenoId: terreno.id,
                    tipo: "Estación",
                    modelo: "M2",
                    numeroSerie: "EST-0001",
                    latitud: 0,
                    longitud: 0,
                    fechaCreacion: ahora,
                    fechaUltimaActualizacion: ahora,
                })
                .run(),
        );
        expect(error).toMatch(/UNIQUE constraint failed: estaciones\.numero_serie/);
    });

    test("[T0.3] no hay dos mediciones del mismo sensor en la misma fecha", () => {
        const error = errorSqlite(() => bd.insert(mediciones).values({ sensorId, valor: 30, fecha: ahora, payload: {} }).run());
        expect(error).toMatch(/UNIQUE constraint failed: mediciones\.sensor_id, mediciones\.fecha/);

        const otraFecha = new Date(ahora.getTime() + 15 * 60_000);
        bd.insert(mediciones).values({ sensorId, valor: 30, fecha: otraFecha, payload: {} }).run();
    });

    test("[T0.3] un criterio tiene a lo más una alerta vigente, pero puede tener varias resueltas", () => {
        const alerta = { medicionId, criterioId, nombre: "Humedad baja", tipo: "ADVERTENCIA", mensaje: "m", fecha: ahora };
        const primera = bd.insert(alertas).values(alerta).returning().get();

        expect(errorSqlite(() => bd.insert(alertas).values(alerta).run())).toMatch(/UNIQUE constraint failed: alertas\.criterio_id/);

        bd.update(alertas).set({ estado: "RESUELTA", fechaResolucion: ahora }).where(eq(alertas.id, primera.id)).run();
        bd.insert(alertas).values(alerta).run();
        bd.insert(alertas).values({ ...alerta, estado: "RESUELTA" }).run();

        const vigentes = bd.select().from(alertas).where(eq(alertas.estado, "VIGENTE")).all();
        expect(vigentes).toHaveLength(1);
    });
});

describe("valores permitidos (CHECK)", () => {
    // SQL directo: los tipos de Drizzle ya impiden estos valores desde el código.
    const casos: Array<[string, string]> = [
        ["rol", "INSERT INTO cuentas (correo, nombre, apellido, rol) VALUES ('x@ejemplo.cl', 'X', 'Y', 'INVITADO')"],
        ["condicion", "INSERT INTO criterios (sensor_id, umbral, condicion, fecha_creacion) VALUES (1, 10, 'IGUAL', 0)"],
        ["severidad", "INSERT INTO criterios (sensor_id, severidad, umbral, condicion, fecha_creacion) VALUES (1, 'LEVE', 10, 'SUPERA', 0)"],
        ["estado de alerta", "INSERT INTO alertas (medicion_id, criterio_id, nombre, tipo, mensaje, estado, fecha) VALUES (1, 1, 'n', 't', 'm', 'ARCHIVADA', 0)"],
        ["canal de notificación", "INSERT INTO notificaciones (alerta_id, canal) VALUES (1, 'TELEGRAM')"],
        ["estado de notificación", "INSERT INTO notificaciones (alerta_id, canal, estado) VALUES (1, 'CORREO', 'PERDIDA')"],
    ];

    test.each(casos)("[T0.3] rechaza un valor no permitido en %s", (_campo, consulta) => {
        expect(errorSqlite(() => bd.$client.prepare(consulta).run())).toMatch(/CHECK constraint failed/);
    });
});

describe("conexión", () => {
    test("[T0.3] una base en archivo queda en modo WAL", () => {
        const carpeta = mkdtempSync(join(tmpdir(), "lorax-"));
        try {
            const archivo = crearConexion(join(carpeta, "prueba.db"));
            expect(archivo.$client.pragma("journal_mode", { simple: true })).toBe("wal");
            archivo.$client.close();
        } finally {
            rmSync(carpeta, { recursive: true, force: true });
        }
    });
});

describe("llaves foráneas", () => {
    test("[T0.3] están activas", () => {
        expect(bd.$client.pragma("foreign_keys", { simple: true })).toBe(1);
        const error = errorSqlite(() => bd.insert(clientes).values({ empresaId: 9999, cuentaId: 9999 }).run());
        expect(error).toMatch(/FOREIGN KEY constraint failed/);
    });
});
