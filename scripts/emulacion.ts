// Emulador de estaciones (diseno.md §10): hace el papel del servidor de red LoRaWAN y envía tramas al
// endpoint de ingesta (§6) por HTTP, sin tocar la base. `scripts/emulador.ts` es la línea de comandos.
import { CRITERIOS_PILOTO, DIAS_DE_HISTORIA, estacionesPiloto, PRODUCTORES } from "./datos-piloto";
import { INTERVALO_MS, MS_DIA } from "./generacion";
import { ModeloEstacion, type Lecturas } from "./modelo-valores";

export type Escenario =
    | { tipo: "normal" }
    | { tipo: "sequia" }
    | { tipo: "helada" }
    | { tipo: "silencio"; numeroSerie: string }
    | { tipo: "malformada" }
    | { tipo: "desconocida" }
    | { tipo: "credencial-invalida" };

export const NOMBRES_ESCENARIOS = ["normal", "sequia", "helada", "silencio:EST-0003", "malformada", "desconocida", "credencial-invalida"];

/** Estaciones de los escenarios: las del criterio de humedad del suelo y el de temperatura del piloto. */
export const ESTACION_SEQUIA = "EST-0001";
export const ESTACION_HELADA = "EST-0005";
export const ESTACION_DESCONOCIDA = "EST-9999";
export const CLAVE_INVALIDA = "clave-incorrecta-del-emulador";

export function leerEscenario(texto: string): Escenario {
    const [nombre, serie] = texto.split(":");
    switch (nombre) {
        case "normal":
        case "sequia":
        case "helada":
        case "malformada":
        case "desconocida":
        case "credencial-invalida":
            if (serie === undefined) return { tipo: nombre };
            break;
        case "silencio":
            if (serie && estacionesPiloto().some((e) => e.numeroSerie === serie)) return { tipo: "silencio", numeroSerie: serie };
            throw new Error(`«${texto}»: indica una estación de los datos piloto, por ejemplo silencio:EST-0003.`);
    }
    throw new Error(`No conozco el escenario «${texto}». Escenarios: ${NOMBRES_ESCENARIOS.join(", ")}.`);
}

/** Una trama lista para enviar, con la API key que usará. */
export interface Envio {
    numeroSerie: string;
    clave: string;
    trama: unknown;
}

const redondear = (valor: number) => Number(valor.toFixed(1));

/**
 * Genera las lecturas de las 8 estaciones piloto con el mismo modelo de la semilla. Tiene estado: cada
 * ronda debe tener una fecha posterior a la anterior.
 */
export class Emulador {
    private readonly modelos = new Map<string, ModeloEstacion>();

    /** Recorre 30 días simulados hasta `inicio` para que los valores partan de un estado realista. */
    constructor(inicio: Date) {
        for (const estacion of estacionesPiloto()) {
            const modelo = new ModeloEstacion(estacion, estacion.terreno.clima);
            for (let ms = inicio.getTime() - DIAS_DE_HISTORIA * MS_DIA; ms < inicio.getTime(); ms += INTERVALO_MS) {
                modelo.lecturas(new Date(ms));
                modelo.meta();
            }
            this.modelos.set(estacion.numeroSerie, modelo);
        }
    }

    /** Las tramas de una ronda del escenario, con la fecha del envío. */
    ronda(escenario: Escenario, fecha: Date, clave: string): Envio[] {
        // Todas las estaciones avanzan, aunque alguna no envíe, para conservar el orden del modelo.
        const tramas = [...this.modelos].map(([numeroSerie, modelo]) => {
            const valores = ajustar(escenario, numeroSerie, modelo.lecturas(fecha));
            const lecturas = Object.entries(valores).map(([codigo, valor]) => ({ codigo, valor }));
            return { numeroSerie, trama: { numero_serie: numeroSerie, fecha: fecha.toISOString(), lecturas, meta: modelo.meta() } };
        });
        const valida = (serie: string) => tramas.find((t) => t.numeroSerie === serie)!.trama;

        switch (escenario.tipo) {
            case "silencio":
                return tramas.filter((t) => t.numeroSerie !== escenario.numeroSerie).map((t) => ({ ...t, clave }));
            case "malformada":
                // Sin fecha y con un valor escrito como texto: el servidor responde 400.
                return [
                    {
                        numeroSerie: "EST-0002",
                        clave,
                        trama: { numero_serie: "EST-0002", lecturas: [{ codigo: "temp_aire", valor: "14,2" }] },
                    },
                ];
            case "desconocida":
                return [{ numeroSerie: ESTACION_DESCONOCIDA, clave, trama: { ...valida("EST-0002"), numero_serie: ESTACION_DESCONOCIDA } }];
            case "credencial-invalida":
                return [{ numeroSerie: "EST-0002", clave: CLAVE_INVALIDA, trama: valida("EST-0002") }];
            default:
                return tramas.map((t) => ({ ...t, clave }));
        }
    }
}

