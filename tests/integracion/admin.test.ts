import type { APIEvent } from "@solidjs/start/server";
import { count, eq } from "drizzle-orm";
import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { POST as crear, GET as listar } from "~/routes/api/v1/admin/cuentas/index";
import { GET as detalle, PATCH as actualizar } from "~/routes/api/v1/admin/cuentas/[id]/index";
import { POST as habilitacion } from "~/routes/api/v1/admin/cuentas/[id]/habilitacion";
import { POST as reenviar } from "~/routes/api/v1/admin/cuentas/[id]/reenviar-activacion";
import { POST as eliminarCriterio } from "~/routes/api/v1/admin/criterios/[id]/eliminar";
import { GET as empresasApi } from "~/routes/api/v1/admin/empresas";
import { POST as deshabilitarEstacion } from "~/routes/api/v1/admin/estaciones/[id]/deshabilitar";
import { GET as eventosApi } from "~/routes/api/v1/admin/eventos";
import { POST as restablecer } from "~/routes/api/v1/auth/restablecer";
import { COOKIE_SESION } from "~/server/auth/cookie";
import { crearSesion, validarSesion } from "~/server/auth/sesiones";
import { carpetaCorreos } from "~/server/config";
import { listarCorreos } from "~/server/correo/correo";
import type { BaseDatos } from "~/server/db/cliente";
import { alertas, clientes, criterios, cuentas, empresas, estaciones, eventos, mediciones, sensores, terrenos } from "~/server/db/esquema";
import { iniciarSesion } from "~/server/servicios/autenticacion";
import { CONTRASENA_PRUEBA, crearBdPrueba, crearCuenta, usarComoBdGlobal } from "./bd";

const AHORA = new Date("2026-09-26T12:00:00Z");
let bd: BaseDatos;
let admin: string;
let adminId: number;
let maria: { id: number; rol: "PRODUCTOR" | "ADMINISTRADOR" };
let empresaMaria: number;
let estacionId: number;
let criterioId: number;
let alertaVigente: number;

beforeAll(async () => {
    bd = crearBdPrueba();
    usarComoBdGlobal(bd);
    // Carpeta de correos propia: con una compartida, otro archivo que corre en paralelo la vaciaba a mitad de una prueba.
    process.env.CORREOS_DIR = mkdtempSync(join(tmpdir(), "lorax-correos-admin-"));
    const cuentaAdmin = await crearCuenta(bd, { correo: "admin@ejemplo.cl", rol: "ADMINISTRADOR" });
    adminId = cuentaAdmin.id;
    admin = (await crearSesion(bd, cuentaAdmin, false)).token;

    maria = await crearCuenta(bd, { correo: "maria@ejemplo.cl" });
    bd.update(cuentas).set({ nombre: "María", apellido: "González" }).where(eq(cuentas.id, maria.id)).run();
    empresaMaria = bd.insert(empresas).values({ nombre: "Agrícola Los Castaños SpA", rut: "76123456-0" }).returning().get().id;
    bd.insert(clientes).values({ empresaId: empresaMaria, cuentaId: maria.id, cargo: "Dueña" }).run();

    const terrenoId = bd.insert(terrenos).values({ clienteId: 1, nombre: "Parcela", latitud: 0, longitud: 0, fechaUltimaActualizacion: AHORA }).returning().get().id;
    estacionId = bd
        .insert(estaciones)
        .values({ terrenoId, tipo: "E", modelo: "M", numeroSerie: "EST-1", latitud: 0, longitud: 0, fechaCreacion: AHORA, fechaUltimaActualizacion: AHORA })
        .returning()
        .get().id;
    const sensorId = bd
        .insert(sensores)
        .values({ estacionId, codigo: "hum_suelo", tipo: "humedad_suelo", unidad: "%", rangoMinimo: 0, rangoMaximo: 100, fechaCreacion: AHORA })
        .returning()
        .get().id;
    const medicionId = bd.insert(mediciones).values({ sensorId, valor: 20, fecha: AHORA, payload: {} }).returning().get().id;
    criterioId = bd.insert(criterios).values({ sensorId, umbral: 25, condicion: "DESCIENDE", fechaCreacion: AHORA }).returning().get().id;
    alertaVigente = bd
        .insert(alertas)
        .values({ medicionId, criterioId, nombre: "Humedad baja", tipo: "ADVERTENCIA", mensaje: "m", fecha: AHORA })
        .returning()
        .get().id;

    await crearCuenta(bd, { correo: "pedro@ejemplo.cl", habilitada: false });
});

