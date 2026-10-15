import type { APIEvent } from "@solidjs/start/server";
import { count, eq } from "drizzle-orm";
import { beforeAll, describe, expect, test } from "vitest";
import { GET as detalle } from "~/routes/api/v1/terrenos/[id]/index";
import { POST as agregarEstacion } from "~/routes/api/v1/terrenos/[id]/estaciones";
import { GET as listar, POST as crear } from "~/routes/api/v1/terrenos/index";
import { COOKIE_SESION } from "~/server/auth/cookie";
import { crearSesion } from "~/server/auth/sesiones";
import type { BaseDatos } from "~/server/db/cliente";
import { clientes, empresas, estaciones, eventos, sensores, terrenos } from "~/server/db/esquema";
import { crearBdPrueba, crearCuenta, usarComoBdGlobal } from "./bd";

let bd: BaseDatos;
let maria: string;
let jose: string;
let admin: string;

async function productor(correo: string, rut: string) {
    const cuenta = await crearCuenta(bd, { correo, contrasena: null });
    const empresa = bd.insert(empresas).values({ nombre: `Empresa de ${correo}`, rut }).returning().get();
    bd.insert(clientes).values({ empresaId: empresa.id, cuentaId: cuenta.id }).run();
    return (await crearSesion(bd, cuenta, false)).token;
}

beforeAll(async () => {
    bd = crearBdPrueba();
    usarComoBdGlobal(bd);
    maria = await productor("maria@ejemplo.cl", "76.123.456-0");
    jose = await productor("jose@ejemplo.cl", "77.234.567-4");
    const cuentaAdmin = await crearCuenta(bd, { correo: "admin@ejemplo.cl", rol: "ADMINISTRADOR", contrasena: null });
    admin = (await crearSesion(bd, cuentaAdmin, false)).token;
});

function pedir(handler: (e: APIEvent) => Promise<Response>, token: string | null, opciones: { metodo?: string; ruta?: string; id?: number | string; cuerpo?: unknown } = {}) {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.cookie = `${COOKIE_SESION}=${token}`;
    return handler({
        request: new Request(`http://localhost:3000/api/v1/terrenos${opciones.ruta ?? ""}`, {
            method: opciones.metodo ?? "GET",
            headers,
            body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
        }),
        params: { id: String(opciones.id ?? "") },
    } as unknown as APIEvent);
}

const TODOS = ["temperatura_aire", "humedad_aire", "humedad_suelo", "nitrogeno", "fosforo", "potasio"];

function cuerpoTerreno(serie: string, extra: { estacion?: object; terreno?: object } = {}) {
    return {
        terreno: { nombre: "Parcela de prueba", latitud: -38.95, longitud: -72.62, superficie: 12.5, tipoCultivo: "Arándanos", ...extra.terreno },
        estacion: { tipo: "Estación de terreno", modelo: "LX-100", numeroSerie: serie, sensores: TODOS, ...extra.estacion },
    };
}

const crearTerreno = (token: string, cuerpo: unknown) => pedir(crear, token, { metodo: "POST", cuerpo });

function conteos() {
    const n = (tabla: typeof terrenos | typeof estaciones | typeof sensores) => bd.select({ n: count() }).from(tabla).get()!.n;
    return { terrenos: n(terrenos), estaciones: n(estaciones), sensores: n(sensores) };
}

