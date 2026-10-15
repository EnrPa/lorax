import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, ErrorCliente } from "~/core/api";

const assign = vi.fn();

beforeEach(() => {
    assign.mockReset();
    vi.stubGlobal("window", { location: { pathname: "/historial", assign } });
});

afterEach(() => vi.unstubAllGlobals());

function responder(estado: number, cuerpo: unknown) {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(cuerpo, { status: estado })));
}

describe("cliente de la API", () => {
    test("[T0.5] un 401 redirige a /login", async () => {
        responder(401, { error: { codigo: "NO_AUTENTICADO", mensaje: "Tu sesión expiró." } });
        await expect(api.get("/terrenos")).rejects.toBeInstanceOf(ErrorCliente);
        expect(assign).toHaveBeenCalledWith("/login");
    });

    test("[T0.5] un error de validación entrega los mensajes por campo", async () => {
        responder(400, { error: { codigo: "VALIDACION", mensaje: "Revisa los campos marcados.", campos: { umbral: "Debe ser un número." } } });
        const error = await api.post("/criterios", { umbral: "x" }).catch((e) => e);
        expect(error).toMatchObject({ estado: 400, codigo: "VALIDACION", campos: { umbral: "Debe ser un número." } });
        expect(assign).not.toHaveBeenCalled();
    });

    test("[T0.5] una respuesta correcta devuelve los datos y envía JSON a /api/v1", async () => {
        responder(200, { id: 7 });
        await expect(api.patch("/alertas/7", { leida: true })).resolves.toEqual({ id: 7 });
        const [url, opciones] = vi.mocked(fetch).mock.calls[0];
        expect(url).toBe("/api/v1/alertas/7");
        expect(opciones).toMatchObject({ method: "PATCH", body: '{"leida":true}' });
        expect((opciones?.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    });

    test("[T0.5] sin conexión, el error lo explica en español", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
        await expect(api.get("/terrenos")).rejects.toThrow(/conexión/);
    });
});
