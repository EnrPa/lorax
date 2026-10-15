import type { Page } from "@playwright/test";
import type { EstadoTerreno } from "../../src/lib/esquemas/estado";
import type { LecturasRecientes } from "../../src/lib/esquemas/criterios";
import { expect, test } from "./base";
import { ejecutarEmulador } from "./emulador";
import { CORREO_PRODUCTORA, iniciarSesion } from "./sesion";

// Flujos completos de la tesis (diseno.md §12): el emulador real envía tramas al servidor de las
// pruebas y la interfaz las muestra. Modifica alertas y lecturas de María: corre en el proyecto
// «datos-1» (playwright.config.ts), antes de que la administración elimine uno de sus umbrales.

const estacion = (page: Page, serie: string) => page.getByRole("region", { name: `Estación ${serie}` });
const tarjeta = (page: Page, serie: string, variable: string) => estacion(page, serie).getByRole("article", { name: variable });

/** Exige 200 en todas las tramas de la ronda que imprimió el emulador. */
function exigirAceptadas(salida: string, estaciones: number) {
    const lineas = salida.split("\n").filter((l) => /^\s+EST-\d+ →/.test(l));
    expect(lineas, salida).toHaveLength(estaciones);
    for (const linea of lineas) expect(linea).toMatch(/→ 200 · 6 aceptadas/);
}

/** Cantidad de alertas sin leer que anuncia el menú («Alertas, 2 sin leer»). */
async function noLeidas(page: Page): Promise<number> {
    const abrir = page.getByRole("button", { name: "Abrir menú" });
    if (await abrir.isVisible()) await abrir.click();
    const enlace = page.getByRole("navigation", { name: "Menú principal" }).getByRole("link", { name: /^Alertas/ });
    const nombre = (await enlace.getAttribute("aria-label")) ?? (await enlace.innerText());
    return Number(/(\d+) sin leer/.exec(nombre.replace(/\s+/g, " "))?.[1] ?? 0);
}

test("[P-E2E-INGESTA-PANEL] el emulador envía una trama y el panel la muestra con su estado", async ({ page }) => {
    await iniciarSesion(page, CORREO_PRODUCTORA);
    await page.goto("/");

    // Situaciones de la semilla: EST-0003 sin reportar y la humedad del suelo de EST-0001 bajo el umbral.
    await expect(estacion(page, "EST-0003").getByText("Sin datos recientes").first()).toBeVisible();
    await expect(tarjeta(page, "EST-0001", "Humedad del suelo").getByText("Fuera de rango")).toBeVisible();

    exigirAceptadas(ejecutarEmulador("normal"), 8);
    await page.reload({ waitUntil: "networkidle" });

    // EST-0003 vuelve a reportar y la humedad del suelo de EST-0001 vuelve a la normalidad.
    const est3 = estacion(page, "EST-0003");
    await expect(est3.getByText("Activa")).toBeVisible();
    await expect(est3.getByText("Sin datos recientes")).toHaveCount(0);
    await expect(tarjeta(page, "EST-0001", "Humedad del suelo").getByText("Normal")).toBeVisible();

    // La tarjeta muestra la lectura que acaba de llegar, con su unidad.
    const [terreno] = (await (await page.request.get("/api/v1/terrenos")).json()).items as Array<{ id: number }>;
    const estado = (await (await page.request.get(`/api/v1/terrenos/${terreno!.id}/estado`)).json()) as EstadoTerreno;
    const sensorId = estado.estaciones.find((e) => e.numeroSerie === "EST-0003")!.variables.find((v) => v.tipo === "temperatura_aire")!.sensorId;
    const { lecturas } = (await (await page.request.get(`/api/v1/sensores/${sensorId}/lecturas-recientes`)).json()) as LecturasRecientes;
    const ultima = lecturas[0]!;
    expect(Date.now() - new Date(ultima.fecha).getTime()).toBeLessThan(2 * 60_000);

    const temperatura = tarjeta(page, "EST-0003", "Temperatura del aire");
    await expect(temperatura.locator(".tarjeta-numero")).toHaveText(new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 }).format(ultima.valor));
    await expect(temperatura.locator(".tarjeta-unidad")).toHaveText("°C");
    await expect(temperatura.getByText("hace un momento")).toBeVisible();
});

test("[P-E2E-DATO-ALERTA] escenario sequia: alerta en el panel, correo en /dev/correos e indicador de no leídas", async ({ page, browser }) => {
    await iniciarSesion(page, CORREO_PRODUCTORA);
    // «normal» resuelve la alerta vigente de la semilla; así «sequia» crea una alerta nueva.
    exigirAceptadas(ejecutarEmulador("normal"), 8);
    await page.goto("/");
    await expect(tarjeta(page, "EST-0001", "Humedad del suelo").getByText("Normal")).toBeVisible();
    const antes = await noLeidas(page);

    exigirAceptadas(ejecutarEmulador("sequia"), 8);
    await page.reload({ waitUntil: "networkidle" });

    // Panel: la variable fuera de rango, con el umbral que incumple, y la alerta vigente arriba.
    const humedad = tarjeta(page, "EST-0001", "Humedad del suelo");
    await expect(humedad.getByText("Fuera de rango")).toBeVisible();
    await expect(humedad.getByText("bajo 25 %")).toBeVisible();
    const alertas = page.getByRole("region", { name: "Alertas recientes" });
    const vigente = alertas.getByRole("listitem").first();
    await expect(vigente).toContainText("Vigente");
    await expect(vigente).toContainText("Humedad del suelo bajo el umbral en Parcela Los Castaños (EST-0001)");
    await expect(vigente).toContainText("(umbral 25 %)");

    // El indicador del menú sube en uno.
    expect(await noLeidas(page)).toBe(antes + 1);

    // Correo enviado por el despachador real, visible en la bandeja de desarrollo (sin sesión).
    const bandeja = await (await browser.newContext()).newPage();
    await bandeja.goto("/dev/correos", { waitUntil: "networkidle" });
    const correo = bandeja.locator(".correo").first();
    await expect(correo).toContainText("Alerta LoRax: Humedad del suelo bajo el umbral");
    await expect(correo).toContainText(CORREO_PRODUCTORA);
    await expect(correo).toContainText("Parcela Los Castaños (EST-0001)");
});
