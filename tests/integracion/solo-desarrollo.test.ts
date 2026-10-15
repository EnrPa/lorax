import type { APIEvent } from "@solidjs/start/server";
import { afterEach, describe, expect, test, vi } from "vitest";
import { accesoPagina, modoDesarrollo } from "~/lib/rutas";
import { GET as bandeja } from "~/routes/api/v1/dev/correos";

// Excepción de RF01.8 y diseno.md §9: /dev/correos es pública solo en desarrollo; en producción, 404.
afterEach(() => vi.unstubAllEnvs());

const productor = { rol: "PRODUCTOR" as const };
const administrador = { rol: "ADMINISTRADOR" as const };

describe("bandeja de correos según el entorno", () => {
    test("[P-INT-API] en desarrollo, /dev/correos se ve sin sesión y con sesión", () => {
        vi.stubEnv("NODE_ENV", "development");
        expect(modoDesarrollo()).toBe(true);
        for (const cuenta of [null, productor, administrador]) {
            expect(accesoPagina("/dev/correos", cuenta)).toEqual({ tipo: "permitir" });
        }
    });

    test("[P-INT-API] con NODE_ENV=production, la página responde 404 con o sin sesión", () => {
        vi.stubEnv("NODE_ENV", "production");
        expect(modoDesarrollo()).toBe(false);
        for (const cuenta of [null, productor, administrador]) {
            expect(accesoPagina("/dev/correos", cuenta)).toEqual({ tipo: "no-encontrada" });
        }
        // Las demás reglas no cambian en producción.
        expect(accesoPagina("/", null)).toEqual({ tipo: "redirigir", destino: "/login" });
        expect(accesoPagina("/login", null)).toEqual({ tipo: "permitir" });
    });

    test("[P-INT-API] con NODE_ENV=production, el endpoint responde 404", async () => {
        vi.stubEnv("NODE_ENV", "production");
        const respuesta = await bandeja({} as APIEvent);
        expect(respuesta.status).toBe(404);
        expect((await respuesta.json()).error.codigo).toBe("NO_ENCONTRADO");
    });

    test("[P-INT-API] en desarrollo, el endpoint responde 200", async () => {
        vi.stubEnv("NODE_ENV", "development");
        expect((await bandeja({} as APIEvent)).status).toBe(200);
    });
});
