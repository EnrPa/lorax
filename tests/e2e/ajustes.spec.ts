import { expect, test } from "./base";
import { CONTRASENA_DEMO, PRODUCTORES } from "../../scripts/datos-piloto";
import { iniciarSesion } from "./sesion";

// T1.5: Ajustes, pestañas Perfil y Seguridad. Usa a José y cambia sus datos y su contraseña: corre en
// el proyecto «datos-1» (playwright.config.ts), antes de que la administración lo deshabilite.
const JOSE = PRODUCTORES[1];

test("[T1.5] editar el perfil actualiza los datos y el saludo; correo y empresa son solo de lectura", async ({ page }) => {
    await iniciarSesion(page, JOSE.correo);
    await page.goto("/ajustes");

    await expect(page.getByLabel("Nombre")).toHaveValue(JOSE.nombre);
    await expect(page.getByText(JOSE.correo)).toBeVisible();
    await expect(page.getByText(JOSE.empresa.nombre, { exact: false })).toBeVisible();
    await expect(page.getByLabel("Correo")).toHaveCount(0); // no es un campo editable

    // Teléfono sin código de país: error junto al campo, sin guardar.
    await page.getByLabel("Teléfono (opcional)").fill("912345678");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText(/código de país/)).toBeVisible();

    await page.getByLabel("Nombre").fill("José Luis");
    await page.getByLabel("Teléfono (opcional)").fill("+56 9 8765 4321");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByRole("status")).toHaveText("Tus datos se guardaron.");
    await expect(page.getByLabel("Teléfono (opcional)")).toHaveValue("+56987654321");

    const abrir = page.getByRole("button", { name: "Abrir menú" });
    if (await abrir.isVisible()) await abrir.click();
    await expect(page.getByText("Hola, José Luis")).toBeVisible();
});

test("[T1.5] cambiar la contraseña exige la actual y una nueva de al menos 12 caracteres", async ({ page }) => {
    const NUEVA = "OtraFraseParaJose2026";
    await iniciarSesion(page, JOSE.correo);
    await page.goto("/ajustes?pestana=seguridad");
    await expect(page.getByRole("tab", { name: "Seguridad" })).toHaveAttribute("aria-selected", "true");

    await page.getByLabel("Contraseña actual").fill("incorrecta");
    await page.getByLabel("Nueva contraseña", { exact: true }).fill("corta");
    await page.getByLabel("Repite la nueva contraseña").fill("corta");
    await page.getByRole("button", { name: "Cambiar contraseña" }).click();
    await expect(page.getByText("La contraseña debe tener al menos 12 caracteres.")).toBeVisible();

    await page.getByLabel("Nueva contraseña", { exact: true }).fill(NUEVA);
    await page.getByLabel("Repite la nueva contraseña").fill(NUEVA);
    await page.getByRole("button", { name: "Cambiar contraseña" }).click();
    await expect(page.getByText(/La contraseña actual no es correcta/)).toBeVisible();

    await page.getByLabel("Contraseña actual").fill(CONTRASENA_DEMO);
    await page.getByRole("button", { name: "Cambiar contraseña" }).click();
    await expect(page.getByRole("status")).toHaveText(/Tu contraseña se cambió/);
});
