// Compila e inicia la versión de producción (`.output/server/index.mjs`) para las pruebas de
// infraestructura y de carga. Nunca usa data/lorax.db: cada prueba indica su propia base.
import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";

export function compilar() {
    execFileSync("npm", ["run", "build"], { stdio: "pipe", timeout: 540_000 });
    if (!existsSync(".output/server/index.mjs")) throw new Error("npm run build no generó .output/server/index.mjs");
}

export interface ServidorProduccion {
    url: string;
    /** Lo que el servidor escribió en la consola (para diagnosticar fallas). */
    salida: () => string;
    detener: () => void;
}

/** Inicia el servidor y espera a que responda `/api/salud`. */
export async function iniciarProduccion(puerto: number, entorno: Record<string, string>): Promise<ServidorProduccion> {
    const url = `http://localhost:${puerto}`;
    const servidor = spawn(process.execPath, [".output/server/index.mjs"], {
        env: { ...process.env, NODE_ENV: "production", PORT: String(puerto), APP_URL: url, ...entorno },
        stdio: "pipe",
    });
    let salida = "";
    servidor.stdout.on("data", (d) => (salida += d));
    servidor.stderr.on("data", (d) => (salida += d));
    const resultado = { url, salida: () => salida, detener: () => servidor.kill() };

    for (let i = 0; i < 120; i++) {
        try {
            await fetch(`${url}/api/salud`);
            return resultado;
        } catch {
            await new Promise((r) => setTimeout(r, 500));
        }
    }
    resultado.detener();
    throw new Error(`El servidor de producción no respondió en ${url}.\n${salida}`);
}
