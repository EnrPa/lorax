import type { Page } from "@playwright/test";
import { expect, test } from "./base";
import { iniciarSesion } from "./sesion";

// Criterios de aceptación de T0.1. No respaldan una prueba de la tesis (diseno.md §12),
// por eso llevan el ID de la tarea. Inician sesión con la productora de la semilla.

async function sinScrollHorizontal(page: Page) {
    const desborde = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(desborde).toBeLessThanOrEqual(0);
}

test("[T0.1] /login no muestra la barra lateral", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await expect(page.getByRole("navigation", { name: "Menú principal" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Abrir menú" })).toHaveCount(0);
});

test("[T0.1] una URL inexistente muestra la 404 sin barra lateral", async ({ page }) => {
    await iniciarSesion(page);
    const respuesta = await page.goto("/no-existe");
    expect(respuesta?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Menú principal" })).toHaveCount(0);
    await page.getByRole("link", { name: "Volver al inicio" }).click();
    await expect(page).toHaveURL("/");
});

test("[T0.1] el menú muestra las rutas en español, sin Observaciones ni Administración", async ({ page }) => {
    await iniciarSesion(page);
    await page.goto("/");
    const abrir = page.getByRole("button", { name: "Abrir menú" });
    if (await abrir.isVisible()) await abrir.click();
    const menu = page.getByRole("navigation", { name: "Menú principal" });
    for (const nombre of ["Panel", "Historial", "Alertas", "Ajustes"]) {
        // «Alertas» lleva además el indicador de no leídas («Alertas, 2 sin leer»).
        await expect(menu.getByRole("link", { name: new RegExp(`^${nombre}(\\s*,|$)`) })).toHaveCount(1);
    }
    await expect(menu.getByText("Observaciones")).toHaveCount(0);
    await expect(menu.getByText("Administración")).toHaveCount(0);

    for (const ruta of ["/historial", "/alertas", "/ajustes"]) {
        const respuesta = await page.goto(ruta);
        expect(respuesta?.status(), ruta).toBe(200);
    }
});

test.describe("celular", () => {
    test.skip(({ viewport }) => (viewport?.width ?? 0) >= 768, "solo en pantallas de menos de 768 px");

    test("[T0.1] sin scroll horizontal y el menú se abre y se cierra", async ({ page }) => {
        await iniciarSesion(page);
        for (const ruta of ["/", "/historial", "/alertas", "/ajustes", "/no-existe"]) {
            await page.goto(ruta);
            await sinScrollHorizontal(page);
        }

        await page.goto("/");
        const menu = page.getByRole("navigation", { name: "Menú principal" });
        const abrir = page.getByRole("button", { name: "Abrir menú" });
        await expect(menu).toBeHidden();

        await abrir.click();
        await expect(menu).toBeVisible();
        await expect(abrir).toHaveAttribute("aria-expanded", "true");
        await page.getByRole("button", { name: "Cerrar menú" }).click();
        await expect(menu).toBeHidden();

        await abrir.click();
        await page.keyboard.press("Escape");
        await expect(menu).toBeHidden();

        await abrir.click();
        await menu.getByRole("link", { name: "Historial" }).click();
        await expect(page).toHaveURL("/historial");
        await expect(menu).toBeHidden();
        await sinScrollHorizontal(page);
    });
});

test.describe("escritorio", () => {
    test.skip(({ viewport }) => (viewport?.width ?? 0) < 768, "solo en escritorio");

    test("[T0.1] la barra lateral está siempre visible y no hay barra superior", async ({ page }) => {
        await iniciarSesion(page);
        await page.goto("/");
        await expect(page.getByRole("navigation", { name: "Menú principal" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Abrir menú" })).toBeHidden();
        await sinScrollHorizontal(page);
    });
});
