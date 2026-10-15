import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Pruebas de infraestructura lentas (`npm run test:infra`): compilan e inician la versión de producción.
// Van aparte de `npm test` para que las pruebas de cada día sigan siendo rápidas (diseno.md §10).
export default defineConfig({
    resolve: {
        alias: { "~": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    test: {
        environment: "node",
        include: ["tests/infra/**/*.test.ts"],
        testTimeout: 600_000,
        hookTimeout: 600_000,
    },
});