beforeEach(async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    await rm(carpetaCorreos(), { recursive: true, force: true });
});

function pedir(handler: (e: APIEvent) => Promise<Response>, opciones: { token?: string | null; metodo?: string; id?: number; cuerpo?: unknown; consulta?: string } = {}) {
    const token = opciones.token === undefined ? admin : opciones.token;
    return handler({
        request: new Request(`http://localhost:3000/api/v1/admin/x${opciones.consulta ?? ""}`, {
            method: opciones.metodo ?? "GET",
            headers: { "Content-Type": "application/json", ...(token ? { cookie: `${COOKIE_SESION}=${token}` } : {}) },
            body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
        }),
        params: { id: String(opciones.id ?? "") },
    } as unknown as APIEvent);
}

const ultimoEvento = () => bd.select().from(eventos).orderBy(eventos.id).all().at(-1)!;
const totalCuentas = () => bd.select({ n: count() }).from(cuentas).get()!.n;
const puedeEntrar = (correo: string, contrasena: string) =>
    iniciarSesion(bd, { correo, contrasena, recordar: false }).then(() => "ok", (e: { codigo: string }) => e.codigo);

function nuevoProductor(extra: object = {}) {
    return {
        nombre: "Ana",
        apellido: "Soto",
        correo: "Ana.Soto@Ejemplo.CL",
        telefono: "+56933333333",
        cargo: "Dueña",
        empresa: { nombre: "Viñedos Soto EIRL", rut: "76.345.678-1" },
        ...extra,
    };
}

