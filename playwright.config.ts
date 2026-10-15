import { defineConfig, devices } from "@playwright/test";
import { CARPETA, ENTORNO, PUERTO, URL_BASE } from "./tests/e2e/entorno";

// Las pruebas e2e modifican datos: usan una base, una bandeja de correos y un servidor propios, en
// data/e2e/ y el puerto 3100 (tests/e2e/entorno.ts). Nunca tocan data/lorax.db ni reutilizan un
// `npm run dev` abierto.

/** Pruebas que modifican datos de la semilla. Corren al final, solo en escritorio y de a una. */
const MODIFICAN_DATOS = ["**/admin.spec.ts", "**/ajustes.spec.ts", "**/flujos.spec.ts", "**/recuperacion.spec.ts", "**/terrenos.spec.ts"];

const escritorio = { ...devices["Desktop Chrome"] };
const celular = { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
// RNF05: la aplicación funciona también en WebKit (el motor de Safari), en escritorio y en celular.
const webkitEscritorio = { ...devices["Desktop Safari"] };
const webkitCelular = { ...devices["iPhone 13"] };
const LECTURA = ["chromium", "celular", "webkit", "webkit-celular"];

export default defineConfig({
    testDir: "./tests/e2e",
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    // WebKit en modo desarrollo es lento en la primera carga: con más procesos en paralelo, las páginas no
    // alcanzan a cargar dentro de los tiempos de espera (la falla es de la máquina, no de la aplicación).
    workers: process.env.CI ? 2 : 6,
    reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
    // El inicio de sesión usa scrypt, lento a propósito (§8.4): con muchas pruebas en paralelo, 5 s no alcanzan.
    expect: { timeout: 10_000 },
    use: {
        baseURL: URL_BASE,
        trace: "on-first-retry",
    },
    projects: [
        // Solo lectura: en Chromium y WebKit, en escritorio y celular, en paralelo. Es la evidencia de RNF05.
        { name: "chromium", testIgnore: MODIFICAN_DATOS, use: escritorio },
        { name: "celular", testIgnore: MODIFICAN_DATOS, use: celular },
        { name: "webkit", testIgnore: MODIFICAN_DATOS, use: webkitEscritorio },
        { name: "webkit-celular", testIgnore: MODIFICAN_DATOS, use: webkitCelular },
        // Modifican datos: después de las de lectura y en dos tandas, para que ninguna prueba cambie
        // lo que otra necesita. En «datos-1», José y Ana entran con la contraseña de demostración y los
        // flujos usan el umbral de humedad del suelo de María; en «datos-2», la administración deshabilita
        // a José y elimina un umbral de María, y la recuperación cambia la clave de Ana.
        {
            name: "datos-1",
            testMatch: ["**/ajustes.spec.ts", "**/flujos.spec.ts", "**/terrenos.spec.ts"],
            dependencies: LECTURA,
            fullyParallel: false,
            workers: 1,
            use: escritorio,
        },
        {
            name: "datos-2",
            testMatch: ["**/admin.spec.ts", "**/recuperacion.spec.ts"],
            dependencies: ["datos-1"],
            fullyParallel: false,
            workers: 1,
            use: escritorio,
        },
    ],
    webServer: {
        // Base recién sembrada en cada ejecución; se borran también los correos de la anterior.
        command: `node -e "fs.rmSync('${CARPETA}', { recursive: true, force: true })" && npm run db:reiniciar && npx vinxi dev --port ${PUERTO}`,
        url: `${URL_BASE}/login`,
        reuseExistingServer: false,
        timeout: 180_000,
        // Valores solo para las pruebas e2e; no dependen de .env.
        env: ENTORNO,
    },
});