describe("registro de terrenos y estaciones (CU02)", () => {
    test("[P-FUN-CU02] con número de serie disponible crea terreno, estación y los 6 sensores estándar", async () => {
        const respuesta = await crearTerreno(maria, cuerpoTerreno("EST-A1"));
        expect(respuesta.status).toBe(201);
        const terreno = await respuesta.json();
        expect(terreno).toMatchObject({ nombre: "Parcela de prueba", latitud: -38.95, longitud: -72.62, superficie: 12.5, tipoCultivo: "Arándanos" });
        expect(terreno.estaciones).toHaveLength(1);
        const [estacion] = terreno.estaciones;
        expect(estacion).toMatchObject({ numeroSerie: "EST-A1", habilitada: true });
        expect(estacion.sensores.map((s: { codigo: string }) => s.codigo)).toEqual(["temp_aire", "hum_aire", "hum_suelo", "n", "p", "k"]);
        expect(estacion.sensores[2]).toMatchObject({ tipo: "humedad_suelo", unidad: "%", rangoMinimo: 0, rangoMaximo: 100 });

        const fila = bd.select().from(sensores).where(eq(sensores.estacionId, estacion.id)).get()!;
        expect(fila.intervaloMedicion).toBe(900);
    });

    test("[P-FUN-CU02] sin ubicación propia, la estación usa las coordenadas del terreno", async () => {
        const terreno = await (await crearTerreno(maria, cuerpoTerreno("EST-A2"))).json();
        expect(terreno.estaciones[0]).toMatchObject({ latitud: -38.95, longitud: -72.62 });

        const conUbicacion = await (
            await crearTerreno(maria, cuerpoTerreno("EST-A3", { estacion: { latitud: -38.951, longitud: -72.621 } }))
        ).json();
        expect(conUbicacion.estaciones[0]).toMatchObject({ latitud: -38.951, longitud: -72.621 });
    });

    test("[P-FUN-CU02] se pueden desmarcar sensores, pero debe quedar al menos uno", async () => {
        const parcial = await (await crearTerreno(maria, cuerpoTerreno("EST-A4", { estacion: { sensores: ["humedad_suelo", "temperatura_aire"] } }))).json();
        expect(parcial.estaciones[0].sensores.map((s: { tipo: string }) => s.tipo).sort()).toEqual(["humedad_suelo", "temperatura_aire"]);

        const sinSensores = await crearTerreno(maria, cuerpoTerreno("EST-A5", { estacion: { sensores: [] } }));
        expect(sinSensores.status).toBe(400);
        expect((await sinSensores.json()).error.campos["estacion.sensores"]).toBe("Marca al menos un sensor.");
    });

    test("[P-FUN-CU02] con número de serie repetido informa el conflicto junto al campo y no escribe nada", async () => {
        await crearTerreno(maria, cuerpoTerreno("EST-REP"));
        const antes = conteos();

        const respuesta = await crearTerreno(maria, cuerpoTerreno("EST-REP", { terreno: { nombre: "Otro terreno" } }));
        expect(respuesta.status).toBe(409);
        const { error } = await respuesta.json();
        expect(error.codigo).toBe("CONFLICTO");
        expect(error.campos["estacion.numeroSerie"]).toMatch(/Ya existe una estación con el número de serie EST-REP/);

        expect(conteos()).toEqual(antes);
        expect(bd.select().from(terrenos).where(eq(terrenos.nombre, "Otro terreno")).all()).toHaveLength(0);
    });

    test("[P-FUN-CU02] datos faltantes o inválidos se marcan por campo", async () => {
        const respuesta = await crearTerreno(maria, {
            terreno: { nombre: "", latitud: -95, longitud: 200, superficie: -1 },
            estacion: { tipo: "", modelo: "LX", numeroSerie: "", latitud: -38.9, sensores: ["ph"] },
        });
        expect(respuesta.status).toBe(400);
        const { campos } = (await respuesta.json()).error;
        expect(campos).toMatchObject({
            "terreno.nombre": "Escribe el nombre del terreno.",
            "terreno.latitud": "La latitud debe estar entre -90 y 90.",
            "terreno.longitud": "La longitud debe estar entre -180 y 180.",
            "terreno.superficie": "La superficie debe ser mayor que 0 hectáreas.",
            "estacion.tipo": "Escribe el tipo de estación.",
            "estacion.numeroSerie": "Escribe el número de serie de la estación.",
        });
        expect(campos["estacion.sensores.0"]).toBe("Elige sensores de la lista.");
    });

    test("[P-FUN-CU02] la estación con solo latitud o solo longitud se rechaza", async () => {
        const respuesta = await crearTerreno(maria, cuerpoTerreno("EST-A6", { estacion: { latitud: -38.9 } }));
        expect(respuesta.status).toBe(400);
        expect((await respuesta.json()).error.campos["estacion.longitud"]).toMatch(/latitud y la longitud/);
    });

    test("[P-FUN-CU02] se agregan estaciones a un terreno existente; con serie repetida no se escribe nada", async () => {
        const terreno = await (await crearTerreno(maria, cuerpoTerreno("EST-B1"))).json();
        const nueva = { tipo: "Estación de terreno", modelo: "LX-200", numeroSerie: "EST-B2", sensores: ["humedad_suelo"] };

        const respuesta = await pedir(agregarEstacion, maria, { metodo: "POST", id: terreno.id, cuerpo: nueva });
        expect(respuesta.status).toBe(201);
        const actualizado = await respuesta.json();
        expect(actualizado.estaciones.map((e: { numeroSerie: string }) => e.numeroSerie)).toEqual(["EST-B1", "EST-B2"]);
        expect(actualizado.estaciones[1]).toMatchObject({ latitud: -38.95, longitud: -72.62 });

        const antes = conteos();
        const repetida = await pedir(agregarEstacion, maria, { metodo: "POST", id: terreno.id, cuerpo: { ...nueva, numeroSerie: "EST-B1" } });
        expect(repetida.status).toBe(409);
        expect((await repetida.json()).error.campos.numeroSerie).toMatch(/EST-B1/);
        expect(conteos()).toEqual(antes);
    });

    test("[P-FUN-CU02] el productor ve sus terrenos con estaciones y sensores, paginados", async () => {
        const respuesta = await pedir(listar, maria, { ruta: "?pagina=1&tamano=2" });
        expect(respuesta.status).toBe(200);
        const pagina = await respuesta.json();
        expect(pagina).toMatchObject({ pagina: 1, tamano: 2 });
        expect(pagina.total).toBeGreaterThan(2);
        expect(pagina.items).toHaveLength(2);
        expect(pagina.items[0].estaciones[0].sensores.length).toBeGreaterThan(0);

        const detalleRespuesta = await pedir(detalle, maria, { id: pagina.items[0].id });
        expect((await detalleRespuesta.json()).id).toBe(pagina.items[0].id);
    });
});

