// Ingesta de tramas del servidor de red LoRaWAN (RF03, diseno.md §6). Solo servidor.
// La trama se procesa en una sola transacción: todo o nada.
import { eq } from "drizzle-orm";
import { esquemaTrama, type RespuestaIngesta, type Trama } from "~/lib/esquemas/ingesta";
import { formatearValor } from "~/lib/formato";
import { camposDeZod } from "~/lib/validacion";
import { noAutenticado, noProcesable, validacion, type CamposError, type ErrorApi } from "~/server/api/errores";
import type { BaseDatos } from "~/server/db/cliente";
import { estaciones, eventos, mediciones, sensores } from "~/server/db/esquema";
import { apiKeyIngesta } from "~/server/config";
import { despacharNotificaciones } from "~/server/notificaciones/despacho";
import { evaluarLecturasIngesta } from "~/server/servicios/evaluacion";
import { apiKeyValida } from "./credencial";

type Transaccion = Parameters<Parameters<BaseDatos["transaction"]>[0]>[0];

/** Causas de rechazo; la vista de eventos las traduce (ETIQUETA_CAUSA en src/lib/esquemas/admin.ts). */
export type CausaRechazo =
    | "CREDENCIAL_INVALIDA"
    | "ESTRUCTURA_INVALIDA"
    | "ESTACION_DESCONOCIDA"
    | "ESTACION_DESHABILITADA"
    | "SENSOR_DESCONOCIDO"
    | "VALOR_FUERA_DE_RANGO";

/** Lectura recién guardada, con fecha posterior a la última lectura de su sensor. */
export interface LecturaNueva {
    medicionId: number;
    sensorId: number;
    codigo: string;
    valor: number;
    fecha: Date;
}

/**
 * Evaluación de criterios (§8.2) de las lecturas de una trama. Corre dentro de la
 * transacción de la trama y recibe solo las lecturas que se evalúan: las atrasadas no llegan aquí.
 */
export type EvaluadorLecturas = (tx: Transaccion, lecturas: LecturaNueva[], ahora: Date) => void;

export interface OpcionesIngesta {
    ahora?: Date;
    /** Por defecto, la evaluación de criterios de §8.2. Las pruebas pueden reemplazarla. */
    evaluar?: EvaluadorLecturas;
}

/** Las tramas se guardan en `eventos.detalle` truncadas a 8 KB (§4). */
const MAX_TRAMA_EVENTO = 8 * 1024;

/** Rechazo detectado dentro de la transacción: se revierte y se registra afuera. */
class RechazoTrama extends Error {
    constructor(
        readonly causa: CausaRechazo,
        readonly error: ErrorApi,
        readonly estacionId: number | null = null,
    ) {
        super(error.message);
    }
}

/** Recibe una trama: verifica la credencial, la valida y la guarda. Lo que lance, `manejar` lo responde. */
export async function recibirTrama(bd: BaseDatos, request: Request, opciones: OpcionesIngesta = {}): Promise<RespuestaIngesta> {
    const ahora = opciones.ahora ?? new Date();

    if (!apiKeyValida(request.headers.get("x-api-key"))) {
        // Origen no autorizado: no se procesa ni se guarda el cuerpo (RF03.1).
        registrarRechazo(bd, "CREDENCIAL_INVALIDA", ahora);
        throw noAutenticado("Falta la llave de acceso de la ingesta (encabezado X-Api-Key) o no es válida.");
    }

    const texto = await request.text();
    let cuerpo: unknown;
    try {
        cuerpo = JSON.parse(texto);
    } catch {
        const campos = { cuerpo: "El cuerpo de la trama no es JSON válido." };
        registrarRechazo(bd, "ESTRUCTURA_INVALIDA", ahora, { trama: texto, campos });
        throw validacion(campos, "La trama no es JSON válido.");
    }

    const resultado = esquemaTrama(ahora).safeParse(cuerpo);
    if (!resultado.success) {
        const campos = camposDeZod(resultado.error);
        registrarRechazo(bd, "ESTRUCTURA_INVALIDA", ahora, { trama: cuerpo, campos });
        throw validacion(campos, "La trama no tiene el formato esperado. Revisa los campos indicados.");
    }

    const evaluar = opciones.evaluar ?? evaluarLecturasIngesta;
    let respuesta: RespuestaIngesta;
    try {
        respuesta = bd.transaction((tx) => guardar(tx, resultado.data, cuerpo, ahora, evaluar));
    } catch (error) {
        if (error instanceof RechazoTrama) {
            registrarRechazo(bd, error.causa, ahora, { trama: cuerpo, campos: error.error.campos, estacionId: error.estacionId });
            throw error.error;
        }
        registrarErrorIngesta(bd, cuerpo, error, ahora);
        throw error;
    }

    // Las notificaciones se despachan después de confirmar la transacción (§6). Si el despacho falla,
    // las lecturas ya están guardadas: la respuesta sigue siendo 200 y el próximo despacho reintenta.
    try {
        await despacharNotificaciones(bd, ahora);
    } catch (error) {
        console.error("[ingesta] Falló el despacho de notificaciones:", error);
    }
    return respuesta;
}

