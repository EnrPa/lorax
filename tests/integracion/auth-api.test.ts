import type { APIEvent } from "@solidjs/start/server";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, test } from "vitest";
import { POST as login } from "~/routes/api/v1/auth/login";
import { POST as logout } from "~/routes/api/v1/auth/logout";
import { GET as sesion } from "~/routes/api/v1/auth/sesion";
import { COOKIE_SESION } from "~/server/auth/cookie";
import type { BaseDatos } from "~/server/db/cliente";
import { sesiones } from "~/server/db/esquema";
import { MENSAJE_CREDENCIALES_INVALIDAS, MENSAJE_CUENTA_NO_DISPONIBLE } from "~/server/servicios/autenticacion";
import { CONTRASENA_PRUEBA, crearBdPrueba, crearCuenta, usarComoBdGlobal } from "./bd";

const URL_BASE = "http://localhost:3000/api/v1/auth";
let bd: BaseDatos;

beforeAll(async () => {
    bd = crearBdPrueba();
    usarComoBdGlobal(bd);
    await crearCuenta(bd, { correo: "maria@ejemplo.cl" });
    await crearCuenta(bd, { correo: "admin@ejemplo.cl", rol: "ADMINISTRADOR" });
    await crearCuenta(bd, { correo: "deshabilitada@ejemplo.cl", habilitada: false });
    await crearCuenta(bd, { correo: "pendiente@ejemplo.cl", contrasena: null });
});

const evento = (request: Request) => ({ request }) as APIEvent;