describe("registro de cuentas (RF07.3)", () => {
    test("[P-FUN-CU07] crea el productor sin contraseña, con empresa nueva y RUT normalizado, y le envía el enlace de activación", async () => {
        const respuesta = await pedir(crear, { metodo: "POST", cuerpo: nuevoProductor() });
        expect(respuesta.status).toBe(201);
        const cuenta = await respuesta.json();
        expect(cuenta).toMatchObject({
            correo: "ana.soto@ejemplo.cl",
            pendienteActivacion: true,
            habilitada: true,
            cargo: "Dueña",
            empresa: { nombre: "Viñedos Soto EIRL", rut: "76345678-1" },
        });
        expect(bd.select().from(cuentas).where(eq(cuentas.id, cuenta.id)).get()!.contrasenaHash).toBeNull();

        const evento = ultimoEvento();
        expect(evento).toMatchObject({ tipo: "OPERACION_ADMINISTRATIVA", cuentaId: adminId, entidad: "cuentas", entidadId: cuenta.id });
        expect(evento.detalle).toMatchObject({ accion: "CREAR_CUENTA" });

        // El enlace del correo permite definir la contraseña; el administrador nunca la conoce.
        const [correo] = await listarCorreos();
        expect(correo).toMatchObject({ para: "ana.soto@ejemplo.cl", asunto: "Activa tu cuenta en LoRax" });
        expect(correo.texto).toContain("72 horas");
        const token = decodeURIComponent(/token=(\S+)/.exec(correo.texto)![1]);
        expect(await puedeEntrar("ana.soto@ejemplo.cl", "UnaFraseParaAna2026")).toBe("NO_AUTENTICADO");
        const activar = await restablecer({
            request: new Request("http://localhost:3000/api/v1/auth/restablecer", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, contrasena: "UnaFraseParaAna2026" }),
            }),
        } as APIEvent);
        expect(activar.status).toBe(204);
        expect(await puedeEntrar("ana.soto@ejemplo.cl", "UnaFraseParaAna2026")).toBe("ok");
    });

    test("[P-FUN-CU07] se puede asociar a una empresa existente", async () => {
        const respuesta = await pedir(crear, { metodo: "POST", cuerpo: nuevoProductor({ correo: "otro@ejemplo.cl", empresa: { id: empresaMaria } }) });
        expect(respuesta.status).toBe(201);
        expect((await respuesta.json()).empresa).toMatchObject({ id: empresaMaria, rut: "76123456-0" });
    });

    test("[P-FUN-CU07] un RUT inválido o repetido se indica junto al campo y no se escribe nada", async () => {
        const antes = totalCuentas();
        const invalido = await pedir(crear, { metodo: "POST", cuerpo: nuevoProductor({ correo: "x1@ejemplo.cl", empresa: { nombre: "X", rut: "76.123.456-1" } }) });
        expect(invalido.status).toBe(400);
        expect((await invalido.json()).error.campos["empresa.rut"]).toMatch(/dígito verificador/);

        // Repetido aunque venga escrito de otra forma: se compara normalizado.
        const repetido = await pedir(crear, { metodo: "POST", cuerpo: nuevoProductor({ correo: "x2@ejemplo.cl", empresa: { nombre: "Otra", rut: "76.123.456-0" } }) });
        expect(repetido.status).toBe(409);
        expect((await repetido.json()).error.campos["empresa.rut"]).toBe("Ya existe una empresa con ese RUT. Elígela de la lista de empresas existentes");
        expect(totalCuentas()).toBe(antes);
    });

    test("[P-FUN-CU07] impide registrar un correo repetido, sin distinguir mayúsculas", async () => {
        const respuesta = await pedir(crear, { metodo: "POST", cuerpo: nuevoProductor({ correo: "MARIA@ejemplo.cl", empresa: { id: empresaMaria } }) });
        expect(respuesta.status).toBe(409);
        expect((await respuesta.json()).error.campos.correo).toMatch(/Ya existe una cuenta con ese correo/);
    });
});

describe("listado y detalle (RF07.2, RF07.5)", () => {
    test("[P-FUN-CU07] lista solo productores, con búsqueda por nombre o correo y filtro por estado", async () => {
        const todas = await (await pedir(listar, { consulta: "?tamano=100" })).json();
        expect(todas.items.some((c: { correo: string }) => c.correo === "admin@ejemplo.cl")).toBe(false);

        const porNombre = await (await pedir(listar, { consulta: "?q=gonzál" })).json();
        expect(porNombre.items.map((c: { correo: string }) => c.correo)).toEqual(["maria@ejemplo.cl"]);
        const porNombreCompleto = await (await pedir(listar, { consulta: `?q=${encodeURIComponent("maría gonzález")}` })).json();
        expect(porNombreCompleto.total).toBe(1);
        const porCorreo = await (await pedir(listar, { consulta: "?q=PEDRO@" })).json();
        expect(porCorreo.items[0]).toMatchObject({ correo: "pedro@ejemplo.cl", habilitada: false });

        const deshabilitadas = await (await pedir(listar, { consulta: "?habilitada=false&tamano=100" })).json();
        expect(deshabilitadas.items.every((c: { habilitada: boolean }) => !c.habilitada)).toBe(true);
    });

    test("[P-FUN-CU07] el detalle muestra terrenos, estaciones y criterios, pero no mediciones", async () => {
        const respuesta = await pedir(detalle, { id: maria.id });
        expect(respuesta.status).toBe(200);
        const cuerpo = await respuesta.json();
        expect(cuerpo.terrenos[0].estaciones[0]).toMatchObject({ numeroSerie: "EST-1" });
        expect(cuerpo.criterios[0]).toMatchObject({ id: criterioId, umbral: 25 });
        const texto = JSON.stringify(cuerpo);
        expect(texto).not.toMatch(/"valor"|"mediciones"|"lecturas"|"serie"/);
    });

    test("[P-FUN-CU07] una cuenta de administrador no se gestiona por /admin/cuentas (404)", async () => {
        expect((await pedir(detalle, { id: adminId })).status).toBe(404);
        expect((await pedir(habilitacion, { metodo: "POST", id: adminId, cuerpo: { habilitada: false, motivo: "x" } })).status).toBe(404);
    });
});

