import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./base";
import { CORREO_ADMINISTRADOR, CORREO_PRODUCTORA, iniciarSesion } from "./sesion";
import { PRODUCTORES } from "../../scripts/datos-piloto";

// Revisión de accesibilidad y responsive (T6.5; RNF03, RNF05 y diseno.md §9) de todas las pantallas, con
// los datos de la semilla, en cada proyecto de lectura (Chromium y WebKit, escritorio y celular).
// - axe-core con las reglas WCAG 2.1 A y AA: el resultado es «sin infracciones detectadas por axe-core»,
//   no una certificación de cumplimiento de WCAG.
// - Comprobaciones propias de lo que axe no cubre: áreas táctiles de 44 px, texto base de 18 px (ningún
//   texto bajo 16 px), estados con ícono y texto además del color, foco visible, sin scroll horizontal
//   desde 360 px y sin movimiento con `prefers-reduced-motion`.

const ANA = PRODUCTORES[2].correo;

// axe-core y el recorrido con Tab toman su tiempo, más aún en la primera carga del modo desarrollo.
test.describe.configure({ timeout: 90_000 });

interface Pantalla {
    nombre: string;
    correo: string | null;
    ruta: string;
    /** Pasos después de cargar la ruta (abrir una pestaña o un detalle). */
    preparar?: (page: Page) => Promise<void>;
    /** Texto que confirma que la pantalla terminó de cargar sus datos. */
    lista: string | RegExp;
}

const PANTALLAS: Pantalla[] = [
    { nombre: "Inicio de sesión", correo: null, ruta: "/login", lista: "Iniciar sesión" },
    { nombre: "Restablecer contraseña", correo: null, ruta: "/restablecer?token=enlace-de-prueba", lista: "Guardar contraseña" },
    { nombre: "Panel de estado", correo: CORREO_PRODUCTORA, ruta: "/", lista: "Estación EST-0001" },
    { nombre: "Panel sin terrenos", correo: ANA, ruta: "/", lista: /terreno/ },
    { nombre: "Historial", correo: CORREO_PRODUCTORA, ruta: "/historial", lista: /Promedios cada|Mediciones cada/ },
    { nombre: "Alertas: lista", correo: CORREO_PRODUCTORA, ruta: "/alertas", lista: /Humedad del suelo bajo el umbral/ },
    { nombre: "Alertas: umbrales", correo: CORREO_PRODUCTORA, ruta: "/alertas?pestana=umbrales", lista: "Guardar umbral" },
    { nombre: "Ajustes: Perfil", correo: CORREO_PRODUCTORA, ruta: "/ajustes?pestana=perfil", lista: "Guardar cambios" },
    { nombre: "Ajustes: Seguridad", correo: CORREO_PRODUCTORA, ruta: "/ajustes?pestana=seguridad", lista: "Cambiar contraseña" },
    { nombre: "Ajustes: Terrenos y estaciones", correo: CORREO_PRODUCTORA, ruta: "/ajustes?pestana=terrenos", lista: "Parcela Los Castaños" },
    { nombre: "Administración: Cuentas", correo: CORREO_ADMINISTRADOR, ruta: "/admin", lista: /Ver detalle de María/ },
    {
        nombre: "Administración: Detalle de cuenta",
        correo: CORREO_ADMINISTRADOR,
        ruta: "/admin",
        preparar: async (page) => {
            await page.getByRole("button", { name: /Ver detalle de María/ }).click();
            await page.getByRole("tab", { name: "Terrenos y estaciones" }).click();
        },
        lista: "EST-0004",
    },
    {
        nombre: "Administración: Eventos",
        correo: CORREO_ADMINISTRADOR,
        ruta: "/admin",
        preparar: async (page) => {
            await page.getByRole("tab", { name: "Eventos" }).click();
        },
        lista: "Registro de eventos",
    },
    { nombre: "Bandeja de correos (desarrollo)", correo: null, ruta: "/dev/correos", lista: "Correos enviados" },
    { nombre: "Página no encontrada", correo: CORREO_PRODUCTORA, ruta: "/no-existe", lista: "No encontramos esta página" },
];

