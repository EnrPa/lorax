import type { EventoAdmin } from "../../src/lib/esquemas/admin";
import type { Pagina } from "../../src/lib/esquemas/paginacion";
import { expect, test } from "./base";
import { URL_BASE } from "./entorno";
import { CORREO_ADMINISTRADOR, iniciarSesion } from "./sesion";

// T6.1 (diseno.md §8.4 y §11): límite de intentos en la pantalla de inicio de sesión, verificación de
// origen y encabezados de seguridad. Usa correos inexistentes, uno por proyecto, para no bloquear las
// cuentas de la semilla.

test("[P-FUN-CU01] tras 5 intentos fallidos, el inicio de sesión muestra «Demasiados intentos»", async ({ page }, info) => {
    const correo = `bloqueo-${info.project.name}@lorax.local`;
    await page.goto("/login");
    const intentar = async () => {
        await page.getByLabel("Correo").fill(correo);
        await page.getByLabel("Contraseña").fill("incorrecta-123");
        await page.getByRole("button", { name: "Iniciar sesión" }).click();
    };
    for (let i = 0; i < 5; i++) {
        await intentar();
        await expect(page.getByRole("alert")).toHaveText(/El correo o la contraseña no son correctos/);
    }
    await intentar();
    await expect(page.getByRole("alert")).toHaveText("Demasiados intentos. Vuelve a intentarlo en 15 minutos.");
    await expect(page).toHaveURL("/login");
});

test("[T6.1] una mutación con un origen ajeno se rechaza con 403 y queda en el registro de eventos", async ({ page }, info) => {
    const origen = `http://malicioso-${info.project.name}.example`;
    const respuesta = await page.request.post("/api/v1/auth/logout", { headers: { Origin: origen } });
    expect(respuesta.status()).toBe(403);
    expect((await respuesta.json()).error.codigo).toBe("PROHIBIDO");

    // El mismo pedido desde el propio origen pasa la verificación.
    expect((await page.request.post("/api/v1/auth/logout", { headers: { Origin: URL_BASE } })).status()).not.toBe(403);

    await iniciarSesion(page, CORREO_ADMINISTRADOR);
    const lista = (await (await page.request.get("/api/v1/admin/eventos?tipo=ORIGEN_RECHAZADO&tamano=100")).json()) as Pagina<EventoAdmin>;
    const evento = lista.items.find((e) => (e.detalle as { origen?: string }).origen === origen);
    expect(evento?.detalle).toEqual({ origen, ruta: "/api/v1/auth/logout", metodo: "POST" });
});

test("[T6.1] las páginas y la API responden con los encabezados de seguridad", async ({ page }) => {
    const pagina = await page.goto("/login");
    const api = await page.request.get("/api/salud");
    for (const encabezados of [pagina!.headers(), api.headers()]) {
        expect(encabezados["content-security-policy"]).toContain("frame-ancestors 'none'");
        expect(encabezados["content-security-policy"]).toContain("object-src 'none'");
        expect(encabezados["x-content-type-options"]).toBe("nosniff");
        expect(encabezados["x-frame-options"]).toBe("DENY");
        expect(encabezados["referrer-policy"]).toBe("same-origin");
    }
});