describe("actualización (RF07.4)", () => {
    test("[P-FUN-CU07] el evento guarda cada campo modificado con su valor anterior y nuevo; el correo anterior recibe un aviso", async () => {
        const cuenta = await (await pedir(crear, { metodo: "POST", cuerpo: nuevoProductor({ correo: "luis@ejemplo.cl", empresa: { id: empresaMaria } }) })).json();
        await rm(carpetaCorreos(), { recursive: true, force: true });

        const respuesta = await pedir(actualizar, {
            metodo: "PATCH",
            id: cuenta.id,
            cuerpo: { nombre: "Luis", apellido: "Soto", correo: "Luis.Nuevo@Ejemplo.cl", telefono: "+56933333333", cargo: "Dueña", empresa: { id: 999 } },
        });
        expect(respuesta.status).toBe(200);
        expect(await respuesta.json()).toMatchObject({ nombre: "Luis", correo: "luis.nuevo@ejemplo.cl", empresa: { id: empresaMaria } });

        const evento = ultimoEvento();
        expect(evento.detalle).toEqual({
            accion: "ACTUALIZAR_CUENTA",
            cambios: {
                nombre: { anterior: "Ana", nuevo: "Luis" },
                correo: { anterior: "luis@ejemplo.cl", nuevo: "luis.nuevo@ejemplo.cl" },
            },
        });

        const [aviso] = await listarCorreos();
        expect(aviso.para).toBe("luis@ejemplo.cl");
        expect(aviso.texto).toContain("El correo de tu cuenta LoRax fue cambiado por el administrador. Si no lo solicitaste, contáctalo.");

        const repetido = await pedir(actualizar, { metodo: "PATCH", id: cuenta.id, cuerpo: { nombre: "Luis", apellido: "Soto", correo: "maria@ejemplo.cl", telefono: null, cargo: null } });
        expect(repetido.status).toBe(409);
    });
});

describe("habilitación (RF07.4, RF07.8, RF07.9)", () => {
    test("[P-FUN-CU07] deshabilitar exige motivo, revoca las sesiones y queda registrado", async () => {
        const sinMotivo = await pedir(habilitacion, { metodo: "POST", id: maria.id, cuerpo: { habilitada: false } });
        expect(sinMotivo.status).toBe(400);
        expect((await sinMotivo.json()).error.campos.motivo).toBe("Escribe el motivo de esta acción.");

        const { token } = await crearSesion(bd, maria, false);
        const respuesta = await pedir(habilitacion, { metodo: "POST", id: maria.id, cuerpo: { habilitada: false, motivo: "Dejó de trabajar con la plataforma." } });
        expect(respuesta.status).toBe(200);
        expect((await respuesta.json()).habilitada).toBe(false);

        expect(await validarSesion(bd, token)).toBeNull();
        // Antes del intento de login, que también queda como evento (ACCESO_FALLIDO, RF01.9).
        expect(ultimoEvento()).toMatchObject({ entidadId: maria.id, motivo: "Dejó de trabajar con la plataforma.", detalle: { accion: "DESHABILITAR_CUENTA" } });
        expect(await puedeEntrar("maria@ejemplo.cl", CONTRASENA_PRUEBA)).toBe("PROHIBIDO");

        expect((await pedir(habilitacion, { metodo: "POST", id: maria.id, cuerpo: { habilitada: false, motivo: "otra vez" } })).status).toBe(409);

        // Habilitar no exige motivo; los datos se conservaron.
        const habilitar = await pedir(habilitacion, { metodo: "POST", id: maria.id, cuerpo: { habilitada: true } });
        expect(habilitar.status).toBe(200);
        expect(ultimoEvento().detalle).toMatchObject({ accion: "HABILITAR_CUENTA" });
        expect(await puedeEntrar("maria@ejemplo.cl", CONTRASENA_PRUEBA)).toBe("ok");
    });

    test("[P-FUN-CU07] la operación y su evento van en la misma transacción: si el evento falla, no se aplica nada", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const { token } = await crearSesion(bd, maria, false);
        const eventosAntes = bd.select({ n: count() }).from(eventos).get()!.n;
        bd.$client.exec("CREATE TRIGGER falla_evento BEFORE INSERT ON eventos BEGIN SELECT RAISE(ABORT, 'falla simulada'); END;");
        try {
            const respuesta = await pedir(habilitacion, { metodo: "POST", id: maria.id, cuerpo: { habilitada: false, motivo: "Prueba de atomicidad" } });
            expect(respuesta.status).toBe(500);
        } finally {
            bd.$client.exec("DROP TRIGGER falla_evento;");
        }
        expect(bd.select().from(cuentas).where(eq(cuentas.id, maria.id)).get()!.habilitada).toBe(true);
        expect(await validarSesion(bd, token)).not.toBeNull();
        expect(bd.select({ n: count() }).from(eventos).get()!.n).toBe(eventosAntes);
    });
});

