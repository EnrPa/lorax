import { describe, expect, test } from "vitest";
import { detalleRechazo, encabezadosSeguridad, origenPermitido, requiereVerificarOrigen } from "~/server/auth/seguridad";

// T6.1 (diseno.md §11): verificación de origen en las mutaciones y encabezados de seguridad. No respaldan
// una fila de la tesis; llevan el ID de la tarea.

const APP = "http://localhost:3000";
const pedido = (encabezados: Record<string, string>, url = `${APP}/api/v1/auth/logout`) =>
    new Request(url, { method: "POST", headers: encabezados });

describe("[T6.1] Verificación de origen (CSRF)", () => {
    test("[T6.1] se verifican las mutaciones de la API, salvo la ingesta", () => {
        for (const metodo of ["POST", "PUT", "PATCH", "DELETE", "patch"]) expect(requiereVerificarOrigen(metodo, "/api/v1/criterios/3")).toBe(true);
        expect(requiereVerificarOrigen("GET", "/api/v1/terrenos")).toBe(false);
        expect(requiereVerificarOrigen("POST", "/api/v1/ingesta")).toBe(false);
        expect(requiereVerificarOrigen("POST", "/login")).toBe(false);
    });

    test("[T6.1] se acepta el origen de APP_URL o el de la propia solicitud", () => {
        expect(origenPermitido(pedido({ Origin: APP }), APP)).toBe(true);
        expect(origenPermitido(pedido({ Origin: "http://127.0.0.1:3000" }, "http://127.0.0.1:3000/api/v1/auth/logout"), APP)).toBe(true);
    });

    test("[T6.1] se rechaza otro origen, también el origen «null»", () => {
        expect(origenPermitido(pedido({ Origin: "http://malicioso.example" }), APP)).toBe(false);
        expect(origenPermitido(pedido({ Origin: "http://localhost:3001" }), APP)).toBe(false);
        expect(origenPermitido(pedido({ Origin: "null" }), APP)).toBe(false);
    });

    test("[T6.1] sin Origin, se rechaza solo si el navegador indica que viene de otro sitio", () => {
        expect(origenPermitido(pedido({ "Sec-Fetch-Site": "cross-site" }), APP)).toBe(false);
        expect(origenPermitido(pedido({ "Sec-Fetch-Site": "same-origin" }), APP)).toBe(true);
        expect(origenPermitido(pedido({}), APP)).toBe(true); // cliente que no es navegador
    });

    test("[T6.1] el detalle del rechazo guarda solo origen, ruta y método, truncados", () => {
        const largo = `http://${"x".repeat(500)}.example`;
        const req = new Request(`${APP}/api/v1/auth/logout`, {
            method: "POST",
            headers: { Origin: largo, Cookie: "lorax_sesion=token-secreto", Authorization: "Bearer otro-secreto" },
            body: JSON.stringify({ contrasena: "cuerpo-secreto" }),
        });
        const detalle = detalleRechazo(req);
        expect(Object.keys(detalle).sort()).toEqual(["metodo", "origen", "ruta"]);
        expect(detalle).toMatchObject({ ruta: "/api/v1/auth/logout", metodo: "POST" });
        expect(detalle.origen).toHaveLength(200);
        expect(JSON.stringify(detalle)).not.toMatch(/secreto/);
    });
});

describe("[T6.1] Encabezados de seguridad", () => {
    test("[T6.1] la CSP es restrictiva salvo 'unsafe-inline', y el websocket de Vite solo en desarrollo", () => {
        const produccion = encabezadosSeguridad(APP, false);
        const csp = produccion["Content-Security-Policy"]!;
        for (const directiva of ["default-src 'self'", "object-src 'none'", "base-uri 'self'", "frame-ancestors 'none'", "connect-src 'self';"]) {
            expect(csp).toContain(directiva);
        }
        expect(csp).not.toContain("ws:");
        expect(encabezadosSeguridad(APP, true)["Content-Security-Policy"]).toContain("connect-src 'self' ws://localhost:*");
        expect(produccion).toMatchObject({
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "Referrer-Policy": "same-origin",
            "Cross-Origin-Opener-Policy": "same-origin",
        });
    });

    test("[T6.1] HSTS solo con APP_URL en https", () => {
        expect(encabezadosSeguridad(APP, false)).not.toHaveProperty("Strict-Transport-Security");
        expect(encabezadosSeguridad("https://lorax.example", false)["Strict-Transport-Security"]).toMatch(/max-age=\d+/);
    });
});
