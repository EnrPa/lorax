import { afterEach, describe, expect, test, vi } from "vitest";
import { z } from "zod";
import { ESTADO_POR_CODIGO, type CodigoError } from "~/lib/errores-api";
import { ErrorApi, noEncontrado, validacion } from "~/server/api/errores";
import { json, manejar } from "~/server/api/respuestas";
import { leerConsulta, leerCuerpo } from "~/server/api/validacion";
import { consultarSalud } from "~/server/servicios/salud";
import { crearBdPrueba } from "./bd";

afterEach(() => vi.restoreAllMocks());

function solicitudJson(cuerpo: string) {
    return new Request("http://localhost/api/v1/prueba", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: cuerpo,
    });
}

describe("formato de error (diseno.md §7)", () => {
    test.each(Object.entries(ESTADO_POR_CODIGO) as Array<[CodigoError, number]>)(
        "[T0.5] %s responde HTTP %i con { error: { codigo, mensaje } }",
        async (codigo, estado) => {
            const respuesta = await manejar(() => {
                throw new ErrorApi(codigo, "Mensaje de prueba.");
            })({});
            expect(respuesta.status).toBe(estado);
            expect(respuesta.headers.get("content-type")).toContain("application/json");
            expect(await respuesta.json()).toEqual({ error: { codigo, mensaje: "Mensaje de prueba." } });
        },
    );

    test("[T0.5] un error de validación incluye los mensajes por campo", async () => {
        const respuesta = await manejar(() => {
            throw validacion({ umbral: "Debe estar entre 0 y 100 %." });
        })({});
        expect(respuesta.status).toBe(400);
        expect(await respuesta.json()).toEqual({
            error: { codigo: "VALIDACION", mensaje: "Revisa los campos marcados.", campos: { umbral: "Debe estar entre 0 y 100 %." } },
        });
    });

    test("[T0.5] un error inesperado responde 500 INTERNO sin revelar detalles", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const respuesta = await manejar(() => {
            throw new Error("SQLITE_CORRUPT: detalle interno");
        })({});
        expect(respuesta.status).toBe(500);
        const cuerpo = await respuesta.json();
        expect(cuerpo.error.codigo).toBe("INTERNO");
        expect(JSON.stringify(cuerpo)).not.toContain("SQLITE");
    });

    test("[T0.5] las respuestas correctas pasan sin cambios", async () => {
        const respuesta = await manejar(async () => json({ items: [] }, 201))({});
        expect(respuesta.status).toBe(201);
        expect(await respuesta.json()).toEqual({ items: [] });
    });

    test("[T0.5] los atajos traen mensajes en español que dicen qué hacer", () => {
        expect(noEncontrado().cuerpo().error.mensaje).toMatch(/Revisa/);
    });
});

describe("validación con Zod", () => {
    const esquema = z.object({
        nombre: z.string().min(1, "Escribe el nombre del terreno."),
        estacion: z.object({ numeroSerie: z.string().min(1, "Escribe el número de serie.") }),
    });

    test("[T0.5] un cuerpo válido se devuelve tipado", async () => {
        const datos = await leerCuerpo(solicitudJson('{"nombre":"Parcela","estacion":{"numeroSerie":"EST-9"}}'), esquema);
        expect(datos.estacion.numeroSerie).toBe("EST-9");
    });

    test("[T0.5] los errores de Zod se indexan por ruta del campo", async () => {
        const error = await leerCuerpo(solicitudJson('{"nombre":"","estacion":{"numeroSerie":""}}'), esquema).catch((e) => e);
        expect(error).toBeInstanceOf(ErrorApi);
        expect(error.cuerpo()).toEqual({
            error: {
                codigo: "VALIDACION",
                mensaje: "Revisa los campos marcados.",
                campos: { nombre: "Escribe el nombre del terreno.", "estacion.numeroSerie": "Escribe el número de serie." },
            },
        });
    });

    test("[T0.5] un JSON mal formado responde VALIDACION", async () => {
        const error = await leerCuerpo(solicitudJson("{no es json"), esquema).catch((e) => e);
        expect(error).toMatchObject({ codigo: "VALIDACION", message: "El cuerpo de la solicitud no es JSON válido." });
    });

    test("[T0.5] sin mensaje propio, Zod responde en español", async () => {
        const error = await leerCuerpo(solicitudJson("{}"), z.object({ nombre: z.string() })).catch((e) => e);
        expect(error.campos.nombre).toMatch(/[Ee]ntrada inválida|esperado/);
    });

    test("[T0.5] los parámetros de la URL se validan y convierten", () => {
        const consulta = leerConsulta(
            "http://localhost/api/v1/cuentas?pagina=2&tamano=20",
            z.object({ pagina: z.coerce.number().int().min(1), tamano: z.coerce.number().int().max(100) }),
        );
        expect(consulta).toEqual({ pagina: 2, tamano: 20 });
    });
});

describe("salud", () => {
    test("[T0.5] con la base disponible responde ok, con latencia y última ingesta", () => {
        const bd = crearBdPrueba();
        const salud = consultarSalud(bd);
        expect(salud).toMatchObject({ estado: "ok", bd: { ok: true }, ultimaIngesta: null });
        expect(salud.bd.latenciaMs).toBeGreaterThanOrEqual(0);
    });

    test("[T0.5] con la base caída responde error", () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const bd = crearBdPrueba();
        bd.$client.close();
        expect(consultarSalud(bd)).toMatchObject({ estado: "error", bd: { ok: false, latenciaMs: null }, ultimaIngesta: null, notificaciones: null });
    });
});