describe("reenviar activación", () => {
    test("[P-FUN-CU07] responde 409 si la cuenta ya está activa; si está pendiente, invalida el enlace anterior y envía uno nuevo", async () => {
        expect((await pedir(reenviar, { metodo: "POST", id: maria.id, cuerpo: {} })).status).toBe(409);

        const cuenta = await (await pedir(crear, { metodo: "POST", cuerpo: nuevoProductor({ correo: "rosa@ejemplo.cl", empresa: { id: empresaMaria } }) })).json();
        const [primero] = await listarCorreos();
        const tokenViejo = decodeURIComponent(/token=(\S+)/.exec(primero.texto)![1]);

        expect((await pedir(reenviar, { metodo: "POST", id: cuenta.id, cuerpo: {} })).status).toBe(204);
        expect(ultimoEvento().detalle).toMatchObject({ accion: "REENVIAR_ACTIVACION" });
        const [segundo] = await listarCorreos();
        const tokenNuevo = decodeURIComponent(/token=(\S+)/.exec(segundo.texto)![1]);
        expect(tokenNuevo).not.toBe(tokenViejo);

        const usar = (token: string) =>
            restablecer({
                request: new Request("http://localhost:3000/api/v1/auth/restablecer", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ token, contrasena: "OtraFraseParaRosa2026" }),
                }),
            } as APIEvent);
        expect((await usar(tokenViejo)).status).toBe(422);
        expect((await usar(tokenNuevo)).status).toBe(204);
    });
});

