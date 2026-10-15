import { esperarHidratacion, expect, prepararPagina, test } from "./base";
import { CORREO_ADMINISTRADOR, iniciarSesion } from "./sesion";

// P-FUN-CU07 desde la interfaz (RF07). Modifica datos: corre en el proyecto «datos-2» (playwright.config.ts).

test("[P-FUN-CU07] registrar un productor, activarlo desde /dev/correos y entrar", async ({ page, browser }) => {
    await iniciarSesion(page, CORREO_ADMINISTRADOR);
    await page.goto("/admin");
    await page.getByRole("button", { name: "Registrar productor" }).click();

    await page.getByLabel("Nombre", { exact: true }).fill("Rosa");
    await page.getByLabel("Apellido").fill("Pérez");
    await page.getByLabel("Correo").fill("Rosa.Perez@Lorax.Local");
    await page.getByLabel("Empresa nueva").check();
    await page.getByLabel("Nombre de la empresa").fill("Frutales Pérez SpA");

    // RUT con dígito verificador incorrecto: error junto al campo.
    await page.getByLabel("RUT de la empresa").fill("76.111.222-9");
    await page.getByRole("button", { name: "Registrar productor" }).click();
    await expect(page.getByText(/dígito verificador/)).toBeVisible();

    await page.getByLabel("RUT de la empresa").fill("76.111.222-8");
    await page.getByRole("button", { name: "Registrar productor" }).click();
    await expect(page.getByRole("status")).toContainText("Se creó la cuenta y se envió el enlace de activación a rosa.perez@lorax.local");
    await expect(page.getByText("Pendiente de activación")).toBeVisible();

    // El productor abre el enlace desde la bandeja de desarrollo y define su contraseña.
    const productor = prepararPagina(await (await browser.newContext()).newPage());
    await productor.goto("/dev/correos");
    const correo = productor.locator(".correo", { hasText: "rosa.perez@lorax.local" }).first();
    await expect(correo).toContainText("Activa tu cuenta en LoRax");
    await correo.getByRole("link", { name: /restablecer\?token=/ }).click();
    await esperarHidratacion(productor);
    await productor.getByLabel("Nueva contraseña").fill("UnaFraseParaRosa2026");
    await productor.getByLabel("Repite la contraseña").fill("UnaFraseParaRosa2026");
    await productor.getByRole("button", { name: "Guardar contraseña" }).click();
    await expect(productor).toHaveURL(/\/login\?aviso=contrasena-actualizada/);
    await esperarHidratacion(productor);
    await productor.getByLabel("Correo").first().fill("rosa.perez@lorax.local");
    await productor.getByLabel("Contraseña").fill("UnaFraseParaRosa2026");
    await productor.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(productor).toHaveURL("/");
});

test("[P-FUN-CU07] deshabilitar cuenta, estación y umbral piden motivo y quedan en el registro de eventos", async ({ page }) => {
    await iniciarSesion(page, CORREO_ADMINISTRADOR);
    await page.goto("/admin");
    await page.getByRole("button", { name: /Ver detalle de Pedro/ }).waitFor();

    // Deshabilitar la cuenta de José: sin motivo no se puede confirmar.
    await page.getByRole("button", { name: /Ver detalle de José/ }).click();
    await page.getByRole("button", { name: "Deshabilitar cuenta" }).click();
    const dialogo = page.getByRole("dialog");
    await dialogo.getByRole("button", { name: "Deshabilitar cuenta" }).click();
    await expect(dialogo.getByText("Escribe el motivo de esta acción.")).toBeVisible();
    await dialogo.getByLabel("Motivo (obligatorio)").fill("Solicitud del productor.");
    await dialogo.getByRole("button", { name: "Deshabilitar cuenta" }).click();
    await expect(page.getByRole("status")).toHaveText("La cuenta quedó deshabilitada y se cerraron sus sesiones abiertas.");
    await expect(page.getByRole("button", { name: "Habilitar cuenta" })).toBeVisible();

    // Deshabilitar una estación de María y eliminar su umbral.
    await page.getByRole("button", { name: "Volver a las cuentas" }).click();
    await page.getByRole("button", { name: /Ver detalle de María/ }).click();
    await page.getByRole("tab", { name: "Terrenos y estaciones" }).click();
    await page.getByRole("listitem").filter({ hasText: "EST-0004" }).getByRole("button", { name: "Deshabilitar estación" }).click();
    await dialogo.getByLabel("Motivo (obligatorio)").fill("Equipo en mantención.");
    await dialogo.getByRole("button", { name: "Deshabilitar estación" }).click();
    await expect(page.getByRole("status")).toContainText("La estación quedó deshabilitada");

    await page.getByRole("tab", { name: "Umbrales" }).click();
    await page.getByRole("button", { name: "Eliminar umbral" }).first().click();
    await dialogo.getByLabel("Motivo (obligatorio)").fill("Umbral mal configurado.");
    await dialogo.getByRole("button", { name: "Eliminar umbral" }).click();
    await expect(page.getByRole("status")).toContainText("El umbral se eliminó");

    // Ninguna opción sobre mediciones (RF07.5).
    await expect(page.getByText(/medici/i)).toHaveCount(0);

    // Las tres operaciones aparecen en el registro, con su motivo.
    await page.getByRole("tab", { name: "Eventos" }).click();
    for (const motivo of ["Solicitud del productor.", "Equipo en mantención.", "Umbral mal configurado."]) {
        await expect(page.getByText(`Motivo: ${motivo}`)).toBeVisible();
    }
});

test("[P-SEG-AISLAMIENTO] una productora que pide /admin vuelve a su panel", async ({ page }) => {
    await iniciarSesion(page);
    await page.goto("/admin");
    await expect(page).toHaveURL("/");
});
