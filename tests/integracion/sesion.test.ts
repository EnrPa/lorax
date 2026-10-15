import { eq } from "drizzle-orm";
import { SignJWT } from "jose";
import { beforeAll, describe, expect, test } from "vitest";
import { ErrorApi } from "~/server/api/errores";
import { COOKIE_SESION } from "~/server/auth/cookie";
import { requireRol, requireSesion } from "~/server/auth/guardas";
import { crearSesion, revocarSesion, validarSesion } from "~/server/auth/sesiones";
import type { BaseDatos } from "~/server/db/cliente";
import { cuentas, eventos, sesiones } from "~/server/db/esquema";
import { crearBdPrueba, crearCuenta } from "./bd";

let bd: BaseDatos;
let productor: Awaited<ReturnType<typeof crearCuenta>>;
let administrador: Awaited<ReturnType<typeof crearCuenta>>;

beforeAll(async () => {
    bd = crearBdPrueba();
    productor = await crearCuenta(bd, { correo: "productor@ejemplo.cl", contrasena: null });
    administrador = await crearCuenta(bd, { correo: "admin@ejemplo.cl", rol: "ADMINISTRADOR", contrasena: null });
});

function solicitud(token?: string, ruta = "/api/v1/prueba") {
    return new Request(`http://localhost:3000${ruta}`, {
        headers: token ? { cookie: `otra=1; ${COOKIE_SESION}=${token}` } : {},
    });
}

async function motivoDe401(token?: string): Promise<string> {
    const error = await requireSesion(solicitud(token), bd).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorApi);
    expect(error.estado).toBe(401);
    return error.codigo;
}

describe("validez de la sesión", () => {
    test("[P-SEG-SESION] un token válido da acceso con los datos de la cuenta", async () => {
        const { token } = await crearSesion(bd, productor, false);
        const sesion = await requireSesion(solicitud(token), bd);
        expect(sesion.cuenta).toEqual({
            id: productor.id,
            nombre: "Nombre",
            apellido: "Apellido",
            correo: "productor@ejemplo.cl",
            rol: "PRODUCTOR",
        });
    });

    test("[P-SEG-SESION] sin token responde 401", async () => {
        expect(await motivoDe401()).toBe("NO_AUTENTICADO");
    });

    test("[P-SEG-SESION] un token vencido responde 401", async () => {
        const hace9Horas = new Date(Date.now() - 9 * 3_600_000);
        const { token } = await crearSesion(bd, productor, false, hace9Horas);
        expect(await validarSesion(bd, token)).toBeNull();
        expect(await motivoDe401(token)).toBe("NO_AUTENTICADO");
    });

    test("[P-SEG-SESION] un token alterado responde 401", async () => {
        const { token } = await crearSesion(bd, productor, false);
        const [cabecera, carga, firma] = token.split(".");
        const firmaAlterada = (firma[0] === "A" ? "B" : "A") + firma.slice(1);
        expect(await motivoDe401(`${cabecera}.${carga}.${firmaAlterada}`)).toBe("NO_AUTENTICADO");

        // Carga cambiada para hacerse pasar por administrador, con la firma original.
        const cargaAdmin = Buffer.from(
            JSON.stringify({ ...JSON.parse(Buffer.from(carga, "base64url").toString()), rol: "ADMINISTRADOR" }),
        ).toString("base64url");
        expect(await motivoDe401(`${cabecera}.${cargaAdmin}.${firma}`)).toBe("NO_AUTENTICADO");
    });

    test("[P-SEG-SESION] un token firmado con otra clave responde 401", async () => {
        const falso = await new SignJWT({ rol: "ADMINISTRADOR", sid: 1 })
            .setProtectedHeader({ alg: "HS256" })
            .setSubject(String(administrador.id))
            .setExpirationTime("1h")
            .sign(new TextEncoder().encode("otra-clave-cualquiera"));
        expect(await motivoDe401(falso)).toBe("NO_AUTENTICADO");
    });

    test("[P-SEG-SESION] un token revocado responde 401", async () => {
        const { token } = await crearSesion(bd, productor, false);
        const sesion = await requireSesion(solicitud(token), bd);
        revocarSesion(bd, sesion.sesionId);
        expect(await motivoDe401(token)).toBe("NO_AUTENTICADO");
    });

    test("[P-SEG-SESION] la tabla guarda el SHA-256 del token, no el token", async () => {
        const { token } = await crearSesion(bd, productor, false);
        const sesion = await requireSesion(solicitud(token), bd);
        const fila = bd.select().from(sesiones).where(eq(sesiones.id, sesion.sesionId)).get()!;
        expect(fila.tokenHash).toMatch(/^[0-9a-f]{64}$/);
        expect(fila.tokenHash).not.toContain(token);
    });

    test("[P-SEG-SESION] deshabilitar la cuenta invalida sus sesiones abiertas", async () => {
        const otra = await crearCuenta(bd, { correo: "otra@ejemplo.cl", contrasena: null });
        const { token } = await crearSesion(bd, otra, false);
        await requireSesion(solicitud(token), bd);
        bd.update(cuentas).set({ habilitada: false }).where(eq(cuentas.id, otra.id)).run();
        expect(await motivoDe401(token)).toBe("NO_AUTENTICADO");
    });
});

describe("guardas por rol", () => {
    test("[P-SEG-AISLAMIENTO] un productor recibe 403 en una ruta de administrador y queda registrado", async () => {
        const { token } = await crearSesion(bd, productor, false);
        const error = await requireRol(solicitud(token, "/api/v1/admin/cuentas"), ["ADMINISTRADOR"], bd).catch((e) => e);
        expect(error).toMatchObject({ codigo: "PROHIBIDO", estado: 403 });

        const evento = bd.select().from(eventos).where(eq(eventos.tipo, "ACCESO_DENEGADO")).get();
        expect(evento).toMatchObject({ cuentaId: productor.id, detalle: { ruta: "/api/v1/admin/cuentas", rol: "PRODUCTOR" } });
    });

    test("[P-SEG-AISLAMIENTO] el rol permitido pasa la guarda", async () => {
        const { token } = await crearSesion(bd, administrador, false);
        const sesion = await requireRol(solicitud(token), ["ADMINISTRADOR"], bd);
        expect(sesion.cuenta.rol).toBe("ADMINISTRADOR");
    });
});
