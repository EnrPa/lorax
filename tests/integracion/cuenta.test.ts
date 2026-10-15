import type { APIEvent } from "@solidjs/start/server";
import { beforeAll, describe, expect, test } from "vitest";
import { POST as cambiarContrasena } from "~/routes/api/v1/cuenta/contrasena";
import { GET as leerPerfil, PATCH as editarPerfil } from "~/routes/api/v1/cuenta/index";
import { COOKIE_SESION } from "~/server/auth/cookie";
import { crearSesion } from "~/server/auth/sesiones";
import type { BaseDatos } from "~/server/db/cliente";
import { clientes, empresas } from "~/server/db/esquema";
import { iniciarSesion } from "~/server/servicios/autenticacion";
import { CONTRASENA_PRUEBA, crearBdPrueba, crearCuenta, usarComoBdGlobal } from "./bd";

let bd: BaseDatos;
let tokenProductor: string;
let tokenAdministrador: string;

beforeAll(async () => {
    bd = crearBdPrueba();
    usarComoBdGlobal(bd);
    const productor = await crearCuenta(bd, { correo: "maria@ejemplo.cl" });
    const administrador = await crearCuenta(bd, { correo: "admin@ejemplo.cl", rol: "ADMINISTRADOR" });
    const empresa = bd.insert(empresas).values({ nombre: "Agrícola Prueba SpA", rut: "76.123.456-0" }).returning().get();
    bd.insert(clientes).values({ cargo: "Dueña", empresaId: empresa.id, cuentaId: productor.id }).run();
    tokenProductor = (await crearSesion(bd, productor, false)).token;
    tokenAdministrador = (await crearSesion(bd, administrador, false)).token;
});

function pedir(handler: (e: APIEvent) => Promise<Response>, metodo: string, token: string | null, cuerpo?: unknown) {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.cookie = `${COOKIE_SESION}=${token}`;
    return handler({
        request: new Request("http://localhost:3000/api/v1/cuenta", {
            method: metodo,
            headers,
            body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
        }),
    } as APIEvent);
}

const editar = (cuerpo: unknown) => pedir(editarPerfil, "PATCH", tokenProductor, cuerpo);

describe("perfil", () => {
    test("[T1.5] el productor ve su perfil con empresa y cargo, solo de lectura", async () => {
        const respuesta = await pedir(leerPerfil, "GET", tokenProductor);
        expect(respuesta.status).toBe(200);
        expect(await respuesta.json()).toEqual({
            nombre: "Nombre",
            apellido: "Apellido",
            correo: "maria@ejemplo.cl",
            telefono: null,
            rol: "PRODUCTOR",
            empresa: { nombre: "Agrícola Prueba SpA", rut: "76.123.456-0" },
            cargo: "Dueña",
        });
    });

    test("[T1.5] el administrador no tiene empresa ni cargo", async () => {
        const perfil = await (await pedir(leerPerfil, "GET", tokenAdministrador)).json();
        expect(perfil).toMatchObject({ rol: "ADMINISTRADOR", empresa: null, cargo: null });
    });

    test("[T1.5] se editan nombre, apellido y teléfono; lo demás se ignora", async () => {
        const respuesta = await editar({
            nombre: "  María ",
            apellido: "González",
            telefono: "+56912345678",
            correo: "otro@ejemplo.cl",
            rol: "ADMINISTRADOR",
            cargo: "Gerente",
        });
        expect(respuesta.status).toBe(200);
        expect(await respuesta.json()).toMatchObject({
            nombre: "María",
            apellido: "González",
            telefono: "+56912345678",
            correo: "maria@ejemplo.cl",
            rol: "PRODUCTOR",
            cargo: "Dueña",
        });
    });

    test("[T1.5] el teléfono va en formato E.164; se aceptan espacios y guiones y vacío es nulo", async () => {
        const conEspacios = await (await editar({ nombre: "María", apellido: "González", telefono: "+56 9 1234-5678" })).json();
        expect(conEspacios.telefono).toBe("+56912345678");

        const vacio = await (await editar({ nombre: "María", apellido: "González", telefono: "" })).json();
        expect(vacio.telefono).toBeNull();

        for (const telefono of ["912345678", "+56abc", "+0123456789", "+5691234"]) {
            const respuesta = await editar({ nombre: "María", apellido: "González", telefono });
            expect(respuesta.status, telefono).toBe(400);
            expect((await respuesta.json()).error.campos.telefono, telefono).toMatch(/código de país/);
        }
    });

    test("[T1.5] nombre y apellido son obligatorios", async () => {
        const respuesta = await editar({ nombre: " ", apellido: "", telefono: null });
        expect(respuesta.status).toBe(400);
        expect((await respuesta.json()).error.campos).toEqual({ nombre: "Escribe tu nombre.", apellido: "Escribe tu apellido." });
    });

    test("[T1.5] sin sesión responde 401", async () => {
        expect((await pedir(leerPerfil, "GET", null)).status).toBe(401);
        expect((await pedir(editarPerfil, "PATCH", null, { nombre: "X", apellido: "Y", telefono: null })).status).toBe(401);
        expect((await pedir(cambiarContrasena, "POST", null, { actual: "x", nueva: "y".repeat(12) })).status).toBe(401);
    });
});

describe("cambio de contraseña", () => {
    const NUEVA = "OtraFraseSeguraParaMaria";

    test("[T1.5] con la contraseña actual incorrecta responde el error junto al campo", async () => {
        const respuesta = await pedir(cambiarContrasena, "POST", tokenProductor, { actual: "incorrecta", nueva: NUEVA });
        expect(respuesta.status).toBe(400);
        expect((await respuesta.json()).error.campos.actual).toMatch(/contraseña actual no es correcta/);
    });

    test("[T1.5] la contraseña nueva debe tener entre 12 y 128 caracteres", async () => {
        for (const nueva of ["corta", "x".repeat(129)]) {
            const respuesta = await pedir(cambiarContrasena, "POST", tokenProductor, { actual: CONTRASENA_PRUEBA, nueva });
            expect(respuesta.status).toBe(400);
            expect((await respuesta.json()).error.campos.nueva).toMatch(/12 caracteres|128 caracteres/);
        }
    });

    test("[T1.5] con la contraseña actual correcta se cambia", async () => {
        const respuesta = await pedir(cambiarContrasena, "POST", tokenProductor, { actual: CONTRASENA_PRUEBA, nueva: NUEVA });
        expect(respuesta.status).toBe(204);

        const entra = (contrasena: string) =>
            iniciarSesion(bd, { correo: "maria@ejemplo.cl", contrasena, recordar: false }).then(() => true, () => false);
        expect(await entra(NUEVA)).toBe(true);
        expect(await entra(CONTRASENA_PRUEBA)).toBe(false);
    });
});
