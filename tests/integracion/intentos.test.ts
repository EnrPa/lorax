import type { APIEvent } from "@solidjs/start/server";
import { and, eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, test } from "vitest";
import { POST as login } from "~/routes/api/v1/auth/login";
import { ErrorApi } from "~/server/api/errores";
import { finDelBloqueo, mensajeBloqueo } from "~/server/auth/intentos";
import type { BaseDatos } from "~/server/db/cliente";
import { eventos } from "~/server/db/esquema";
import { iniciarSesion } from "~/server/servicios/autenticacion";
import { CONTRASENA_PRUEBA, crearBdPrueba, crearCuenta, usarComoBdGlobal } from "./bd";

// RF01.9 (diseno.md §8.4): 5 fallos en 15 minutos para un mismo correo bloquean nuevos intentos durante
// 15 minutos. Los fallos se cuentan por el correo ingresado, exista o no la cuenta.

const MIN = 60_000;
const T0 = new Date("2026-10-07T12:00:00Z");
const en = (minutos: number) => new Date(T0.getTime() + minutos * MIN);

let bd: BaseDatos;

beforeAll(() => {
    bd = crearBdPrueba();
    usarComoBdGlobal(bd);
});

/** Intenta iniciar sesión y resume el resultado: «ok» o el código del error con su mensaje. */
async function intentar(correo: string, contrasena: string, ahora: Date) {
    try {
        await iniciarSesion(bd, { correo, contrasena, recordar: false }, ahora);
        return { codigo: "OK" as const };
    } catch (error) {
        if (!(error instanceof ErrorApi)) throw error;
        return { codigo: error.codigo, mensaje: error.message, encabezados: error.encabezados };
    }
}

async function fallar(correo: string, minutos: number[]) {
    for (const m of minutos) expect((await intentar(correo, "incorrecta-123", en(m))).codigo).not.toBe("DEMASIADOS_INTENTOS");
}

const eventosDe = (correo: string) =>
    bd
        .select()
        .from(eventos)
        .where(and(eq(eventos.tipo, "ACCESO_FALLIDO"), eq(sql`json_extract(${eventos.detalle}, '$.correo')`, correo)))
        .all();

