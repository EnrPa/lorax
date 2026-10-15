// Base de las pruebas e2e: importa `test` y `expect` desde aquí, no desde @playwright/test.
//
// SolidStart hidrata la página después del evento `load`: un clic antes de eso llega a un formulario
// que todavía no responde. Por eso `page.goto` espera a que la red quede inactiva, momento en que la
// página ya cargó su JavaScript y sus datos iniciales.
import { test as base, type Page } from "@playwright/test";

export { expect } from "@playwright/test";

/** Hace que `page.goto` espere la hidratación. Úsalo en páginas creadas a mano (`browser.newContext()`). */
export function prepararPagina(page: Page): Page {
    const goto = page.goto.bind(page);
    page.goto = (url, opciones) => goto(url, { waitUntil: "networkidle", ...opciones });
    return page;
}

/** Después de una navegación completa por un enlace (no del menú), espera la hidratación. */
export async function esperarHidratacion(page: Page) {
    await page.waitForLoadState("networkidle");
}

export const test = base.extend({
    page: async ({ page }, use) => {
        await use(prepararPagina(page));
    },
});