describe("estaciones y criterios (RF07.6 a RF07.8)", () => {
    test("[P-FUN-CU07] deshabilitar una estación exige motivo, conserva su historial y queda registrado", async () => {
        expect((await pedir(deshabilitarEstacion, { metodo: "POST", id: estacionId, cuerpo: {} })).status).toBe(400);
        const medicionesAntes = bd.select({ n: count() }).from(mediciones).get()!.n;

        const respuesta = await pedir(deshabilitarEstacion, { metodo: "POST", id: estacionId, cuerpo: { motivo: "Equipo en mantención." } });
        expect(respuesta.status).toBe(200);
        expect(bd.select().from(estaciones).where(eq(estaciones.id, estacionId)).get()!.habilitada).toBe(false);
        expect(bd.select({ n: count() }).from(mediciones).get()!.n).toBe(medicionesAntes);
        expect(ultimoEvento()).toMatchObject({ entidad: "estaciones", entidadId: estacionId, motivo: "Equipo en mantención.", detalle: { accion: "DESHABILITAR_ESTACION" } });

        expect((await pedir(deshabilitarEstacion, { metodo: "POST", id: estacionId, cuerpo: { motivo: "otra vez" } })).status).toBe(409);
        expect((await pedir(deshabilitarEstacion, { metodo: "POST", id: 99999, cuerpo: { motivo: "x" } })).status).toBe(404);
    });

    test("[P-FUN-CU07] eliminar un criterio exige motivo; es lógico, conserva las alertas y resuelve la vigente", async () => {
        expect((await pedir(eliminarCriterio, { metodo: "POST", id: criterioId, cuerpo: { motivo: "  " } })).status).toBe(400);

        const respuesta = await pedir(eliminarCriterio, { metodo: "POST", id: criterioId, cuerpo: { motivo: "Umbral mal configurado." } });
        expect(respuesta.status).toBe(204);
        expect(bd.select().from(criterios).where(eq(criterios.id, criterioId)).get()!.fechaEliminacion).not.toBeNull();
        expect(bd.select().from(alertas).where(eq(alertas.id, alertaVigente)).get()).toMatchObject({ estado: "RESUELTA", descripcion: "Criterio eliminado" });
        expect(ultimoEvento()).toMatchObject({ entidad: "criterios", entidadId: criterioId, motivo: "Umbral mal configurado.", detalle: { accion: "ELIMINAR_CRITERIO" } });

        expect((await pedir(eliminarCriterio, { metodo: "POST", id: criterioId, cuerpo: { motivo: "x" } })).status).toBe(404);
    });
});

describe("eventos y listas de apoyo (RF07.10)", () => {
    test("[P-FUN-CU07] los eventos se filtran por tipo y fecha, del más reciente al más antiguo, con su responsable", async () => {
        bd.insert(eventos).values({ tipo: "ACCESO_FALLIDO", detalle: { correo: "x@y.cl" }, fecha: new Date("2020-01-01T00:00:00Z") }).run();
        const admins = await (await pedir(eventosApi, { consulta: "?tipo=OPERACION_ADMINISTRATIVA&tamano=100" })).json();
        expect(admins.items.length).toBeGreaterThan(3);
        expect(admins.items.every((e: { tipo: string }) => e.tipo === "OPERACION_ADMINISTRATIVA")).toBe(true);
        expect(admins.items[0].responsable).toMatchObject({ id: adminId, correo: "admin@ejemplo.cl" });
        const fechas = admins.items.map((e: { fecha: string }) => e.fecha);
        expect(fechas).toEqual([...fechas].sort().reverse());

        const antiguos = await (await pedir(eventosApi, { consulta: `?desde=2019-12-31T00:00:00Z&hasta=2020-01-02T00:00:00Z` })).json();
        expect(antiguos.items).toHaveLength(1);
        expect(antiguos.items[0]).toMatchObject({ tipo: "ACCESO_FALLIDO", responsable: null });
    });

    test("[P-FUN-CU07] lista las empresas para elegir una existente", async () => {
        const cuerpo = await (await pedir(empresasApi)).json();
        expect(cuerpo.items.map((e: { rut: string }) => e.rut)).toContain("76123456-0");
    });
});

describe("acceso (RF07.1)", () => {
    test("[P-SEG-AISLAMIENTO] un productor recibe 403 en /admin y el intento queda registrado; sin sesión, 401", async () => {
        // Sesión nueva: la de beforeAll se revocó cuando otra prueba deshabilitó la cuenta (RF07.9).
        const productorToken = (await crearSesion(bd, maria, false)).token;
        const respuesta = await pedir(listar, { token: productorToken });
        expect(respuesta.status).toBe(403);
        expect(ultimoEvento()).toMatchObject({ tipo: "ACCESO_DENEGADO", cuentaId: maria.id });
        expect((await pedir(crear, { metodo: "POST", token: productorToken, cuerpo: nuevoProductor() })).status).toBe(403);
        expect((await pedir(listar, { token: null })).status).toBe(401);
    });
});
