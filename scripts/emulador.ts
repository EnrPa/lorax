// `npm run emulador -- [escenario] [--una-vez]` (diseno.md §10): envía tramas simuladas a la aplicación
// en ejecución (APP_URL), cada 15 minutos o una sola vez. Escenarios en scripts/emulacion.ts.
import { INTERVALO_MS } from "./generacion";
import { describirResultado, Emulador, enviar, leerEscenario, NOMBRES_ESCENARIOS, queDeberiaVerse, type Escenario } from "./emulacion";

const argumentos = process.argv.slice(2);
const unaVez = argumentos.includes("--una-vez");
const nombre = argumentos.find((a) => !a.startsWith("--")) ?? "normal";

let escenario: Escenario;
try {
    escenario = leerEscenario(nombre);
} catch (error) {
    console.error((error as Error).message);
    console.error(`Uso: npm run emulador -- [${NOMBRES_ESCENARIOS.join(" | ")}] [--una-vez]`);
    process.exit(1);
}

const url = process.env.APP_URL || "http://localhost:3000";
const clave = process.env.INGESTA_API_KEY;
if (!clave) {
    console.error("Falta INGESTA_API_KEY en .env (ver .env.example). Debe ser la misma que usa la aplicación.");
    process.exit(1);
}

const emulador = new Emulador(new Date());

async function ronda() {
    // La fecha es el instante del envío, como la informaría el servidor de red.
    const fecha = new Date(Math.floor(Date.now() / 1000) * 1000);
    console.log(`\n[${fecha.toLocaleString("es-CL", { timeZone: "America/Santiago" })}] Escenario «${nombre}» → ${url}`);
    const resultados = [];
    for (const envio of emulador.ronda(escenario, fecha, clave!)) {
        const resultado = await enviar(envio, url);
        console.log(`  ${describirResultado(resultado)}`);
        resultados.push(resultado);
    }
    if (resultados.every((r) => r.estado === null)) {
        console.log(`  No se pudo conectar con ${url}. ¿Está corriendo la aplicación (npm run dev)?`);
    }
}

console.log("Qué debería verse en la interfaz:");
for (const linea of queDeberiaVerse(escenario)) console.log(`  · ${linea}`);

await ronda();
if (!unaVez) {
    console.log(`\nPróximo envío en ${INTERVALO_MS / 60_000} minutos. Ctrl+C para detener.`);
    setInterval(() => void ronda(), INTERVALO_MS);
}