describe("[P-FUN-CU01] Límite de intentos de inicio de sesión (RF01.9)", () => {
    test("[P-FUN-CU01] el quinto fallo todavía responde 401; después, 429 aunque la contraseña sea correcta", async () => {
        const correo = "bloqueo@ejemplo.cl";
        await crearCuenta(bd, { correo });
        for (const m of [0, 1, 2, 3, 4]) expect((await intentar(correo, "incorrecta-123", en(m))).codigo).toBe("NO_AUTENTICADO");

        const bloqueado = await intentar(correo, CONTRASENA_PRUEBA, en(5));
        expect(bloqueado).toMatchObject({
            codigo: "DEMASIADOS_INTENTOS",
            // Quinto fallo en el minuto 4: bloqueado hasta el minuto 19.
            mensaje: "Demasiados intentos. Vuelve a intentarlo en 14 minutos.",
            encabezados: { "Retry-After": String(14 * 60) },
        });
    });

    test("[P-FUN-CU01] el bloqueo dura 15 minutos desde el quinto fallo, y los intentos bloqueados no lo alargan", async () => {
        const correo = "espera@ejemplo.cl";
        await crearCuenta(bd, { correo });
        await fallar(correo, [0, 1, 2, 3, 4]);
        for (const m of [10, 15, 18.9]) expect((await intentar(correo, CONTRASENA_PRUEBA, en(m))).codigo).toBe("DEMASIADOS_INTENTOS");
        expect((await intentar(correo, "otra-incorrecta", en(18.99))).mensaje).toBe("Demasiados intentos. Vuelve a intentarlo en 1 minuto.");
        expect((await intentar(correo, CONTRASENA_PRUEBA, en(19))).codigo).toBe("OK");
    });

    test("[P-FUN-CU01] 5 fallos repartidos en más de 15 minutos no bloquean", async () => {
        const correo = "lento@ejemplo.cl";
        await crearCuenta(bd, { correo });
        await fallar(correo, [0, 4, 8, 12, 16]);
        expect((await intentar(correo, CONTRASENA_PRUEBA, en(17))).codigo).toBe("OK");
    });

    test("[P-FUN-CU01] un acceso exitoso no reinicia la ventana: 4 fallos, un acierto y otro fallo bloquean", async () => {
        const correo = "acierto@ejemplo.cl";
        await crearCuenta(bd, { correo });
        await fallar(correo, [0, 1, 2, 3]);
        expect((await intentar(correo, CONTRASENA_PRUEBA, en(4))).codigo).toBe("OK");
        expect((await intentar(correo, "incorrecta-123", en(5))).codigo).toBe("NO_AUTENTICADO");
        expect((await intentar(correo, CONTRASENA_PRUEBA, en(6))).codigo).toBe("DEMASIADOS_INTENTOS");
    });

    test("[P-FUN-CU01] un correo inexistente se bloquea igual, sin distinguir mayúsculas: el 429 no revela qué correos existen", async () => {
        const inexistente = "nadie@ejemplo.cl";
        const registrado = "registrado@ejemplo.cl";
        await crearCuenta(bd, { correo: registrado });
        await fallar(inexistente, [0, 1, 2]);
        await fallar("NADIE@Ejemplo.cl", [3, 4]);
        await fallar(registrado, [0, 1, 2, 3, 4]);

        const deInexistente = await intentar(inexistente, "lo-que-sea-123", en(5));
        const deRegistrado = await intentar(registrado, "lo-que-sea-123", en(5));
        expect(deInexistente).toEqual(deRegistrado);
        expect(deInexistente.codigo).toBe("DEMASIADOS_INTENTOS");
    });

    test("[P-FUN-CU01] los intentos con una cuenta deshabilitada cuentan como fallos", async () => {
        const correo = "deshabilitada@ejemplo.cl";
        await crearCuenta(bd, { correo, habilitada: false });
        for (const m of [0, 1, 2, 3, 4]) expect((await intentar(correo, CONTRASENA_PRUEBA, en(m))).codigo).toBe("PROHIBIDO");
        expect((await intentar(correo, CONTRASENA_PRUEBA, en(5))).codigo).toBe("DEMASIADOS_INTENTOS");
    });

    test("[P-FUN-CU01] cada intento fallido queda como evento sin responsable y sin la contraseña", async () => {
        const correo = "eventos@ejemplo.cl";
        await crearCuenta(bd, { correo });
        await fallar(correo, [0, 1, 2, 3, 4]);
        await intentar(correo, "SecretoQueNoDebeGuardarse", en(5));

        const registrados = eventosDe(correo);
        expect(registrados.map((e) => (e.detalle as { causa: string }).causa)).toEqual([
            ...Array(5).fill("CREDENCIALES_INVALIDAS"),
            "INTENTOS_EXCEDIDOS",
        ]);
        for (const e of registrados) {
            expect(e.cuentaId).toBeNull();
            expect(e.detalle).toEqual({ correo, causa: expect.any(String) });
            expect(JSON.stringify(e)).not.toMatch(/incorrecta|SecretoQueNoDebeGuardarse/);
        }
    });

    test("[P-FUN-CU01] la API responde 429 DEMASIADOS_INTENTOS con Retry-After", async () => {
        const correo = "api-bloqueo@ejemplo.cl";
        await crearCuenta(bd, { correo });
        const pedir = (contrasena: string) =>
            login({
                request: new Request("http://localhost:3000/api/v1/auth/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ correo, contrasena, recordar: false }),
                }),
            } as unknown as APIEvent);
        for (let i = 0; i < 5; i++) expect((await pedir("incorrecta-123")).status).toBe(401);

        const res = await pedir(CONTRASENA_PRUEBA);
        expect(res.status).toBe(429);
        expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(14 * 60);
        expect(await res.json()).toEqual({
            error: { codigo: "DEMASIADOS_INTENTOS", mensaje: "Demasiados intentos. Vuelve a intentarlo en 15 minutos." },
        });
        expect(res.headers.get("Set-Cookie")).toBeNull();
    });

    test("[P-FUN-CU01] reglas del cálculo del bloqueo", () => {
        const m = (minutos: number) => minutos * MIN;
        expect(finDelBloqueo([m(0), m(1), m(2), m(3)], m(4))).toBeNull();
        expect(finDelBloqueo([m(0), m(1), m(2), m(3), m(15)], m(16))).toBe(m(30)); // justo 15 min: cuenta
        expect(finDelBloqueo([m(0), m(1), m(2), m(3), m(15.01)], m(16))).toBeNull();
        expect(finDelBloqueo([m(0), m(1), m(2), m(3), m(4)], m(19))).toBeNull(); // ya terminó
        expect(mensajeBloqueo(1)).toBe("Demasiados intentos. Vuelve a intentarlo en 1 minuto.");
        expect(mensajeBloqueo(15)).toBe("Demasiados intentos. Vuelve a intentarlo en 15 minutos.");
    });
});
