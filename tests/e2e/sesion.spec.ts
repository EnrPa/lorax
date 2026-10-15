import { expect, test } from "./base";
import { CORREO_ADMINISTRADOR, iniciarSesion } from "./sesion";

// P-INT-API (diseno.md §12): sin token o con token vencido, la interfaz pide iniciar sesión.
// Usa la base que playwright.config.ts siembra en cada ejecución.

async function abrirMenu(page: import("@playwright/test").Page) {
    const abrir = page.getByRole("button", { name: "Abrir menú" });
    if (await abrir.isVisible()) await abrir.click();
    return page.getByRole("navigation", { name: "Menú principal" });
}

test("[P-INT-API] sin sesión, cualquier página lleva a /login", async ({ page }) => {
    for (const ruta of ["/", "/historial", "/admin", "/no-existe"]) {
        await page.goto(ruta);
        await expect(page, ruta).toHaveURL("/login");
    }
});

test("[P-INT-API] con una cookie alterada o vencida lleva a /login y la cookie se borra", async ({ page, context }) => {
    await iniciarSesion(page);
    const [cookie] = await context.cookies();
    await context.addCookies([{ ...cookie, value: cookie.value.slice(0, -2) + "xx" }]);

    await page.goto("/");
    await expect(page).toHaveURL("/login");
    expect((await context.cookies()).find((c) => c.name === "lorax_sesion")).toBeUndefined();
});

test("[P-INT-API] con sesión de productora se ve su menú y /admin la devuelve al panel", async ({ page }) => {
    await iniciarSesion(page);
    await page.goto("/");
    const menu = await abrirMenu(page);
    await expect(menu.getByText("Hola, María")).toBeVisible();
    for (const nombre of ["Panel", "Historial", "Alertas", "Ajustes"]) {
        // «Alertas» lleva además el indicador de no leídas («Alertas, 2 sin leer»).
        await expect(menu.getByRole("link", { name: new RegExp(`^${nombre}(\\s*,|$)`) })).toBeVisible();
    }
    await expect(menu.getByRole("link", { name: "Administración" })).toHaveCount(0);

    await page.goto("/admin");
    await expect(page).toHaveURL("/");
});

test("[P-INT-API] con sesión de administrador se ve su menú y las páginas de productor lo llevan a /admin", async ({ page }) => {
    await iniciarSesion(page, CORREO_ADMINISTRADOR);
    await page.goto("/");
    await expect(page).toHaveURL("/admin");
    const menu = await abrirMenu(page);
    await expect(menu.getByRole("link", { name: "Administración" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Ajustes" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Historial" })).toHaveCount(0);
});

test("[P-INT-API] con sesión, /login lleva al inicio del rol", async ({ page }) => {
    await iniciarSesion(page);
    await page.goto("/login");
    await expect(page).toHaveURL("/");
});

test("[P-INT-API] cerrar sesión la invalida: volver atrás pide iniciar sesión", async ({ page }) => {
    await iniciarSesion(page);
    await page.goto("/historial");
    const menu = await abrirMenu(page);
    await menu.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL("/login");

    await page.goto("/historial");
    await expect(page).toHaveURL("/login");
});
