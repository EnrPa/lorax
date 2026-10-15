import { readFileSync } from "node:fs";
import { diaChile, fechaHoraChile, rangoDeDias, sumarDias } from "../../src/lib/fechas";
import { expect, test } from "./base";
import { iniciarSesion } from "./sesion";

// P-E2E-HISTORIAL (diseno.md §12): serie, comparación y descarga del CSV con contenido correcto.
// Usa la base que playwright.config.ts siembra en cada ejecución (siempre al día).

test("[P-E2E-HISTORIAL] serie con atajos, comparación superpuesta y descarga del CSV", async ({ page }) => {
    await iniciarSesion(page);
    await page.goto("/historial");

    // Por defecto: 7 días, agregado a 30 minutos.
    await expect(page.getByText("Promedios cada 30 minutos.")).toBeVisible();
    await page.getByLabel("Variable").selectOption("humedad_suelo");
    await expect(page.getByRole("img", { name: /Humedad del suelo en Parcela Los Castaños/ })).toBeVisible();

    // Atajos y su intervalo de agregación.
    await page.getByRole("button", { name: "Últimas 24 h" }).click();
    await expect(page.getByText("Mediciones cada 15 minutos, sin agregar.")).toBeVisible();
    await page.getByRole("button", { name: "30 días" }).click();
    await expect(page.getByText("Promedios cada 3 horas.")).toBeVisible();

    // Comparación con la semana anterior: aparece la leyenda del periodo comparado.
    await page.getByLabel("Semana anterior").check();
    await page.getByRole("button", { name: "Ver historial" }).click();
    await expect(page.getByText("Promedios cada 3 horas.")).toBeVisible();

    // Rango invertido: error y no se consulta (RF05.2).
    await page.getByLabel("Desde").fill("2026-09-20");
    await page.getByLabel("Hasta").fill("2026-09-10");
    await page.getByRole("button", { name: "Ver historial" }).click();
    await expect(page.getByText("La fecha inicial no puede ser posterior a la final.")).toBeVisible();

    // Sin datos: se informa y se mantienen los filtros (RF05.6).
    await page.getByLabel("Sin comparación").check();
    await page.getByLabel("Desde").fill("2020-01-01");
    await page.getByLabel("Hasta").fill("2020-01-02");
    await page.getByRole("button", { name: "Ver historial" }).click();
    await expect(page.getByText("No hay mediciones en este periodo")).toBeVisible();
    await expect(page.getByLabel("Desde")).toHaveValue("2020-01-01");

    // Un solo día (válido) y descarga del CSV (RF05.7). Incidencia 6 de evidencia/resumen-tesis.md: se usa
    // anteayer, no ayer, porque EST-0003 deja de reportar 3 horas antes del fin de la semilla (situación
    // preparada) y, entre las 00:00 y las 03:00, ese silencio caía en «ayer». Las filas esperadas salen de la
    // duración real del día en Chile (23, 24 o 25 horas con el horario de verano), no de 96 fijas.
    const dia = sumarDias(diaChile(Date.now()), -2);
    const rango = rangoDeDias(dia, dia);
    const lecturasPorEstacion = (rango.hasta.getTime() - rango.desde.getTime()) / (15 * 60_000);
    await page.getByLabel("Desde").fill(dia);
    await page.getByLabel("Hasta").fill(dia);
    await page.getByRole("button", { name: "Ver historial" }).click();
    // El periodo anterior (2020) también era de un día, sin agregar: se espera a que llegue el resultado
    // nuevo antes de descargar, porque el enlace del CSV sale del resultado vigente.
    await expect(page.getByText("No hay mediciones en este periodo")).toHaveCount(0);
    await expect(page.getByText("Mediciones cada 15 minutos, sin agregar.")).toBeVisible();

    const [descarga] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Descargar CSV" }).click()]);
    expect(descarga.suggestedFilename()).toBe(`historial_parcela-los-castanos_humedad-suelo_${dia}_${dia}.csv`);
    const contenido = readFileSync((await descarga.path())!);
    expect([...contenido.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const lineas = contenido.toString("utf8").replace(/^﻿/, "").trimEnd().split("\r\n");
    expect(lineas[0]).toBe("fecha_hora;terreno;estacion;variable;valor;unidad");
    // El primer instante del día: las 00:00, salvo el día en que empieza el horario de verano (01:00).
    expect(lineas[1]).toMatch(new RegExp(`^${fechaHoraChile(rango.desde)};Parcela Los Castaños;EST-000\\d;Humedad del suelo;\\d+(,\\d+)?;%$`));
    expect(lineas.length - 1).toBe(lecturasPorEstacion * 4);
});