describe("aislamiento entre cuentas (RNF02)", () => {
    let terrenoDeMaria: number;

    beforeAll(async () => {
        terrenoDeMaria = (await (await crearTerreno(maria, cuerpoTerreno("EST-AISLADA"))).json()).id;
    });

    test("[P-SEG-AISLAMIENTO] otro productor recibe 404 al ver el terreno o agregarle estaciones", async () => {
        const verAjeno = await pedir(detalle, jose, { id: terrenoDeMaria });
        expect(verAjeno.status).toBe(404);

        const antes = conteos();
        const agregarAjeno = await pedir(agregarEstacion, jose, {
            metodo: "POST",
            id: terrenoDeMaria,
            cuerpo: { tipo: "X", modelo: "Y", numeroSerie: "EST-INTRUSA", sensores: ["humedad_suelo"] },
        });
        expect(agregarAjeno.status).toBe(404);
        expect(conteos()).toEqual(antes);

        // Mismo 404 que un terreno inexistente: no se revela que existe.
        expect((await pedir(detalle, jose, { id: 999_999 })).status).toBe(404);
        expect((await pedir(detalle, jose, { id: "abc" })).status).toBe(404);
    });

    test("[P-SEG-AISLAMIENTO] el listado de otro productor no incluye terrenos ajenos", async () => {
        const pagina = await (await pedir(listar, jose)).json();
        expect(pagina).toMatchObject({ items: [], total: 0 });
    });

    test("[P-SEG-AISLAMIENTO] el administrador recibe 403 y queda registrado", async () => {
        const respuesta = await pedir(listar, admin);
        expect(respuesta.status).toBe(403);
        expect(bd.select().from(eventos).where(eq(eventos.tipo, "ACCESO_DENEGADO")).all().length).toBeGreaterThan(0);
        expect((await pedir(crear, admin, { metodo: "POST", cuerpo: cuerpoTerreno("EST-ADMIN") })).status).toBe(403);
    });

    test("[P-SEG-AISLAMIENTO] sin sesión responde 401", async () => {
        expect((await pedir(listar, null)).status).toBe(401);
        expect((await pedir(detalle, null, { id: terrenoDeMaria })).status).toBe(401);
    });
});
