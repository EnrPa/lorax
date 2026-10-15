import { esperarHidratacion, expect, prepararPagina, test } from "./base";
import { CONTRASENA_DEMO, PRODUCTORES } from "../../scripts/datos-piloto";
import { iniciarSesion } from "./sesion";

// Aceptación de T1.4: flujo completo de recuperación, desde pedir el enlace hasta entrar con la
// contraseña nueva. Usa a Ana y le cambia la contraseña: corre en el proyecto «datos-2»
// (playwright.config.ts), después de la prueba de terrenos, que también usa a Ana.
const CORREO = PRODUCTORES[2].correo;
const NUEVA = "UnaFraseNuevaParaAna2026";

test("[P-FUN-CU01] recuperación: pedir el enlace, abrirlo desde /dev/correos, definir la contraseña y entrar", async ({ browser }) => {
    // Una sesión abierta antes de restablecer, en otro navegador.
    const anterior = await browser.newContext();
    const paginaAnterior = prepararPagina(await anterior.newPage());
    await iniciarSesion(paginaAnterior, CORREO);

    const context = await browser.newContext();
    const page = prepararPagina(await context.newPage());

    // 1. Pedir el enlace.
    await page.goto("/login");
    await page.getByRole("button", { name: "¿Olvidaste tu contraseña?" }).click();
    const recuperar = page.locator("form", { hasText: "Recuperar contraseña" });
    await recuperar.getByLabel("Correo").fill(CORREO);
    await recuperar.getByRole("button", { name: "Enviar enlace" }).click();
    await expect(page.getByRole("status")).toHaveText(/Si el correo está registrado, te enviamos un enlace/);

    // 2. Abrirlo desde la bandeja de desarrollo.
    await page.goto("/dev/correos");
    const correo = page.locator(".correo").first();
    await expect(correo).toContainText(CORREO);
    await correo.getByRole("link", { name: /\/restablecer\?token=/ }).click();
    await expect(page).toHaveURL(/\/restablecer\?token=/);
    await esperarHidratacion(page);

    // 3. Confirmación distinta: se marca sin enviar.
    await page.getByLabel("Nueva contraseña").fill(NUEVA);
    await page.getByLabel("Repite la contraseña").fill(NUEVA + "x");
    await page.getByRole("button", { name: "Guardar contraseña" }).click();
    await expect(page.getByText("Las contraseñas no coinciden")).toBeVisible();

    // 4. Definir la contraseña: vuelve a /login con el aviso.
    await page.getByLabel("Repite la contraseña").fill(NUEVA);
    await page.getByRole("button", { name: "Guardar contraseña" }).click();
    await expect(page).toHaveURL("/login?aviso=contrasena-actualizada");
    await esperarHidratacion(page);
    await expect(page.getByRole("status")).toHaveText("Tu contraseña se actualizó. Inicia sesión con ella.");

    // 5. La contraseña anterior ya no sirve; la nueva sí.
    const login = page.locator("form", { hasText: "Iniciar sesión" }).first();
    await login.getByLabel("Correo").fill(CORREO);
    await login.getByLabel("Contraseña").fill(CONTRASENA_DEMO);
    await login.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page.getByRole("alert")).toHaveText(/no son correctos/);

    await login.getByLabel("Contraseña").fill(NUEVA);
    await login.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page).toHaveURL("/");

    // 6. La sesión abierta antes quedó revocada.
    await paginaAnterior.goto("/");
    await expect(paginaAnterior).toHaveURL("/login");
});
