import type { APIEvent } from "@solidjs/start/server";
import { eq } from "drizzle-orm";
import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { MENSAJE_RECUPERACION } from "~/lib/esquemas/auth";
import { GET as bandeja } from "~/routes/api/v1/dev/correos";
import { POST as recuperar } from "~/routes/api/v1/auth/recuperar";
import { POST as restablecer } from "~/routes/api/v1/auth/restablecer";
import { crearEnlace } from "~/server/auth/enlaces";
import { crearSesion, validarSesion } from "~/server/auth/sesiones";
import { carpetaCorreos } from "~/server/config";
import { listarCorreos } from "~/server/correo/correo";
import type { BaseDatos } from "~/server/db/cliente";
import { tokensRecuperacion } from "~/server/db/esquema";
import { iniciarSesion } from "~/server/servicios/autenticacion";
import { MENSAJE_ENLACE_INVALIDO } from "~/server/servicios/recuperacion";
import { CONTRASENA_PRUEBA, crearBdPrueba, crearCuenta, usarComoBdGlobal } from "./bd";

const NUEVA = "UnaFraseNuevaYLarga2026";
let bd: BaseDatos;

beforeAll(async () => {
    bd = crearBdPrueba();
    usarComoBdGlobal(bd);
    // Carpeta de correos propia: con una compartida, otro archivo que corre en paralelo la vaciaba a mitad de una prueba.
    process.env.CORREOS_DIR = mkdtempSync(join(tmpdir(), "lorax-correos-recuperacion-"));
    await crearCuenta(bd, { correo: "maria@ejemplo.cl" });
    await crearCuenta(bd, { correo: "jose@ejemplo.cl" });
    await crearCuenta(bd, { correo: "deshabilitada@ejemplo.cl", habilitada: false });
});

beforeEach(async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    await rm(carpetaCorreos(), { recursive: true, force: true });
});

