// Ejecuta el emulador real (`scripts/emulador.ts`, diseno.md §10) contra el servidor de las pruebas e2e.
import { execFileSync } from "node:child_process";
import { ENTORNO } from "./entorno";

/** Envía una ronda del escenario y devuelve lo que imprimió el emulador. Falla si el emulador falla. */
export function ejecutarEmulador(escenario: string): string {
    return execFileSync(process.execPath, ["--import", "tsx", "scripts/emulador.ts", escenario, "--una-vez"], {
        env: { ...process.env, APP_URL: ENTORNO.APP_URL, INGESTA_API_KEY: ENTORNO.INGESTA_API_KEY },
        encoding: "utf8",
        timeout: 60_000,
    });
}
