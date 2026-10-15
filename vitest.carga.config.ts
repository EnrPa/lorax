import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Pruebas de carga (`npm run test:carga`, diseno.md §11): requieren la base de `npm run historico` y
// compilan la versión de producción. Van aparte de `npm test` y fuera del CI, por lo pesadas.
export default defineConfig({
    resolve: {
        alias: { "~": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    test: {
        environment: "node",
        include: ["tests/carga/**/*.test.ts"],
        testTimeout: 900_000,
        hookTimeout: 900_000,
    },
});
