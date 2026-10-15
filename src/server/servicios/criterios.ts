// Criterios (umbrales) del productor (RF06.1 a RF06.4, diseno.md §7 y §8.2). Solo servidor.
// Propiedad: criterio → sensor → estación → terreno → cliente → cuenta. Un recurso ajeno responde 404.
import { and, asc, count, desc, eq, isNull } from "drizzle-orm";
import type { Canal, CriterioDetalle, LecturasRecientes } from "~/lib/esquemas/criterios";
import { mensajeFueraDeRango } from "~/lib/esquemas/criterios";
import type { Pagina } from "~/lib/esquemas/paginacion";
import { variablePorTipo } from "~/lib/variables";
import { noEncontrado, validacion } from "~/server/api/errores";
import type { BaseDatos } from "~/server/db/cliente";
import { alertas, clientes, criterios, estaciones, mediciones, sensores, terrenos } from "~/server/db/esquema";

type Transaccion = Parameters<Parameters<BaseDatos["transaction"]>[0]>[0];
type Bd = BaseDatos | Transaccion;

export const DESCRIPCION_CRITERIO_ELIMINADO = "Criterio eliminado";
export const DESCRIPCION_CRITERIO_DESHABILITADO = "Criterio deshabilitado";

function sensorPropio(bd: Bd, cuentaId: number, sensorId: number) {
    const fila = bd
        .select({ sensor: sensores })
        .from(sensores)
        .innerJoin(estaciones, eq(estaciones.id, sensores.estacionId))
        .innerJoin(terrenos, eq(terrenos.id, estaciones.terrenoId))
        .innerJoin(clientes, eq(clientes.id, terrenos.clienteId))
        .where(and(eq(sensores.id, sensorId), eq(clientes.cuentaId, cuentaId)))
        .get();
    if (!fila) throw noEncontrado("No encontramos ese sensor entre los tuyos.");
    return fila.sensor;
}

function consultaCriterios(bd: Bd) {
    return bd
        .select({
            id: criterios.id,
            sensorId: sensores.id,
            terrenoId: terrenos.id,
            terrenoNombre: terrenos.nombre,
            numeroSerie: estaciones.numeroSerie,
            tipo: sensores.tipo,
            unidad: sensores.unidad,
            umbral: criterios.umbral,
            condicion: criterios.condicion,
            severidad: criterios.severidad,
            canales: criterios.canales,
            habilitado: criterios.habilitado,
            fechaCreacion: criterios.fechaCreacion,
        })
        .from(criterios)
        .innerJoin(sensores, eq(sensores.id, criterios.sensorId))
        .innerJoin(estaciones, eq(estaciones.id, sensores.estacionId))
        .innerJoin(terrenos, eq(terrenos.id, estaciones.terrenoId))
        .innerJoin(clientes, eq(clientes.id, terrenos.clienteId));
}

type FilaCriterio = Awaited<ReturnType<ReturnType<typeof consultaCriterios>["all"]>>[number];

function detalle(f: FilaCriterio): CriterioDetalle {
    return {
        id: f.id,
        sensorId: f.sensorId,
        terreno: { id: f.terrenoId, nombre: f.terrenoNombre },
        numeroSerie: f.numeroSerie,
        tipo: f.tipo,
        etiqueta: variablePorTipo(f.tipo)?.etiqueta ?? f.tipo,
        unidad: f.unidad,
        umbral: f.umbral,
        condicion: f.condicion,
        severidad: f.severidad,
        canales: (f.canales ? f.canales.split(",") : []) as Canal[],
        habilitado: f.habilitado,
        fechaCreacion: f.fechaCreacion.toISOString(),
    };
}

/** Criterio de la cuenta que no esté eliminado; si no, 404. */
function criterioPropio(bd: Bd, cuentaId: number, criterioId: number): FilaCriterio {
    const fila = consultaCriterios(bd)
        .where(and(eq(criterios.id, criterioId), eq(clientes.cuentaId, cuentaId), isNull(criterios.fechaEliminacion)))
        .get();
    if (!fila) throw noEncontrado("No encontramos ese umbral entre los tuyos.");
    return fila;
}

export function lecturasRecientes(bd: BaseDatos, cuentaId: number, sensorId: number): LecturasRecientes {
    const sensor = sensorPropio(bd, cuentaId, sensorId);
    const filas = bd
        .select({ fecha: mediciones.fecha, valor: mediciones.valor })
        .from(mediciones)
        .where(eq(mediciones.sensorId, sensor.id))
        .orderBy(desc(mediciones.fecha))
        .limit(5)
        .all();
    return {
        sensorId: sensor.id,
        etiqueta: variablePorTipo(sensor.tipo)?.etiqueta ?? sensor.tipo,
        unidad: sensor.unidad,
        rangoMinimo: sensor.rangoMinimo,
        rangoMaximo: sensor.rangoMaximo,
        lecturas: filas.map((f) => ({ fecha: f.fecha.toISOString(), valor: f.valor })),
    };
}

