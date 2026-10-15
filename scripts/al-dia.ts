// `npm run db:al-dia` (diseno.md §10): completa las mediciones de los datos piloto hasta ahora, sin
// reiniciar la base y con el servidor encendido. Usa el mismo generador que la semilla, así que la
// historia continúa como si las estaciones hubieran seguido reportando.
import { eq } from "drizzle-orm";
import type { BaseDatos } from "~/server/db/cliente";
import { estaciones, sensores, terrenos } from "~/server/db/esquema";
import { estacionesPiloto, SITUACIONES } from "./datos-piloto";
import {
    cargarCriterios,
    crearEvaluador,
    finDeHistoria,
    INTERVALO_MS,
    MS_DIA,
    tramaDe,
    ventanasDeSequia,
} from "./generacion";
import { DIAS_DE_HISTORIA } from "./datos-piloto";
import { ModeloEstacion } from "./modelo-valores";

export interface ResumenAlDia {
    hasta: Date;
    /** Mediciones nuevas por número de serie. */
    porEstacion: Record<string, number>;
    mediciones: number;
    alertasNuevas: number;
}

export function ponerAlDia(bd: BaseDatos, ahora = new Date()): ResumenAlDia {
    const hasta = finDeHistoria(ahora);
    const sqlite = bd.$client;
    const resumen: ResumenAlDia = { hasta, porEstacion: {}, mediciones: 0, alertasNuevas: 0 };

    // La semilla arranca en el mismo instante para todas las estaciones: de ahí se deduce su fin,
    // que fija las ventanas de sequía de EST-0001.
    const primera = sqlite.prepare("SELECT min(fecha) AS fecha FROM mediciones").get() as { fecha: number | null };
    if (primera.fecha === null) return resumen;
    const inicioSemilla = primera.fecha;
    const finSemilla = new Date(inicioSemilla + DIAS_DE_HISTORIA * MS_DIA - INTERVALO_MS);

    const insertar = sqlite.prepare(
        // OR IGNORE: si otra ejecución ya insertó esa medición, no se duplica (índice único sensor + fecha).
        "INSERT OR IGNORE INTO mediciones (sensor_id, valor, fecha, payload) VALUES (?, ?, ?, ?)",
    );
    const alertasAntes = (sqlite.prepare("SELECT count(*) AS n FROM alertas").get() as { n: number }).n;
    // Historia simulada: las notificaciones quedan ENVIADA sin enviarse (§10).
    const evaluar = crearEvaluador(bd, { notificaciones: "ENVIADA" });

    sqlite.transaction(() => {
        for (const piloto of estacionesPiloto()) {
            // EST-0003 debe seguir «sin datos recientes».
            if (piloto.numeroSerie === SITUACIONES.estacionSilenciosa.numeroSerie) continue;

            const estacion = bd
                .select({ id: estaciones.id, habilitada: estaciones.habilitada, terreno: terrenos.nombre })
                .from(estaciones)
                .innerJoin(terrenos, eq(terrenos.id, estaciones.terrenoId))
                .where(eq(estaciones.numeroSerie, piloto.numeroSerie))
                .get();
            if (!estacion || !estacion.habilitada) continue;

            const filasSensores = bd.select().from(sensores).where(eq(sensores.estacionId, estacion.id)).all();
            const ultima = Math.max(...filasSensores.map((s) => s.fechaUltimaLectura?.getTime() ?? Number.NaN));
            if (!Number.isFinite(ultima) || ultima >= hasta.getTime()) continue;

            const porCodigo = new Map(filasSensores.map((s) => [s.codigo, s.id]));

            // Criterios activos de los sensores de la estación, con su alerta vigente si la tienen.
            const criteriosPorSensor = cargarCriterios(bd, filasSensores.map((s) => s.id));

            // El generador tiene estado: se reproduce desde el inicio de la semilla sin guardar nada
            // y se empieza a guardar después de la última lectura.
            const modelo = new ModeloEstacion(piloto, piloto.terreno.clima, ventanasDeSequia(piloto.numeroSerie, finSemilla));
            let nuevas = 0;
            for (let ms = inicioSemilla; ms <= hasta.getTime(); ms += INTERVALO_MS) {
                const fecha = new Date(ms);
                const { lecturas, payload } = tramaDe(piloto.numeroSerie, fecha, modelo.lecturas(fecha), modelo.meta());
                if (ms <= ultima) continue;

                for (const { codigo, valor } of lecturas) {
                    const sensorId = porCodigo.get(codigo);
                    if (sensorId === undefined) continue; // el productor pudo desmarcar ese sensor
                    const resultado = insertar.run(sensorId, valor, ms, payload);
                    if (resultado.changes === 0) continue;
                    nuevas++;
                    for (const criterio of criteriosPorSensor.get(sensorId) ?? []) {
                        evaluar(criterio, codigo, valor, Number(resultado.lastInsertRowid), ms);
                    }
                }
            }

            sqlite
                .prepare(
                    `UPDATE sensores SET fecha_ultima_lectura = (SELECT max(fecha) FROM mediciones WHERE sensor_id = sensores.id)
                     WHERE estacion_id = ?`,
                )
                .run(estacion.id);
            resumen.porEstacion[piloto.numeroSerie] = nuevas;
            resumen.mediciones += nuevas;
        }
    })();

    resumen.alertasNuevas = (sqlite.prepare("SELECT count(*) AS n FROM alertas").get() as { n: number }).n - alertasAntes;
    return resumen;
}
