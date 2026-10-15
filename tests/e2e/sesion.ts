// Utilidades e2e. Usan las cuentas de la semilla; playwright.config.ts siembra una base propia en cada ejecución.
import { expect, type Page } from "@playwright/test";
import { ADMINISTRADOR, CONTRASENA_DEMO, PRODUCTORES } from "../../scripts/datos-piloto";

export const CORREO_PRODUCTORA = PRODUCTORES[0].correo;
export const CORREO_ADMINISTRADOR = ADMINISTRADOR.correo;

/** Inicia sesión por la API; la cookie queda en el contexto del navegador. */
export async function iniciarSesion(page: Page, correo = CORREO_PRODUCTORA) {
    const respuesta = await page.request.post("/api/v1/auth/login", {
        data: { correo, contrasena: CONTRASENA_DEMO, recordar: false },
    });
    expect(respuesta.status()).toBe(200);
}
