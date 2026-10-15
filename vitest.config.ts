import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        alias: { "~": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    test: {
        environment: "node",
        include: ["tests/**/*.test.ts"],
        // tests/infra y tests/carga: `npm run test:infra` y `npm run test:carga` (lentas, compilan la aplicación).
        exclude: ["tests/e2e/**", "tests/infra/**", "tests/carga/**", "node_modules/**"],
        // scrypt (N = 2^17) es lento a propósito; con varios archivos en paralelo, 5 s no alcanzan.
        testTimeout: 20_000,
        // Valores solo para pruebas; nunca se usan fuera de Vitest.
        env: {
            JWT_SECRET: "secreto-solo-para-pruebas-automatizadas-0123456789",
            APP_URL: "http://localhost:3000",
            SESION_HORAS: "8",
            SESION_RECORDAR_DIAS: "30",
            INGESTA_API_KEY: "clave-de-ingesta-solo-para-pruebas-0123456789",
            // Los correos de las pruebas no se mezclan con los de data/correos.
            CORREOS_DIR: join(tmpdir(), `lorax-correos-pruebas-${process.pid}`),
            MENSAJES_DIR: join(tmpdir(), `lorax-mensajes-pruebas-${process.pid}`),
        },
    },
});