function post(handler: (e: APIEvent) => Promise<Response>, ruta: string, cuerpo: unknown) {
    return handler({
        request: new Request(`http://localhost:3000/api/v1/auth/${ruta}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(cuerpo),
        }),
    } as APIEvent);
}

/** Pide el enlace y lo extrae del correo escrito a archivo. */
async function pedirEnlace(correo: string): Promise<string> {
    await post(recuperar, "recuperar", { correo });
    const [ultimo] = await listarCorreos();
    const enlace = /https?:\/\/\S+\/restablecer\?token=(\S+)/.exec(ultimo.texto);
    if (!enlace) throw new Error("El correo no trae el enlace");
    return decodeURIComponent(enlace[1]);
}

const puedeEntrar = (correo: string, contrasena: string) =>
    iniciarSesion(bd, { correo, contrasena, recordar: false }).then(
        () => true,
        () => false,
    );

describe("solicitud del enlace (RF01.5)", () => {
    test("[P-FUN-CU01] responde siempre 202 con el mismo mensaje, exista o no la cuenta", async () => {
        for (const correo of ["maria@ejemplo.cl", "nadie@ejemplo.cl", "deshabilitada@ejemplo.cl"]) {
            const respuesta = await post(recuperar, "recuperar", { correo });
            expect(respuesta.status, correo).toBe(202);
            expect(await respuesta.json()).toEqual({ mensaje: MENSAJE_RECUPERACION });
        }
    });

    test("[P-FUN-CU01] solo se envía el correo si la cuenta existe y está habilitada", async () => {
        for (const correo of ["nadie@ejemplo.cl", "deshabilitada@ejemplo.cl", "MARIA@ejemplo.cl"]) {
            await post(recuperar, "recuperar", { correo });
        }
        const correos = await listarCorreos();
        expect(correos).toHaveLength(1);
        expect(correos[0]).toMatchObject({ para: "maria@ejemplo.cl", de: "LoRax <no-responder@lorax.local>" });
        expect(correos[0].texto).toContain("http://localhost:3000/restablecer?token=");
    });

    test("[P-FUN-CU01] se guarda el SHA-256 del enlace, que vence en 1 hora", async () => {
        const antes = Date.now();
        const token = await pedirEnlace("maria@ejemplo.cl");
        const fila = bd.select().from(tokensRecuperacion).orderBy(tokensRecuperacion.id).all().at(-1)!;
        expect(fila.tokenHash).toMatch(/^[0-9a-f]{64}$/);
        expect(fila.tokenHash).not.toBe(token);
        expect(Buffer.from(token, "base64url")).toHaveLength(32);
        const vigencia = fila.fechaExpiracion.getTime() - fila.fechaCreacion.getTime();
        expect(vigencia).toBe(3_600_000);
        expect(fila.fechaCreacion.getTime()).toBeGreaterThanOrEqual(antes);
    });

    test("[P-FUN-CU01] un correo inválido responde con el error del campo", async () => {
        const respuesta = await post(recuperar, "recuperar", { correo: "no-es-correo" });
        expect(respuesta.status).toBe(400);
        expect((await respuesta.json()).error.campos.correo).toMatch(/correo válido/);
    });
});

describe("restablecimiento (RF01.5)", () => {
    test("[P-FUN-CU01] el enlace permite definir una contraseña nueva y revoca las sesiones abiertas", async () => {
        const cuenta = await crearCuenta(bd, { correo: "ana@ejemplo.cl" });
        const { token: sesionAnterior } = await crearSesion(bd, cuenta, true);

        const enlace = await pedirEnlace("ana@ejemplo.cl");
        const respuesta = await post(restablecer, "restablecer", { token: enlace, contrasena: NUEVA });
        expect(respuesta.status).toBe(204);
        expect(respuesta.headers.get("set-cookie")).toBeNull(); // no inicia sesión

        expect(await validarSesion(bd, sesionAnterior)).toBeNull();
        expect(await puedeEntrar("ana@ejemplo.cl", NUEVA)).toBe(true);
        expect(await puedeEntrar("ana@ejemplo.cl", CONTRASENA_PRUEBA)).toBe(false);
    });

    test("[P-FUN-CU01] el enlace es de un solo uso", async () => {
        const enlace = await pedirEnlace("jose@ejemplo.cl");
        expect((await post(restablecer, "restablecer", { token: enlace, contrasena: NUEVA })).status).toBe(204);

        const segunda = await post(restablecer, "restablecer", { token: enlace, contrasena: "OtraFraseDistinta2026" });
        expect(segunda.status).toBe(422);
        expect(await segunda.json()).toEqual({ error: { codigo: "NO_PROCESABLE", mensaje: MENSAJE_ENLACE_INVALIDO } });
        expect(await puedeEntrar("jose@ejemplo.cl", NUEVA)).toBe(true);
    });

    test("[P-FUN-CU01] pedir un enlace nuevo invalida los anteriores no usados", async () => {
        const primero = await pedirEnlace("maria@ejemplo.cl");
        const segundo = await pedirEnlace("maria@ejemplo.cl");
        expect((await post(restablecer, "restablecer", { token: primero, contrasena: NUEVA })).status).toBe(422);
        expect((await post(restablecer, "restablecer", { token: segundo, contrasena: NUEVA })).status).toBe(204);
    });

    test("[P-FUN-CU01] un enlace vencido no sirve", async () => {
        const cuenta = await crearCuenta(bd, { correo: "vencido@ejemplo.cl" });
        const hace2Horas = new Date(Date.now() - 2 * 3_600_000);
        const enlace = crearEnlace(bd, cuenta.id, "RECUPERACION", hace2Horas);
        expect((await post(restablecer, "restablecer", { token: enlace, contrasena: NUEVA })).status).toBe(422);
    });

    test("[P-FUN-CU01] un enlace inventado no sirve", async () => {
        const respuesta = await post(restablecer, "restablecer", { token: "inventado", contrasena: NUEVA });
        expect(respuesta.status).toBe(422);
    });

    test("[P-FUN-CU01] la contraseña nueva debe tener entre 12 y 128 caracteres", async () => {
        for (const contrasena of ["corta", "x".repeat(129)]) {
            const respuesta = await post(restablecer, "restablecer", { token: "cualquiera", contrasena });
            expect(respuesta.status).toBe(400);
            expect((await respuesta.json()).error.campos.contrasena).toMatch(/12 caracteres|128 caracteres/);
        }
    });

    test("[P-FUN-CU01] el enlace de activación define la primera contraseña de una cuenta pendiente", async () => {
        const cuenta = await crearCuenta(bd, { correo: "pendiente@ejemplo.cl", contrasena: null });
        expect(await puedeEntrar("pendiente@ejemplo.cl", NUEVA)).toBe(false);

        const enlace = crearEnlace(bd, cuenta.id, "ACTIVACION");
        const fila = bd.select().from(tokensRecuperacion).where(eq(tokensRecuperacion.cuentaId, cuenta.id)).get()!;
        expect(fila.fechaExpiracion.getTime() - fila.fechaCreacion.getTime()).toBe(72 * 3_600_000);

        expect((await post(restablecer, "restablecer", { token: enlace, contrasena: NUEVA })).status).toBe(204);
        expect(await puedeEntrar("pendiente@ejemplo.cl", NUEVA)).toBe(true);
    });
});

describe("bandeja de correos de desarrollo", () => {
    test("[P-FUN-CU01] lista los correos del más nuevo al más antiguo", async () => {
        await post(recuperar, "recuperar", { correo: "maria@ejemplo.cl" });
        await new Promise((r) => setTimeout(r, 5));
        await post(recuperar, "recuperar", { correo: "jose@ejemplo.cl" });

        const respuesta = await bandeja({} as APIEvent);
        expect(respuesta.status).toBe(200);
        const { items } = await respuesta.json();
        expect(items.map((c: { para: string }) => c.para)).toEqual(["jose@ejemplo.cl", "maria@ejemplo.cl"]);
    });
});