/** Valores del escenario: dentro de los umbrales del piloto, salvo la sequía o la helada provocadas. */
function ajustar(escenario: Escenario, numeroSerie: string, valores: Lecturas): Lecturas {
    const ajustados = { ...valores };
    // Lejos de cada umbral del piloto, para que «normal» no genere alertas por azar.
    for (const c of CRITERIOS_PILOTO.filter((c) => c.numeroSerie === numeroSerie)) {
        const codigo = c.codigo as keyof Lecturas;
        ajustados[codigo] =
            c.condicion === "DESCIENDE" ? Math.max(ajustados[codigo], c.umbral + 5) : Math.min(ajustados[codigo], c.umbral - 5);
    }
    if (escenario.tipo === "sequia" && numeroSerie === ESTACION_SEQUIA) {
        ajustados.hum_suelo = redondear(Math.min(Math.max(valores.hum_suelo - 15, 15), 22));
    }
    if (escenario.tipo === "helada" && numeroSerie === ESTACION_HELADA) {
        ajustados.temp_aire = redondear(Math.min(Math.max(valores.temp_aire - 12, -8), -1.5));
    }
    return ajustados;
}

export interface Resultado {
    numeroSerie: string;
    /** Código HTTP, o `null` si no se pudo conectar. */
    estado: number | null;
    cuerpo: unknown;
}

/** Envía una trama a `<url>/api/v1/ingesta`. `fetch` se puede reemplazar en las pruebas. */
export async function enviar(envio: Envio, url: string, fetchFn: typeof fetch = fetch): Promise<Resultado> {
    try {
        const respuesta = await fetchFn(`${url.replace(/\/$/, "")}/api/v1/ingesta`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Api-Key": envio.clave },
            body: JSON.stringify(envio.trama),
        });
        let cuerpo: unknown = null;
        try {
            cuerpo = await respuesta.json();
        } catch {
            // Sin cuerpo JSON: basta el código.
        }
        return { numeroSerie: envio.numeroSerie, estado: respuesta.status, cuerpo };
    } catch (error) {
        return { numeroSerie: envio.numeroSerie, estado: null, cuerpo: error instanceof Error ? error.message : String(error) };
    }
}

/** Una línea por trama: «EST-0001 → 200 · 6 aceptadas, 0 duplicadas». */
export function describirResultado(r: Resultado): string {
    if (r.estado === null) return `${r.numeroSerie} → sin conexión (${String(r.cuerpo)})`;
    const cuerpo = r.cuerpo as { aceptadas?: number; duplicadas?: number; error?: { mensaje: string } } | null;
    if (cuerpo?.error) return `${r.numeroSerie} → ${r.estado} · ${cuerpo.error.mensaje}`;
    if (cuerpo && cuerpo.aceptadas !== undefined) return `${r.numeroSerie} → ${r.estado} · ${cuerpo.aceptadas} aceptadas, ${cuerpo.duplicadas} duplicadas`;
    return `${r.numeroSerie} → ${r.estado}`;
}

const MARIA = PRODUCTORES[0];
const JOSE = PRODUCTORES[1];

/** Qué debería verse en la interfaz después del escenario (diseno.md §10). */
export function queDeberiaVerse(escenario: Escenario): string[] {
    const entrar = (p: (typeof PRODUCTORES)[number]) => `Entra como ${p.correo} (contraseña de demostración).`;
    switch (escenario.tipo) {
        case "normal":
            return [
                "Respuesta 200 en cada estación.",
                `${entrar(MARIA)} En el panel, las 4 estaciones de Parcela Los Castaños aparecen activas (también EST-0003).`,
                `La alerta vigente de humedad del suelo de ${ESTACION_SEQUIA} pasa a «Resuelta» en Alertas.`,
            ];
        case "sequia":
            return [
                "Respuesta 200 en cada estación.",
                `${entrar(MARIA)} La humedad del suelo de ${ESTACION_SEQUIA} aparece «Fuera de rango» (bajo 25 %).`,
                "Si no había una alerta vigente, se crea una nueva (panel y Alertas) y llega un correo a /dev/correos.",
                "Si ya había una vigente, no se duplica ni se vuelve a avisar. Para ver una alerta nueva, corre antes el escenario «normal».",
            ];
        case "helada":
            return [
                "Respuesta 200 en cada estación.",
                `${entrar(JOSE)} En Huerto San Nicolás, la temperatura del aire de ${ESTACION_HELADA} aparece «Fuera de rango» (bajo 0 °C).`,
                "Se crea una alerta crítica (si no había una vigente): correo en /dev/correos y SMS simulado en data/mensajes/.",
            ];
        case "silencio":
            return [
                `Respuesta 200 en cada estación, salvo ${escenario.numeroSerie}, que no envía.`,
                `${escenario.numeroSerie} pasa a «Sin datos recientes» cuando su última lectura cumple 30 minutos (2 intervalos).`,
                "Con --una-vez el efecto no es inmediato: deja el emulador corriendo o vuelve a mirar el panel más tarde.",
            ];
        case "malformada":
            return [
                "Respuesta 400: la trama no tiene fecha y trae un valor escrito como texto. No se guarda nada.",
                "Como administrador (admin@lorax.local), en Administración → Eventos aparece «Trama con formato incorrecto».",
            ];
        case "desconocida":
            return [
                `Respuesta 422: ${ESTACION_DESCONOCIDA} no está registrada. No se guarda nada.`,
                "Como administrador, en Administración → Eventos aparece «Estación no registrada».",
            ];
        case "credencial-invalida":
            return [
                "Respuesta 401: la API key no es válida. No se procesa la trama.",
                "Como administrador, en Administración → Eventos aparece «Llave de acceso de la ingesta inválida».",
            ];
    }
}