function pedirLogin(cuerpo: unknown) {
    return login(
        evento(
            new Request(`${URL_BASE}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(cuerpo),
            }),
        ),
    );
}

function conCookie(ruta: string, token: string | null, metodo = "GET") {
    return evento(
        new Request(`${URL_BASE}/${ruta}`, { method: metodo, headers: token ? { cookie: `${COOKIE_SESION}=${token}` } : {} }),
    );
}

/** Extrae el token y los atributos del encabezado Set-Cookie. */
function leerCookie(respuesta: Response) {
    const cabecera = respuesta.headers.get("set-cookie") ?? "";
    const [par, ...atributos] = cabecera.split("; ");
    return { token: par.split("=")[1], atributos, cabecera };
}

describe("inicio de sesión (CU01)", () => {
    test("[P-FUN-CU01] con credenciales válidas crea una sesión con cookie HttpOnly y devuelve la cuenta y su rol", async () => {
        const respuesta = await pedirLogin({ correo: "maria@ejemplo.cl", contrasena: CONTRASENA_PRUEBA, recordar: false });
        expect(respuesta.status).toBe(200);
        const { cuenta } = await respuesta.json();
        expect(cuenta).toMatchObject({ correo: "maria@ejemplo.cl", rol: "PRODUCTOR" });
        expect(cuenta).not.toHaveProperty("contrasenaHash");

        const { token, atributos } = leerCookie(respuesta);
        expect(token).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
        expect(atributos).toEqual(expect.arrayContaining(["HttpOnly", "SameSite=Lax", "Path=/"]));
    });

    test("[P-FUN-CU01] el administrador recibe su rol para ir a /admin", async () => {
        const respuesta = await pedirLogin({ correo: "admin@ejemplo.cl", contrasena: CONTRASENA_PRUEBA });
        expect((await respuesta.json()).cuenta.rol).toBe("ADMINISTRADOR");
    });

    test("[P-FUN-CU01] el correo no distingue mayúsculas ni espacios", async () => {
        const respuesta = await pedirLogin({ correo: "  MARIA@Ejemplo.CL ", contrasena: CONTRASENA_PRUEBA });
        expect(respuesta.status).toBe(200);
    });

    test("[P-FUN-CU01] credenciales inválidas: mismo mensaje genérico exista o no el correo", async () => {
        const casos = [
            { correo: "maria@ejemplo.cl", contrasena: "incorrecta-123" },
            { correo: "nadie@ejemplo.cl", contrasena: CONTRASENA_PRUEBA },
            { correo: "pendiente@ejemplo.cl", contrasena: CONTRASENA_PRUEBA },
            { correo: "deshabilitada@ejemplo.cl", contrasena: "incorrecta-123" },
        ];
        for (const caso of casos) {
            const respuesta = await pedirLogin(caso);
            expect(respuesta.status, caso.correo).toBe(401);
            expect(respuesta.headers.get("set-cookie")).toBeNull();
            expect(await respuesta.json()).toEqual({
                error: { codigo: "NO_AUTENTICADO", mensaje: MENSAJE_CREDENCIALES_INVALIDAS },
            });
        }
    });

    test("[P-FUN-CU01] una cuenta deshabilitada no puede iniciar sesión y el mensaje lo indica", async () => {
        const respuesta = await pedirLogin({ correo: "deshabilitada@ejemplo.cl", contrasena: CONTRASENA_PRUEBA });
        expect(respuesta.status).toBe(403);
        expect(respuesta.headers.get("set-cookie")).toBeNull();
        expect(await respuesta.json()).toEqual({ error: { codigo: "PROHIBIDO", mensaje: MENSAJE_CUENTA_NO_DISPONIBLE } });
    });

    test("[P-FUN-CU01] campos vacíos o correo inválido responden con el error de cada campo", async () => {
        const vacios = await pedirLogin({ correo: "", contrasena: "" });
        expect(vacios.status).toBe(400);
        expect((await vacios.json()).error.campos).toEqual({ correo: "Escribe tu correo.", contrasena: "Escribe tu contraseña." });

        const invalido = await pedirLogin({ correo: "maria-arroba-ejemplo", contrasena: "x" });
        expect((await invalido.json()).error.campos.correo).toMatch(/correo válido/);
    });

    test("[P-FUN-CU01] «mantener sesión iniciada» dura 30 días; si no, 8 horas", async () => {
        for (const [recordar, horas] of [[true, 30 * 24], [false, 8]] as const) {
            const antes = Date.now();
            const respuesta = await pedirLogin({ correo: "maria@ejemplo.cl", contrasena: CONTRASENA_PRUEBA, recordar });
            const { atributos, token } = leerCookie(respuesta);
            const maxAge = Number(atributos.find((a) => a.startsWith("Max-Age="))!.split("=")[1]);
            expect(maxAge).toBeGreaterThan(horas * 3600 - 5);
            expect(maxAge).toBeLessThanOrEqual(horas * 3600);

            const { id } = await (await sesion(conCookie("sesion", token))).json();
            const fila = bd.select().from(sesiones).where(eq(sesiones.cuentaId, id)).orderBy(sesiones.id).all().at(-1)!;
            const duracion = fila.fechaExpiracion.getTime() - fila.fechaCreacion.getTime();
            expect(duracion).toBe(horas * 3_600_000);
            expect(fila.fechaCreacion.getTime()).toBeGreaterThanOrEqual(antes);
        }
    });
});

describe("sesión y cierre de sesión (CU01)", () => {
    test("[P-FUN-CU01] /auth/sesion devuelve la cuenta de la sesión y sin cookie responde 401", async () => {
        const { token } = leerCookie(await pedirLogin({ correo: "maria@ejemplo.cl", contrasena: CONTRASENA_PRUEBA }));
        const conSesion = await sesion(conCookie("sesion", token));
        expect(conSesion.status).toBe(200);
        expect(Object.keys(await conSesion.json()).sort()).toEqual(["apellido", "correo", "id", "nombre", "rol"]);

        const sinSesion = await sesion(conCookie("sesion", null));
        expect(sinSesion.status).toBe(401);
        expect((await sinSesion.json()).error.codigo).toBe("NO_AUTENTICADO");
    });

    test("[P-FUN-CU01] cerrar sesión la invalida en el servidor, no solo en el navegador", async () => {
        const { token } = leerCookie(await pedirLogin({ correo: "maria@ejemplo.cl", contrasena: CONTRASENA_PRUEBA }));
        const salida = await logout(conCookie("logout", token, "POST"));
        expect(salida.status).toBe(204);
        expect(leerCookie(salida).cabecera).toMatch(new RegExp(`^${COOKIE_SESION}=;.*Max-Age=0`));

        // El mismo token, reenviado a mano, ya no sirve.
        expect((await sesion(conCookie("sesion", token))).status).toBe(401);
        expect((await logout(conCookie("logout", token, "POST"))).status).toBe(401);
    });
});
