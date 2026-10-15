// `npm run capturas` (diseno.md §10, T4.1): capturas de las 6 pantallas para la tesis, en escritorio
// (1280×800) y celular (390×844), en evidencia/capturas/. Usa una base, una bandeja y un servidor propios
// (data/capturas/, puerto 3200): nunca toca data/lorax.db. La base se siembra de nuevo en cada ejecución y
// se pone al día justo antes de capturar.
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Browser, type BrowserContextOptions, type Locator, type Page } from "@playwright/test";
import { crearConexion } from "~/server/db/cliente";
import { aplicarMigraciones } from "~/server/db/migrar";
import { ponerAlDia } from "./al-dia";
import { ADMINISTRADOR, CONTRASENA_DEMO, PRODUCTORES } from "./datos-piloto";
import { sembrar } from "./semilla";

const PUERTO = 3200;
const URL_BASE = `http://localhost:${PUERTO}`;
const CARPETA_DATOS = "./data/capturas";
const ARCHIVO_BD = `${CARPETA_DATOS}/lorax.db`;
const CARPETA_SALIDA = "evidencia/capturas";
const MARIA = PRODUCTORES[0].correo;

const ENTORNO: Record<string, string> = {
    DB_ARCHIVO: ARCHIVO_BD,
    CORREOS_DIR: `${CARPETA_DATOS}/correos`,
    MENSAJES_DIR: `${CARPETA_DATOS}/mensajes`,
    RESPALDOS_DIR: `${CARPETA_DATOS}/respaldos`,
    APP_URL: URL_BASE,
    // Claves de un solo uso, generadas en cada ejecución: no hay secretos en el código.
    JWT_SECRET: randomBytes(32).toString("base64url"),
    INGESTA_API_KEY: randomBytes(32).toString("base64url"),
    NOTIF_SIMULAR_FALLO: "",
};

const DISPOSITIVOS: Record<"escritorio" | "celular", BrowserContextOptions> = {
    escritorio: { viewport: { width: 1280, height: 800 } },
    celular: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
};

// --- Base y servidor ---

async function prepararBase() {
    rmSync(CARPETA_DATOS, { recursive: true, force: true });
    const bd = crearConexion(ARCHIVO_BD);
    try {
        aplicarMigraciones(bd);
        await sembrar(bd);
    } finally {
        bd.$client.close();
    }
}

/** `db:al-dia` sobre la base de las capturas, con el servidor encendido (modo WAL). */
function ponerBaseAlDia() {
    const bd = crearConexion(ARCHIVO_BD);
    try {
        const r = ponerAlDia(bd);
        console.log(`Datos al día hasta ${r.hasta.toISOString()}: ${r.mediciones} mediciones nuevas.`);
    } finally {
        bd.$client.close();
    }
}

async function iniciarServidor(): Promise<ChildProcess> {
    // En su propio grupo de procesos, para detener también los procesos hijos de Vinxi.
    const servidor = spawn(process.execPath, ["node_modules/vinxi/bin/cli.mjs", "dev", "--port", String(PUERTO)], {
        env: { ...process.env, ...ENTORNO },
        stdio: ["ignore", "pipe", "pipe"],
        detached: true,
    });
    let salida = "";
    servidor.stdout!.on("data", (d) => (salida += d));
    servidor.stderr!.on("data", (d) => (salida += d));
    for (let i = 0; i < 240; i++) {
        try {
            if ((await fetch(`${URL_BASE}/api/salud`)).ok) return servidor;
        } catch {
            // Todavía no responde.
        }
        await new Promise((r) => setTimeout(r, 500));
    }
    detenerServidor(servidor);
    throw new Error(`El servidor no respondió en ${URL_BASE}.\n${salida}`);
}

function detenerServidor(servidor: ChildProcess) {
    try {
        process.kill(-servidor.pid!, "SIGTERM");
    } catch {
        // Ya terminó.
    }
}

// --- Capturas ---

