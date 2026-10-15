import type { APIEvent } from "@solidjs/start/server";
import { beforeAll, describe, expect, test } from "vitest";
import { redireccionPara } from "~/lib/rutas";
import { GET as sesion } from "~/routes/api/v1/auth/sesion";
import { COOKIE_SESION } from "~/server/auth/cookie";
import { crearSesion } from "~/server/auth/sesiones";
import { crearBdPrueba, crearCuenta, usarComoBdGlobal } from "./bd";

const productor = { rol: "PRODUCTOR" as const };
const administrador = { rol: "ADMINISTRADOR" as const };

describe("protección de páginas (RF01.8, diseno.md §8.4)", () => {
    test("[P-INT-API] sin sesión, toda página salvo /login y /restablecer lleva a /login", () => {
        for (const ruta of ["/", "/historial", "/alertas", "/ajustes", "/admin", "/no-existe"]) {
            expect(redireccionPara(ruta, null), ruta).toBe("/login");
        }
        expect(redireccionPara("/login", null)).toBeNull();
        expect(redireccionPara("/restablecer", null)).toBeNull();
    });

    test("[P-INT-API] un productor que pide /admin va a /", () => {
        expect(redireccionPara("/admin", productor)).toBe("/");
        for (const ruta of ["/", "/historial", "/alertas", "/ajustes"]) expect(redireccionPara(ruta, productor), ruta).toBeNull();
    });

    test("[P-INT-API] un administrador que pide una página de productor va a /admin", () => {
        for (const ruta of ["/", "/historial", "/alertas"]) expect(redireccionPara(ruta, administrador), ruta).toBe("/admin");
        expect(redireccionPara("/admin", administrador)).toBeNull();
        expect(redireccionPara("/ajustes", administrador)).toBeNull();
    });

    test("[P-INT-API] con sesión, /login lleva al inicio del rol y la 404 se muestra", () => {
        expect(redireccionPara("/login", productor)).toBe("/");
        expect(redireccionPara("/login", administrador)).toBe("/admin");
        expect(redireccionPara("/no-existe", productor)).toBeNull();
    });
});

describe("consumo de la API sin sesión válida", () => {
    let tokenVigente: string;
    let tokenVencido: string;

    beforeAll(async () => {
        const bd = crearBdPrueba();
        usarComoBdGlobal(bd);
        const cuenta = await crearCuenta(bd, { correo: "maria@ejemplo.cl", contrasena: null });
        tokenVigente = (await crearSesion(bd, cuenta, false)).token;
        tokenVencido = (await crearSesion(bd, cuenta, false, new Date(Date.now() - 9 * 3_600_000))).token;
    });

    const pedir = (token?: string) =>
        sesion({
            request: new Request("http://localhost:3000/api/v1/auth/sesion", {
                headers: token ? { cookie: `${COOKIE_SESION}=${token}` } : {},
            }),
        } as APIEvent);

    test("[P-INT-API] con sesión hay datos", async () => {
        const respuesta = await pedir(tokenVigente);
        expect(respuesta.status).toBe(200);
        expect((await respuesta.json()).correo).toBe("maria@ejemplo.cl");
    });

    test("[P-INT-API] sin token, con token vencido o alterado responde 401", async () => {
        for (const token of [undefined, tokenVencido, tokenVigente.slice(0, -2) + "xx"]) {
            const respuesta = await pedir(token);
            expect(respuesta.status).toBe(401);
            expect((await respuesta.json()).error.codigo).toBe("NO_AUTENTICADO");
        }
    });
});
