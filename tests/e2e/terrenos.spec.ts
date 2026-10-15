import { expect, test } from "./base";
import { PRODUCTORES } from "../../scripts/datos-piloto";
import { iniciarSesion } from "./sesion";

// T2.1: registro de terrenos y estaciones desde Ajustes (RF02). Usa a Ana (sin terrenos) y crea datos:
// corre en el proyecto «datos-1» (playwright.config.ts), antes de que la recuperación cambie su contraseña.
const ANA = PRODUCTORES[2].correo;

test("[P-FUN-CU02] registrar terreno con estación, conflicto de número de serie y agregar estación", async ({ page }) => {
    await iniciarSesion(page, ANA);
    await page.goto("/ajustes?pestana=terrenos");

    // Estado vacío que invita a actuar.
    await expect(page.getByText("Aún no tienes terrenos. Registra el primero.")).toBeVisible();
    await page.getByRole("button", { name: "Registrar terreno" }).click();

    // Los 6 sensores vienen marcados.
    for (const etiqueta of ["Temperatura del aire", "Humedad del aire", "Humedad del suelo", "Nitrógeno (N)", "Fósforo (P)", "Potasio (K)"]) {
        await expect(page.getByLabel(new RegExp(`^${etiqueta.replace(/[()]/g, "\\$&")}`))).toBeChecked();
    }

    // Decimal ambiguo: error de §9, sin enviar.
    await page.getByLabel("Nombre del terreno").fill("Viña Las Rosas");
    await page.getByLabel("Latitud").first().fill("1.234,5");
    await page.getByRole("button", { name: "Registrar terreno" }).click();
    await expect(page.getByText("Usa coma o punto solo para los decimales, por ejemplo -38,95")).toBeVisible();

    await page.getByLabel("Latitud").first().fill("-35,12");
    await page.getByLabel("Longitud").first().fill("-71,28");
    await page.getByLabel("Superficie en hectáreas (opcional)").fill("3,5");
    await page.getByLabel("Tipo de estación").fill("Estación de terreno");
    await page.getByLabel("Modelo").fill("LX-100");

    // Número de serie repetido: error junto al campo y se conserva lo ingresado (RF02.4 y RF02.5).
    await page.getByLabel("Número de serie").fill("EST-0001");
    await page.getByRole("button", { name: "Registrar terreno" }).click();
    await expect(page.getByText(/Ya existe una estación con el número de serie EST-0001/).first()).toBeVisible();
    await expect(page.getByLabel("Nombre del terreno")).toHaveValue("Viña Las Rosas");

    await page.getByLabel("Número de serie").fill("EST-9001");
    await page.getByLabel(/^Potasio/).uncheck();
    await page.getByRole("button", { name: "Registrar terreno" }).click();
    await expect(page.getByRole("status")).toHaveText("Se registró el terreno «Viña Las Rosas».");

    const terreno = page.getByRole("article", { name: "Viña Las Rosas" });
    await expect(terreno).toContainText("EST-9001");
    await expect(terreno).toContainText("3,5 ha");
    await expect(terreno).not.toContainText("Potasio");

    // Agregar una estación al terreno existente (RF02.6).
    await terreno.getByRole("button", { name: "Agregar estación" }).click();
    await page.getByLabel("Tipo de estación").fill("Estación de terreno");
    await page.getByLabel("Modelo").fill("LX-200");
    await page.getByLabel("Número de serie").fill("EST-9002");
    await page.getByRole("button", { name: "Agregar estación" }).click();
    await expect(page.getByRole("status")).toHaveText("Se agregó la estación a «Viña Las Rosas».");
    await expect(page.getByRole("article", { name: "Viña Las Rosas" })).toContainText("2 estaciones");
});
