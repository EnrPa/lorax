import type { Locator, Page } from "@playwright/test";
import { CONTRASENA_DEMO } from "../../scripts/datos-piloto";
import { expect, test } from "./base";
import { CORREO_PRODUCTORA, iniciarSesion } from "./sesion";

// Incidencia 5 (T6.8, diseno.md §8.4): antes de hidratar, o sin JavaScript, un formulario no debe enviar
// sus datos. Antes de la corrección, el navegador hacía el envío nativo por GET y la contraseña quedaba en
// la URL (/login?correo=...&contrasena=...). No modifica datos: el token de restablecimiento es ficticio y
// ningún envío llega al servidor.
test.use({ javaScriptEnabled: false });

/** Registra todas las peticiones de la página: método, URL y cuerpo. */
function registrarPeticiones(page: Page): string[] {
    const peticiones: string[] = [];
    page.on("request", (r) => peticiones.push(`${r.method()} ${r.url()} ${r.postData() ?? ""}`));
    return peticiones;
}

/** El texto contiene el secreto, tal cual o codificado como en una URL o un formulario (`%21`, `+`). */
function contiene(texto: string, secreto: string): boolean {
    const variantes = [texto];
    try {
        variantes.push(decodeURIComponent(texto.replace(/\+/g, " ")));
    } catch {
        // Una secuencia % inválida: basta con el texto sin decodificar.
    }
    return variantes.some((v) => v.includes(secreto));
}

/**
 * Intenta enviar el formulario como lo haría una persona (Enter en el último campo y clic en el botón) y
 * verifica que la contraseña no aparezca en la URL ni en ninguna petición. Luego verifica el botón.
 */
async function intentarEnviar(page: Page, formulario: Locator, secretos: string[]) {
    const peticiones = registrarPeticiones(page);
    const boton = formulario.locator('button[type="submit"]');
    const sinFugas = async () => {
        await page.waitForLoadState("networkidle");
        for (const secreto of secretos) {
            expect(contiene(page.url(), secreto), `la URL contiene la contraseña: ${page.url()}`).toBe(false);
            expect(peticiones.filter((p) => contiene(p, secreto))).toEqual([]);
        }
    };
    // Se revisa después de cada intento: un envío nativo cambiaría de página y el formulario ya no estaría.
    await formulario.locator("input").last().press("Enter");
    await sinFugas();
    await boton.click({ force: true });
    await sinFugas();

    // El botón espera la hidratación: deshabilitado, con «Cargando…» y aria-busy (diseno.md §9).
    await expect(boton).toBeDisabled();
    await expect(boton).toHaveText("Cargando…");
    await expect(boton).toHaveAttribute("aria-busy", "true");
    await expect(formulario).toHaveAttribute("method", "post");
}

test("[P-SEG-CONTRASENAS] sin JavaScript, el inicio de sesión no envía la contraseña ni la deja en la URL", async ({ page }) => {
    await page.goto("/login");
    const formulario = page.locator("form", { hasText: "Iniciar sesión" });
    await formulario.getByLabel("Correo").fill(CORREO_PRODUCTORA);
    await formulario.getByLabel("Contraseña").fill(CONTRASENA_DEMO);
    await intentarEnviar(page, formulario, [CONTRASENA_DEMO]);
    await expect(page).toHaveURL("/login");
});

test("[P-SEG-CONTRASENAS] sin JavaScript, restablecer la contraseña no la envía ni la deja en la URL", async ({ page }) => {
    const nueva = "UnaClaveNueva!2026";
    await page.goto("/restablecer?token=token-ficticio-de-prueba");
    const formulario = page.locator("form");
    await formulario.getByLabel("Nueva contraseña").fill(nueva);
    await formulario.getByLabel("Repite la contraseña").fill(nueva);
    await intentarEnviar(page, formulario, [nueva]);
});

test("[P-SEG-CONTRASENAS] sin JavaScript, cambiar la contraseña en Ajustes no la envía ni la deja en la URL", async ({ page }) => {
    const nueva = "OtraClaveNueva!2026";
    await iniciarSesion(page);
    await page.goto("/ajustes?pestana=seguridad");
    const formulario = page.locator("form", { hasText: "Cambiar contraseña" });
    await formulario.getByLabel("Contraseña actual").fill(CONTRASENA_DEMO);
    await formulario.getByLabel("Nueva contraseña", { exact: true }).fill(nueva);
    await formulario.getByLabel("Repite la nueva contraseña").fill(nueva);
    await intentarEnviar(page, formulario, [CONTRASENA_DEMO, nueva]);
});
