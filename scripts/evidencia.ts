// `npm run evidencia` (diseno.md §11 y §12): ejecuta `npm test`, `npm run test:infra` y `npm run test:e2e`
// con sus reporteros JSON, lee `evidencia/carga.json` (sin volver a ejecutar la carga) y escribe
// `evidencia/informe.md`. El informe se escribe aunque falle una suite; en ese caso el comando termina con error.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { cpus, platform, release, totalmem } from "node:os";
import { join } from "node:path";
import {
    generarInforme,
    hayFallas,
    leerPlaywright,
    leerVitest,
    type Ejecucion,
    type InformeCarga,
    type NombreSuite,
    type ResultadoSuite,
} from "./informe-evidencia";

const CARPETA = "evidencia";
const RESULTADOS = join(CARPETA, "resultados");
const raiz = process.cwd();

interface Suite {
    suite: NombreSuite;
    script: string;
    argumentos: string[];
    json: string;
    env?: Record<string, string>;
}

const suites: Suite[] = [
    {
        suite: "test",
        script: "test",
        json: join(RESULTADOS, "test.json"),
        argumentos: ["--reporter=default", "--reporter=json", `--outputFile.json=${join(RESULTADOS, "test.json")}`],
    },
    {
        suite: "infra",
        script: "test:infra",
        json: join(RESULTADOS, "infra.json"),
        argumentos: ["--reporter=default", "--reporter=json", `--outputFile.json=${join(RESULTADOS, "infra.json")}`],
    },
    {
        suite: "e2e",
        script: "test:e2e",
        json: join(RESULTADOS, "e2e.json"),
        argumentos: ["--reporter=list,json"],
        env: { PLAYWRIGHT_JSON_OUTPUT_FILE: join(RESULTADOS, "e2e.json") },
    },
];

// Los resultados de una ejecución anterior nunca se mezclan con los de esta.
rmSync(RESULTADOS, { recursive: true, force: true });
mkdirSync(RESULTADOS, { recursive: true });

const resultados: ResultadoSuite[] = [];
const ejecuciones: Ejecucion[] = [];

for (const s of suites) {
    const comando = `npm run ${s.script}`;
    console.log(`\n=== ${comando} ===\n`);
    const t0 = performance.now();
    const proceso = spawnSync("npm", ["run", s.script, "--", ...s.argumentos], {
        stdio: "inherit",
        env: { ...process.env, ...s.env },
    });
    const resultado: ResultadoSuite = {
        suite: s.suite,
        comando,
        codigoSalida: proceso.status ?? 1,
        segundos: (performance.now() - t0) / 1000,
        archivosConError: [],
        conResultados: existsSync(s.json),
    };
    if (resultado.conResultados) {
        const json = JSON.parse(readFileSync(s.json, "utf8"));
        if (s.suite === "e2e") ejecuciones.push(...leerPlaywright(json, raiz));
        else {
            const leido = leerVitest(json, s.suite, raiz);
            ejecuciones.push(...leido.ejecuciones);
            resultado.archivosConError = leido.archivosConError;
        }
    }
    resultados.push(resultado);
}

const archivoCarga = join(CARPETA, "carga.json");
const carga: InformeCarga | null = existsSync(archivoCarga) ? JSON.parse(readFileSync(archivoCarga, "utf8")) : null;

function git(...argumentos: string[]): string | null {
    try {
        return execFileSync("git", argumentos, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    } catch {
        return null;
    }
}

const commit = git("rev-parse", "--short", "HEAD");
const informe = generarInforme({
    contexto: {
        fecha: new Date(),
        commit,
        cambiosSinCommit: commit !== null && (git("status", "--porcelain") ?? "") !== "",
        equipo:
            `${cpus()[0]?.model ?? "?"}, ${cpus().length} núcleos, ${Math.round(totalmem() / 1024 ** 3)} GB de memoria; ` +
            `${platform()} ${release()}; Node.js ${process.version}`,
    },
    suites: resultados,
    ejecuciones,
    carga,
});
writeFileSync(join(CARPETA, "informe.md"), informe);

const fallas = hayFallas(resultados, ejecuciones, carga);
console.log(`\nInforme escrito en ${join(CARPETA, "informe.md")}.${fallas ? " Hay pruebas que fallan: revisa el informe." : ""}`);
process.exit(fallas ? 1 : 0);