/** Un problema por línea, para que el reporte de la prueba diga exactamente qué corregir. */
type Hallazgos = string[];

/** Elementos interactivos visibles menores de 44 × 44 px. Casillas y opciones cuentan con su etiqueta. */
function areasTactiles(page: Page): Promise<Hallazgos> {
    return page.evaluate(() => {
        const MINIMO = 44 - 0.5; // tolerancia de redondeo de subpíxeles
        const hallazgos: string[] = [];
        const describir = (e: Element) => `${e.tagName.toLowerCase()} «${(e.textContent || e.getAttribute("aria-label") || e.getAttribute("name") || "").trim().slice(0, 40)}»`;
        const selector = 'a[href], button, input:not([type="hidden"]), select, textarea, [role="tab"], summary';
        for (const e of document.querySelectorAll<HTMLElement>(selector)) {
            const estilo = getComputedStyle(e);
            if (estilo.visibility === "hidden" || estilo.display === "none" || e.closest("[hidden], [inert]")) continue;
            let caja = e.getBoundingClientRect();
            if (caja.width === 0 && caja.height === 0) continue;
            // WCAG 2.5.5: los enlaces dentro de un párrafo de texto quedan exentos.
            if (e.tagName === "A" && e.parentElement?.closest("p, li") && !e.closest("nav")) {
                const texto = e.parentElement.textContent?.trim() ?? "";
                if (texto.length > (e.textContent?.trim().length ?? 0) + 3) continue;
            }
            const input = e as HTMLInputElement;
            if (e.tagName === "INPUT" && (input.type === "checkbox" || input.type === "radio")) {
                const etiqueta = input.closest("label") ?? (input.id ? document.querySelector(`label[for="${input.id}"]`) : null);
                if (etiqueta) caja = etiqueta.getBoundingClientRect();
            }
            if (caja.width < MINIMO || caja.height < MINIMO) {
                hallazgos.push(`${describir(e)}: ${Math.round(caja.width)} × ${Math.round(caja.height)} px`);
            }
        }
        return hallazgos;
    });
}

/** Texto base de 18 px y ningún texto visible bajo 16 px (el texto solo para lectores de pantalla no cuenta). */
function tamanosDeTexto(page: Page): Promise<{ base: number; pequenos: Hallazgos }> {
    return page.evaluate(() => {
        const base = parseFloat(getComputedStyle(document.body).fontSize);
        const pequenos = new Set<string>();
        const recorrido = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let nodo = recorrido.nextNode(); nodo; nodo = recorrido.nextNode()) {
            const texto = nodo.textContent?.trim();
            const padre = nodo.parentElement;
            if (!texto || !padre || padre.closest("script, style, svg, canvas")) continue;
            const caja = padre.getBoundingClientRect();
            const estilo = getComputedStyle(padre);
            if (caja.width <= 1 || caja.height <= 1 || estilo.visibility === "hidden" || estilo.display === "none") continue;
            const tamano = parseFloat(estilo.fontSize);
            if (tamano < 16) pequenos.add(`«${texto.slice(0, 40)}» (${tamano} px, ${padre.tagName.toLowerCase()}.${[...padre.classList].join(".")})`);
        }
        return { base, pequenos: [...pequenos] };
    });
}

/** Cada insignia de estado lleva ícono y texto, además del color. */
function insigniasSinIconoOTexto(page: Page): Promise<Hallazgos> {
    return page.evaluate(() =>
        [...document.querySelectorAll(".insignia-estado, .insignia")]
            .filter((e) => !e.querySelector("svg") || !e.textContent?.trim())
            .map((e) => `«${e.textContent?.trim() || "(sin texto)"}»: ${e.querySelector("svg") ? "" : "sin ícono"}`),
    );
}