/** Espera a que la página hidrate y cargue sus datos: sin «Cargando…», con fuentes y gráficos listos. */
async function esperarPagina(page: Page) {
    await page.waitForLoadState("networkidle");
    await page.waitForFunction(() => !document.body.innerText.includes("Cargando"), undefined, { timeout: 30_000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => [...document.querySelectorAll("canvas")].every((c) => c.width > 0));
}

type Dispositivo = keyof typeof DISPOSITIVOS;

/** Franja vertical de la página que se captura, en píxeles CSS desde el borde superior. */
interface Recorte {
    desde: number;
    hasta: number;
}

interface Pantalla {
    nombre: string;
    correo: string | null;
    ruta: string;
    preparar?: (page: Page, dispositivo: Dispositivo) => Promise<void>;
    /** Sin recorte se captura la página completa (diseno.md §10). */
    recorte?: (page: Page, dispositivo: Dispositivo) => Promise<Recorte>;
}

/** Borde superior e inferior de un elemento en la página (la ventana ya abarca todo el contenido). */
async function limites(page: Page, locator: Locator): Promise<{ arriba: number; abajo: number }> {
    const caja = await locator.boundingBox();
    if (!caja) throw new Error(`No se encontró en la página: ${locator}`);
    return { arriba: caja.y, abajo: caja.y + caja.height };
}

// Aire alrededor de un recorte: deja ver el borde de la sección sin mostrar la anterior ni la siguiente.
const MARGEN = 12;

const PANTALLAS: Pantalla[] = [
    { nombre: "inicio-sesion", correo: null, ruta: "/login" },
    {
        nombre: "panel",
        correo: MARIA,
        ruta: "/",
        // La estación EST-0001 completa, con la tarjeta de humedad del suelo fuera de rango (el estado que
        // describe la tesis). En escritorio, desde arriba (con las alertas recientes) hasta el final de la
        // estación; en celular, desde su encabezado hasta el final de esa tarjeta.
        recorte: async (page, dispositivo) => {
            const estacion = page.getByRole("region", { name: "Estación EST-0001" });
            if (dispositivo === "escritorio") return { desde: 0, hasta: (await limites(page, estacion)).abajo + MARGEN };
            const titulo = await limites(page, estacion.getByRole("heading", { name: "Estación EST-0001" }));
            const humedad = await limites(page, estacion.getByRole("article", { name: "Humedad del suelo" }));
            return { desde: titulo.arriba - MARGEN, hasta: humedad.abajo + MARGEN };
        },
    },
    {
        nombre: "historial",
        correo: MARIA,
        ruta: "/historial",
        // Humedad del suelo de los últimos 7 días: muestra el episodio de sequía de EST-0001.
        preparar: async (page) => {
            await page.getByLabel("Variable").selectOption("humedad_suelo");
            await page.getByRole("img", { name: /Humedad del suelo en Parcela Los Castaños/ }).waitFor();
        },
    },
    {
        nombre: "alertas",
        correo: MARIA,
        ruta: "/alertas?pestana=umbrales",
        // Figura del CU06: pestaña «Umbrales» con terreno y sensor elegidos, para que se vean la unidad, el
        // rango y las últimas lecturas. El umbral queda sin llenar.
        preparar: async (page) => {
            const formulario = page.locator("form", { hasText: "Nuevo umbral" });
            await formulario.getByLabel("Terreno").selectOption({ label: "Parcela Los Castaños" });
            await formulario.getByLabel("Sensor").selectOption({ label: "EST-0001 · Humedad del suelo" });
            await formulario.getByText("Últimas lecturas:").waitFor();
            await formulario.getByText("Humedad del suelo se mide en").waitFor();
        },
    },
    {
        nombre: "ajustes",
        correo: MARIA,
        ruta: "/ajustes?pestana=terrenos",
        preparar: async (page) => {
            await page.getByRole("button", { name: "Registrar terreno" }).first().click();
            await page.getByRole("heading", { name: "Registrar terreno" }).waitFor();
        },
    },
    { nombre: "administracion", correo: ADMINISTRADOR.correo, ruta: "/admin" },
];

async function capturar(navegador: Browser, pantalla: Pantalla, dispositivo: Dispositivo): Promise<string> {
    const contexto = await navegador.newContext({
        ...DISPOSITIVOS[dispositivo],
        baseURL: URL_BASE,
        locale: "es-CL",
        timezoneId: "America/Santiago",
        deviceScaleFactor: 2,
        // Sin animaciones: los gráficos y las transiciones no quedan a medio camino.
        reducedMotion: "reduce",
    });
    try {
        if (pantalla.correo) {
            const respuesta = await contexto.request.post("/api/v1/auth/login", {
                data: { correo: pantalla.correo, contrasena: CONTRASENA_DEMO, recordar: false },
            });
            if (!respuesta.ok()) throw new Error(`No se pudo iniciar sesión como ${pantalla.correo}: ${respuesta.status()}`);
        }
        const page = await contexto.newPage();
        await page.goto(pantalla.ruta);
        await esperarPagina(page);
        await pantalla.preparar?.(page, dispositivo);
        await esperarPagina(page);

        // La ventana se agranda hasta el alto del contenido, sin cambiar el ancho, y se recorta la franja
        // pedida. Con `fullPage`, la barra lateral (alta como la ventana) quedaría cortada bajo los 800 px.
        const { width } = page.viewportSize()!;
        const alto = Math.max(await page.evaluate(() => document.documentElement.scrollHeight), DISPOSITIVOS[dispositivo].viewport!.height);
        await page.setViewportSize({ width, height: alto });
        await page.evaluate(() => window.scrollTo(0, 0));
        await esperarPagina(page);
        const { desde, hasta } = (await pantalla.recorte?.(page, dispositivo)) ?? { desde: 0, hasta: alto };
        const y = Math.max(0, Math.floor(desde));
        const fin = Math.min(alto, Math.ceil(hasta));
        // Un recorte desde arriba incluye la barra lateral: la ventana se ajusta a su alto para que la barra
        // (alta como la ventana) termine con la imagen y se vean «Ajustes» y «Cerrar sesión».
        if (y === 0 && fin < alto) {
            await page.setViewportSize({ width, height: fin });
            await esperarPagina(page);
        }
        const clip = { x: 0, y, width, height: fin - y };

        const archivo = join(CARPETA_SALIDA, `${pantalla.nombre}-${dispositivo}.png`);
        await page.screenshot({ path: archivo, clip });
        return archivo;
    } finally {
        await contexto.close();
    }
}

await prepararBase();
console.log(`Base recién sembrada en ${ARCHIVO_BD}. Iniciando el servidor en ${URL_BASE}…`);
const servidor = await iniciarServidor();
let navegador: Browser | undefined;
try {
    ponerBaseAlDia();
    rmSync(CARPETA_SALIDA, { recursive: true, force: true });
    mkdirSync(CARPETA_SALIDA, { recursive: true });
    // El locale del contexto no alcanza a los campos de fecha: Chromium los formatea con el idioma del
    // sistema (en Linux, LANG). Con es_CL, «Desde» y «Hasta» muestran 06-10-2026 y no 10/06/2026.
    navegador = await chromium.launch({ env: { ...process.env, LANG: "es_CL.UTF-8", LANGUAGE: "es_CL:es", LC_ALL: "es_CL.UTF-8" } });
    for (const pantalla of PANTALLAS) {
        for (const dispositivo of Object.keys(DISPOSITIVOS) as Dispositivo[]) {
            console.log(`  ${await capturar(navegador, pantalla, dispositivo)}`);
        }
    }
    const total = readdirSync(CARPETA_SALIDA).filter((a) => a.endsWith(".png")).length;
    const esperado = PANTALLAS.length * Object.keys(DISPOSITIVOS).length;
    if (total !== esperado) throw new Error(`Se esperaban ${esperado} capturas y hay ${total}.`);
    console.log(`${total} capturas en ${CARPETA_SALIDA}/.`);
} catch (error) {
    console.error((error as Error).message);
    process.exitCode = 1;
} finally {
    await navegador?.close();
    detenerServidor(servidor);
}
