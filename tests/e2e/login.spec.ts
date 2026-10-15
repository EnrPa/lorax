import type { Page } from "@playwright/test";
import { expect, test } from "./base";
import { CONTRASENA_DEMO, PRODUCTORES } from "../../scripts/datos-piloto";
import { CORREO_ADMINISTRADOR, CORREO_PRODUCTORA } from "./sesion";

// CU01 desde la interfaz (RF01.1 a RF01.4 y RF01.6).
const CORREO_DESHABILITADO = PRODUCTORES.find((p) => !p.habilitada)!.correo;

async function completar(page: Page, correo: string, contrasena: string) {
    await page.goto("/login");
    await page.getByLabel("Correo").fill(correo);
    await page.getByLabel("Contraseña").fill(contrasena);
}

/** Cuenta las peticiones a la API de login mientras corre `accion`. */
async function peticionesDeLogin(page: Page, accion: () => Promise<void>) {
    let total = 0;
    const contar = (r: { url(): string }) => {
        if (r.url().includes("/api/v1/auth/login")) total++;
    };
    page.on("request", contar);
    await accion();
    page.off("request", contar);
    return total;
}

test("[P-FUN-CU01] con credenciales válidas la productora entra al panel", async ({ page }) => {
    await completar(page, CORREO_PRODUCTORA, CONTRASENA_DEMO);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page).toHaveURL("/");
});

test("[P-FUN-CU01] el administrador entra a /admin", async ({ page }) => {
    await completar(page, CORREO_ADMINISTRADOR, CONTRASENA_DEMO);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page).toHaveURL("/admin");
});

test("[P-FUN-CU01] campos vacíos se marcan sin enviar la solicitud", async ({ page }) => {
    await page.goto("/login");
    const enviadas = await peticionesDeLogin(page, async () => {
        await page.getByRole("button", { name: "Iniciar sesión" }).click();
        await expect(page.getByText("Escribe tu correo.")).toBeVisible();
        await expect(page.getByText("Escribe tu contraseña.")).toBeVisible();
    });
    expect(enviadas).toBe(0);
    await expect(page.getByLabel("Correo")).toHaveAttribute("aria-invalid", "true");
});

test("[P-FUN-CU01] un correo mal escrito se marca sin enviar la solicitud", async ({ page }) => {
    await completar(page, "maria-arroba-correo", "cualquiera");
    const enviadas = await peticionesDeLogin(page, async () => {
        await page.getByRole("button", { name: "Iniciar sesión" }).click();
        await expect(page.getByText(/Escribe un correo válido/)).toBeVisible();
    });
    expect(enviadas).toBe(0);
});

test("[P-FUN-CU01] credenciales inválidas: mensaje genérico y se conserva el correo", async ({ page }) => {
    for (const correo of [CORREO_PRODUCTORA, "nadie@lorax.local"]) {
        await completar(page, correo, "incorrecta-123");
        await page.getByRole("button", { name: "Iniciar sesión" }).click();
        await expect(page.getByRole("alert")).toHaveText(/El correo o la contraseña no son correctos/);
        await expect(page.getByLabel("Correo")).toHaveValue(correo);
        await expect(page.getByLabel("Contraseña")).toHaveValue("");
        await expect(page).toHaveURL("/login");
    }
});

test("[P-FUN-CU01] una cuenta deshabilitada no entra y el mensaje dice que no está disponible", async ({ page }) => {
    await completar(page, CORREO_DESHABILITADO, CONTRASENA_DEMO);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page.getByRole("alert")).toHaveText(/Tu cuenta no está disponible/);
    await expect(page).toHaveURL("/login");
});

test("[P-FUN-CU01] «Mantener sesión iniciada» hace durar la sesión 30 días; sin marcarla, 8 horas", async ({ page, context }) => {
    for (const [marcar, horas] of [[true, 30 * 24], [false, 8]] as const) {
        await context.clearCookies();
        await completar(page, CORREO_PRODUCTORA, CONTRASENA_DEMO);
        if (marcar) await page.getByLabel("Mantener sesión iniciada").check();
        await page.getByRole("button", { name: "Iniciar sesión" }).click();
        await expect(page).toHaveURL("/");

        const cookie = (await context.cookies()).find((c) => c.name === "lorax_sesion")!;
        const horasRestantes = (cookie.expires * 1000 - Date.now()) / 3_600_000;
        expect(horasRestantes).toBeGreaterThan(horas - 0.1);
        expect(horasRestantes).toBeLessThanOrEqual(horas);
        expect(cookie.httpOnly).toBe(true);
    }
});