export function listarCriterios(
    bd: BaseDatos,
    cuentaId: number,
    filtros: { terrenoId?: number; pagina: number; tamano: number },
): Pagina<CriterioDetalle> {
    const condiciones = and(
        eq(clientes.cuentaId, cuentaId),
        isNull(criterios.fechaEliminacion),
        filtros.terrenoId ? eq(terrenos.id, filtros.terrenoId) : undefined,
    );
    const total = bd
        .select({ total: count() })
        .from(criterios)
        .innerJoin(sensores, eq(sensores.id, criterios.sensorId))
        .innerJoin(estaciones, eq(estaciones.id, sensores.estacionId))
        .innerJoin(terrenos, eq(terrenos.id, estaciones.terrenoId))
        .innerJoin(clientes, eq(clientes.id, terrenos.clienteId))
        .where(condiciones)
        .get()!.total;
    const items = consultaCriterios(bd)
        .where(condiciones)
        .orderBy(asc(terrenos.id), asc(estaciones.id), asc(sensores.id), asc(criterios.id))
        .limit(filtros.tamano)
        .offset((filtros.pagina - 1) * filtros.tamano)
        .all()
        .map(detalle);
    return { items, total, pagina: filtros.pagina, tamano: filtros.tamano };
}

export function crearCriterio(
    bd: BaseDatos,
    cuentaId: number,
    datos: { sensorId: number; umbral: number; condicion: "SUPERA" | "DESCIENDE"; canales: Canal[] },
    ahora = new Date(),
): CriterioDetalle {
    const sensor = sensorPropio(bd, cuentaId, datos.sensorId);
    // RF06.2: el umbral debe estar dentro del rango admisible del sensor.
    if (datos.umbral < sensor.rangoMinimo || datos.umbral > sensor.rangoMaximo) {
        throw validacion({ umbral: mensajeFueraDeRango(sensor.rangoMinimo, sensor.rangoMaximo, sensor.unidad) });
    }
    const { id } = bd
        .insert(criterios)
        .values({
            sensorId: sensor.id,
            umbral: datos.umbral,
            condicion: datos.condicion,
            canales: datos.canales.join(","),
            fechaCreacion: ahora,
        })
        .returning({ id: criterios.id })
        .get();
    return detalle(criterioPropio(bd, cuentaId, id));
}

/**
 * Regla de §8.2: al eliminar o deshabilitar un criterio, su alerta vigente (si existe) pasa a RESUELTA
 * con la descripción que corresponda. Se llama dentro de la transacción de la operación. La usa
 * también la administración (T3.1).
 */
export function resolverAlertaVigente(tx: Bd, criterioId: number, descripcion: string, ahora: Date): void {
    tx.update(alertas)
        .set({ estado: "RESUELTA", fechaResolucion: ahora, descripcion })
        .where(and(eq(alertas.criterioId, criterioId), eq(alertas.estado, "VIGENTE")))
        .run();
}

export function cambiarHabilitacion(bd: BaseDatos, cuentaId: number, criterioId: number, habilitado: boolean, ahora = new Date()): CriterioDetalle {
    bd.transaction((tx) => {
        criterioPropio(tx, cuentaId, criterioId);
        tx.update(criterios).set({ habilitado }).where(eq(criterios.id, criterioId)).run();
        // Al volver a habilitarlo no se evalúa hacia atrás: sigue desde la siguiente lectura.
        if (!habilitado) resolverAlertaVigente(tx, criterioId, DESCRIPCION_CRITERIO_DESHABILITADO, ahora);
    });
    return detalle(criterioPropio(bd, cuentaId, criterioId));
}

/** Eliminación lógica (RF06.4): el criterio deja de evaluarse y sus alertas se conservan. */
export function eliminarCriterio(bd: BaseDatos, cuentaId: number, criterioId: number, ahora = new Date()): void {
    bd.transaction((tx) => {
        criterioPropio(tx, cuentaId, criterioId);
        tx.update(criterios).set({ fechaEliminacion: ahora }).where(eq(criterios.id, criterioId)).run();
        resolverAlertaVigente(tx, criterioId, DESCRIPCION_CRITERIO_ELIMINADO, ahora);
    });
}