function guardar(tx: Transaccion, trama: Trama, cuerpo: unknown, ahora: Date, evaluar: EvaluadorLecturas): RespuestaIngesta {
    const serie = trama.numero_serie;
    const estacion = tx.select().from(estaciones).where(eq(estaciones.numeroSerie, serie)).get();
    if (!estacion) {
        throw new RechazoTrama(
            "ESTACION_DESCONOCIDA",
            noProcesable(`No hay una estación registrada con el número de serie ${serie}.`, {
                numero_serie: "Número de serie no registrado.",
            }),
        );
    }
    if (!estacion.habilitada) {
        throw new RechazoTrama(
            "ESTACION_DESHABILITADA",
            noProcesable(`La estación ${serie} está deshabilitada y no acepta lecturas.`, {
                numero_serie: "Estación deshabilitada.",
            }),
            estacion.id,
        );
    }

    const porCodigo = new Map(tx.select().from(sensores).where(eq(sensores.estacionId, estacion.id)).all().map((s) => [s.codigo, s]));

    const desconocidos: CamposError = {};
    trama.lecturas.forEach((l, i) => {
        if (!porCodigo.has(l.codigo)) desconocidos[`lecturas.${i}.codigo`] = `La estación no tiene un sensor con el código «${l.codigo}».`;
    });
    if (Object.keys(desconocidos).length) {
        throw new RechazoTrama(
            "SENSOR_DESCONOCIDO",
            noProcesable(`La trama trae códigos de sensor que la estación ${serie} no tiene registrados.`, desconocidos),
            estacion.id,
        );
    }

    const fueraDeRango: CamposError = {};
    trama.lecturas.forEach((l, i) => {
        const s = porCodigo.get(l.codigo)!;
        if (l.valor < s.rangoMinimo || l.valor > s.rangoMaximo) {
            fueraDeRango[`lecturas.${i}.valor`] =
                `El valor ${formatearValor(l.valor, s.unidad)} está fuera del rango admisible del sensor ` +
                `(${formatearValor(s.rangoMinimo, s.unidad)} a ${formatearValor(s.rangoMaximo, s.unidad)}).`;
        }
    });
    if (Object.keys(fueraDeRango).length) {
        throw new RechazoTrama(
            "VALOR_FUERA_DE_RANGO",
            noProcesable("La trama trae valores fuera del rango admisible del sensor.", fueraDeRango),
            estacion.id,
        );
    }

    const fecha = trama.fecha;
    let duplicadas = 0;
    const nuevas: LecturaNueva[] = [];
    for (const l of trama.lecturas) {
        const sensor = porCodigo.get(l.codigo)!;
        // El índice único (sensor, fecha) descarta la lectura repetida sin error (RF03.5).
        const fila = tx
            .insert(mediciones)
            .values({ sensorId: sensor.id, valor: l.valor, fecha, payload: cuerpo })
            .onConflictDoNothing()
            .returning({ id: mediciones.id })
            .get();
        if (!fila) {
            duplicadas++;
            continue;
        }
        const ultima = sensor.fechaUltimaLectura;
        // Una lectura atrasada queda en el historial, pero no mueve la última lectura ni se evalúa (§6, §8.2).
        if (ultima !== null && fecha.getTime() < ultima.getTime()) continue;
        tx.update(sensores).set({ fechaUltimaLectura: fecha }).where(eq(sensores.id, sensor.id)).run();
        nuevas.push({ medicionId: fila.id, sensorId: sensor.id, codigo: l.codigo, valor: l.valor, fecha });
    }

    if (nuevas.length) evaluar(tx, nuevas, ahora);
    return { aceptadas: trama.lecturas.length - duplicadas, duplicadas };
}

/** Trama para `eventos.detalle`: nunca con la API key y truncada a 8 KB. */
function tramaParaEvento(trama: unknown): unknown {
    const original = typeof trama === "string" ? trama : JSON.stringify(trama);
    const clave = apiKeyIngesta();
    const texto = clave ? original.replaceAll(clave, "[oculto]") : original;
    const bytes = Buffer.from(texto, "utf8");
    if (bytes.length > MAX_TRAMA_EVENTO) return bytes.subarray(0, MAX_TRAMA_EVENTO).toString("utf8");
    if (texto === original) return trama;
    try {
        return typeof trama === "string" ? texto : JSON.parse(texto);
    } catch {
        return texto;
    }
}

function registrarRechazo(
    bd: BaseDatos,
    causa: CausaRechazo,
    ahora: Date,
    datos: { trama?: unknown; campos?: CamposError; estacionId?: number | null } = {},
) {
    registrarEvento(bd, {
        tipo: "TRAMA_RECHAZADA",
        entidad: datos.estacionId ? "estacion" : null,
        entidadId: datos.estacionId ?? null,
        detalle: {
            causa,
            ...(datos.trama !== undefined && { trama: tramaParaEvento(datos.trama) }),
            ...(datos.campos && { campos: datos.campos }),
        },
        fecha: ahora,
    });
}

function registrarErrorIngesta(bd: BaseDatos, cuerpo: unknown, error: unknown, ahora: Date) {
    const mensaje = error instanceof Error ? error.message : String(error);
    registrarEvento(bd, {
        tipo: "ERROR_INGESTA",
        detalle: { causa: "ERROR_ALMACENAMIENTO", trama: tramaParaEvento(cuerpo), error: mensaje.slice(0, 500) },
        fecha: ahora,
    });
}

/** Si la base no responde, el evento no se puede guardar: se deja en el log del servidor. */
function registrarEvento(bd: BaseDatos, valores: typeof eventos.$inferInsert) {
    try {
        bd.insert(eventos).values(valores).run();
    } catch (e) {
        console.error("[ingesta] No se pudo registrar el evento:", e);
    }
}
