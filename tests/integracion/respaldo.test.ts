import type { APIEvent } from "@solidjs/start/server";
import { count } from "drizzle-orm";
import { existsSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { sumarDias } from "~/lib/fechas";
import { GET as salud } from "~/routes/api/salud";
import { crearConexion, type BaseDatos } from "~/server/db/cliente";
import { cuentas, eventos } from "~/server/db/esquema";
import { aplicarMigraciones } from "~/server/db/migrar";
import { crearRespaldo, listarRespaldos, RETENCION_DIAS, ultimoRespaldo } from "~/server/respaldos/respaldo";
import { contarFilas, restaurar } from "~/server/respaldos/restauracion";
import { consultarSalud } from "~/server/servicios/salud";
import { crearBdPrueba, crearCuenta, usarComoBdGlobal } from "./bd";

// RNF04 (diseno.md §11): respaldo diario con retención de 30 días y restauración verificada por conteos.
// Usa archivos reales en una carpeta temporal: el respaldo y la restauración trabajan sobre archivos.

const HOY = new Date("2026-10-07T15:00:00Z"); // 12:00 en Chile: día «2026-10-07»
const DIA = "2026-10-07";

let carpeta: string;
let archivoBd: string;
let bd: BaseDatos;

beforeAll(async () => {
    carpeta = mkdtempSync(join(tmpdir(), "lorax-respaldos-"));
    archivoBd = join(carpeta, "lorax.db");
    bd = crearConexion(archivoBd);
    aplicarMigraciones(bd);
    await crearCuenta(bd, { correo: "uno@ejemplo.cl", contrasena: null });
    await crearCuenta(bd, { correo: "dos@ejemplo.cl", contrasena: null });
    bd.insert(eventos).values({ tipo: "ACCESO_FALLIDO", detalle: { correo: "x@y.cl", causa: "CREDENCIALES_INVALIDAS" }, fecha: HOY }).run();
});

afterAll(() => {
    if (bd.$client.open) bd.$client.close();
});

const respaldos = () => join(carpeta, "respaldos");
const filasCuentas = (b: BaseDatos) => b.select({ n: count() }).from(cuentas).get()!.n;

describe("[P-INF-RESPALDO] Respaldo diario y restauración", () => {
    test("[P-INF-RESPALDO] crea el respaldo del día con VACUUM INTO, con nombre del día de Chile, y no lo repite", () => {
        const primero = crearRespaldo(bd, HOY, respaldos());
        expect(primero).toMatchObject({ creado: true, archivo: join(respaldos(), `lorax-${DIA}.db`) });
        expect(contarFilas(primero.archivo)).toMatchObject({ cuentas: 2, eventos: 1 });

        expect(crearRespaldo(bd, new Date(HOY.getTime() + 6 * 3_600_000), respaldos()).creado).toBe(false);
        expect(listarRespaldos(respaldos()).map((r) => r.dia)).toEqual([DIA]);
        expect(readdirSync(respaldos()).some((f) => f.endsWith(".tmp"))).toBe(false);
    });

    test(`[P-INF-RESPALDO] conserva ${RETENCION_DIAS} días y borra los más antiguos, sin tocar otros archivos`, () => {
        const otraCarpeta = mkdtempSync(join(tmpdir(), "lorax-retencion-"));
        for (const dias of [-45, -31, -30, -29, -1]) writeFileSync(join(otraCarpeta, `lorax-${sumarDias(DIA, dias)}.db`), "");
        writeFileSync(join(otraCarpeta, "notas.txt"), "");
        writeFileSync(join(otraCarpeta, "antes-de-restaurar-2020-01-01-00-00-00.db"), "");

        const { eliminados } = crearRespaldo(bd, HOY, otraCarpeta);
        expect(eliminados.sort()).toEqual([-45, -31, -30].map((d) => join(otraCarpeta, `lorax-${sumarDias(DIA, d)}.db`)).sort());
        expect(listarRespaldos(otraCarpeta).map((r) => r.dia)).toEqual([sumarDias(DIA, -29), sumarDias(DIA, -1), DIA]);
        expect(existsSync(join(otraCarpeta, "notas.txt"))).toBe(true);
        expect(existsSync(join(otraCarpeta, "antes-de-restaurar-2020-01-01-00-00-00.db"))).toBe(true);
    });

    test("[P-INF-RESPALDO] restaura un respaldo después de cambios y verifica los conteos de cada tabla", async () => {
        const respaldo = join(respaldos(), `lorax-${DIA}.db`);
        await crearCuenta(bd, { correo: "tres@ejemplo.cl", contrasena: null });
        expect(filasCuentas(bd)).toBe(3);
        bd.$client.close(); // con la aplicación detenida

        const { conteos, copiaPrevia } = restaurar(respaldo, archivoBd, respaldos(), HOY);
        expect(conteos.find((c) => c.tabla === "cuentas")).toEqual({ tabla: "cuentas", respaldo: 2, restaurada: 2 });
        for (const c of conteos) expect(c.restaurada).toBe(c.respaldo);
        expect(conteos.map((c) => c.tabla)).toEqual(expect.arrayContaining(["mediciones", "eventos", "alertas"]));

        // La copia previa guarda la base como estaba, con la cuenta nueva.
        expect(copiaPrevia).toMatch(/antes-de-restaurar-2026-10-07-15-00-00\.db$/);
        expect(contarFilas(copiaPrevia!).cuentas).toBe(3);

        // La base restaurada funciona y conserva el trigger que impide modificar mediciones.
        bd = crearConexion(archivoBd);
        expect(filasCuentas(bd)).toBe(2);
        const triggers = bd.$client.prepare("SELECT name FROM sqlite_master WHERE type = 'trigger'").all() as Array<{ name: string }>;
        expect(triggers.map((t) => t.name)).toEqual(expect.arrayContaining(["mediciones_sin_update", "mediciones_sin_delete"]));
    });

    test("[P-INF-RESPALDO] un archivo dañado o inexistente se rechaza sin tocar la base", () => {
        const danado = join(carpeta, "danado.db");
        writeFileSync(danado, "esto no es una base de datos SQLite, solo texto");
        bd.$client.close();
        expect(() => restaurar(danado, archivoBd, respaldos(), HOY)).toThrow(/no es una base de datos válida/);
        expect(() => restaurar(join(carpeta, "no-existe.db"), archivoBd, respaldos(), HOY)).toThrow(/No existe el archivo/);
        expect(() => restaurar(archivoBd, archivoBd, respaldos(), HOY)).toThrow(/mismo archivo/);
        bd = crearConexion(archivoBd);
        expect(filasCuentas(bd)).toBe(2);
    });
});

describe("[P-INF-MONITOREO] Salud del servicio", () => {
    test("[P-INF-MONITOREO] informa base, notificaciones pendientes y fallidas, y último respaldo", () => {
        process.env.RESPALDOS_DIR = respaldos();
        try {
            const sinDatos = crearBdPrueba();
            expect(consultarSalud(sinDatos)).toMatchObject({ estado: "ok", notificaciones: { pendientes: 0, fallidas: 0 } });

            // Notificaciones en cada estado (sin la cadena de alertas: solo importa el conteo).
            const conNotif = crearBdPrueba();
            conNotif.$client.pragma("foreign_keys = OFF");
            const insertar = conNotif.$client.prepare("INSERT INTO notificaciones (alerta_id, canal, estado, intentos, error) VALUES (1, 'CORREO', ?, ?, ?)");
            insertar.run("PENDIENTE", 0, null);
            insertar.run("FALLIDA", 2, "Falla simulada (NOTIF_SIMULAR_FALLO)"); // se reintentará
            insertar.run("FALLIDA", 5, "Falla simulada (NOTIF_SIMULAR_FALLO)"); // tope alcanzado
            insertar.run("FALLIDA", 1, "La cuenta no tiene teléfono registrado"); // permanente
            insertar.run("ENVIADA", 1, null);

            const estado = consultarSalud(conNotif);
            expect(estado.notificaciones).toEqual({ pendientes: 2, fallidas: 2 });
            expect(estado.ultimoRespaldo?.fecha).toBe(ultimoRespaldo(respaldos())!.fecha.toISOString());
        } finally {
            delete process.env.RESPALDOS_DIR;
        }
    });

    test("[P-INF-MONITOREO] ante una falla de la base, /api/salud responde 503 con estado «error»", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const caida = crearBdPrueba();
        caida.$client.close();
        usarComoBdGlobal(caida);
        const res = await salud({ request: new Request("http://localhost:3000/api/salud") } as unknown as APIEvent);
        expect(res.status).toBe(503);
        expect(res.headers.get("Cache-Control")).toBe("no-store");
        expect(await res.json()).toMatchObject({ estado: "error", bd: { ok: false }, notificaciones: null });
    });
});