/** Recorre la página con Tab y devuelve los elementos enfocados sin contorno ni sombra visibles. */
async function focoInvisible(page: Page, pasos = 12): Promise<Hallazgos> {
    const hallazgos: Hallazgos = [];
    await page.locator("body").click({ position: { x: 1, y: 1 } });
    for (let i = 0; i < pasos; i++) {
        await page.keyboard.press("Tab");
        const problema = await page.evaluate(() => {
            const e = document.activeElement as HTMLElement | null;
            if (!e || e === document.body) return null;
            const estilo = getComputedStyle(e);
            const contorno = estilo.outlineStyle !== "none" && parseFloat(estilo.outlineWidth) > 0;
            const sombra = estilo.boxShadow !== "none";
            const nombre = (e.textContent || e.getAttribute("aria-label") || e.getAttribute("name") || "").trim().slice(0, 40);
            return contorno || sombra ? null : `${e.tagName.toLowerCase()}${e.getAttribute("type") ? `[type=${e.getAttribute("type")}]` : ""} «${nombre}» (outline: ${estilo.outlineStyle} ${estilo.outlineWidth})`;
        });
        if (problema) hallazgos.push(problema);
    }
    return [...new Set(hallazgos)];
}

/** Con movimiento reducido no quedan transiciones ni animaciones de más de 0,01 s. */
function conMovimiento(page: Page): Promise<Hallazgos> {
    return page.evaluate(() => {
        const segundos = (valor: string) => Math.max(...valor.split(",").map((v) => (v.trim().endsWith("ms") ? parseFloat(v) / 1000 : parseFloat(v))));
        return [...document.querySelectorAll("body *")]
            .filter((e) => {
                const estilo = getComputedStyle(e);
                return segundos(estilo.transitionDuration) > 0.01 || (estilo.animationName !== "none" && segundos(estilo.animationDuration) > 0.01);
            })
            .map((e) => `${e.tagName.toLowerCase()}.${[...e.classList].join(".")}`)
            .slice(0, 10);
    });
}

for (const pantalla of PANTALLAS) {
    test(`[T6.5] ${pantalla.nombre}: sin infracciones detectadas por axe-core y con las comprobaciones propias`, async ({ page }, info) => {
        const celular = (info.project.use.viewport?.width ?? 1280) < 768;
        await page.emulateMedia({ reducedMotion: "reduce" });
        if (pantalla.correo) await iniciarSesion(page, pantalla.correo);
        await page.goto(pantalla.ruta);
        await pantalla.preparar?.(page);
        // Hasta 30 s para cargar los datos: WebKit en modo desarrollo, con la suite en paralelo, puede tardar
        // más de 10 s en la primera carga. Esta suite revisa accesibilidad, no velocidad (eso es T6.4).
        await expect(page.getByText(pantalla.lista).first()).toBeVisible({ timeout: 30_000 });
        await page.waitForLoadState("networkidle");

        // axe-core, reglas WCAG 2.1 A y AA. Ninguna regla desactivada.
        const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
        const infracciones = axe.violations.map(
            (v) => `${v.id} (${v.impact}): ${v.help} → ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`,
        );
        expect.soft(infracciones, "infracciones de axe-core").toEqual([]);

        expect.soft(await areasTactiles(page), "áreas táctiles menores de 44 px").toEqual([]);
        const texto = await tamanosDeTexto(page);
        expect.soft(texto.base, "texto base (px)").toBeGreaterThanOrEqual(18);
        expect.soft(texto.pequenos, "texto visible bajo 16 px").toEqual([]);
        expect.soft(await insigniasSinIconoOTexto(page), "insignias de estado sin ícono o sin texto").toEqual([]);
        expect.soft(await conMovimiento(page), "movimiento con prefers-reduced-motion").toEqual([]);
        // En el celular se navega con el dedo, no con Tab.
        if (!celular) expect.soft(await focoInvisible(page), "elementos enfocados sin foco visible").toEqual([]);

        // RNF05: sin scroll horizontal desde 360 px de ancho.
        if (celular) {
            await page.setViewportSize({ width: 360, height: 740 });
            const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
            expect.soft(desborde, "scroll horizontal a 360 px").toBeLessThanOrEqual(0);
        }
    });
}
