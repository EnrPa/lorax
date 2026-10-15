// Terrenos, estaciones y sensores del productor (RF02, diseno.md §4 y §7). Solo servidor.
// Todo se filtra por la cadena de propiedad terreno → cliente → cuenta: un terreno ajeno responde 404.
import { and, asc, count, eq, inArray } from "drizzle-orm";
import type { Pagina } from "~/lib/esquemas/paginacion";
import type { DatosEstacion, DatosTerreno, EstacionDetalle, TerrenoDetalle } from "~/lib/esquemas/terrenos";
import { variablePorTipo } from "~/lib/variables";
import { conflicto, noEncontrado, noProcesable } from "~/server/api/errores";
import type { BaseDatos } from "~/server/db/cliente";
import { clientes, estaciones, sensores, terrenos } from "~/server/db/esquema";

type Transaccion = Parameters<Parameters<BaseDatos["transaction"]>[0]>[0];
type Bd = BaseDatos | Transaccion;

export const mensajeSerieRepetida = (serie: string) =>
    `Ya existe una estación con el número de serie ${serie}. Revisa el número en la etiqueta de la estación.`;

function clienteDe(bd: Bd, cuentaId: number): number | null {
    return bd.select({ id: clientes.id }).from(clientes).where(eq(clientes.cuentaId, cuentaId)).get()?.id ?? null;
}

/** Arma el detalle (estaciones y sensores) de varios terrenos con tres consultas. */
function detallar(bd: Bd, filas: Array<typeof terrenos.$inferSelect>): TerrenoDetalle[] {
    if (filas.length === 0) return [];
    const estacionesFilas = bd
        .select()
        .from(estaciones)
        .where(inArray(estaciones.terrenoId, filas.map((t) => t.id)))
        .orderBy(asc(estaciones.id))
        .all();
    const sensoresFilas = estacionesFilas.length
        ? bd
              .select()
              .from(sensores)
              .where(inArray(sensores.estacionId, estacionesFilas.map((e) => e.id)))
              .orderBy(asc(sensores.id))
              .all()
        : [];

    const porEstacion = new Map<number, EstacionDetalle>();
    for (const e of estacionesFilas) {
        porEstacion.set(e.id, {
            id: e.id,
            tipo: e.tipo,
            modelo: e.modelo,
            numeroSerie: e.numeroSerie,
            latitud: e.latitud,
            longitud: e.longitud,
            habilitada: e.habilitada,
            sensores: [],
        });
    }
    for (const s of sensoresFilas) {
        porEstacion.get(s.estacionId)?.sensores.push({
            id: s.id,
            codigo: s.codigo,
            tipo: s.tipo,
            unidad: s.unidad,
            rangoMinimo: s.rangoMinimo,
            rangoMaximo: s.rangoMaximo,
        });
    }

    return filas.map((t) => ({
        id: t.id,
        nombre: t.nombre,
        latitud: t.latitud,
        longitud: t.longitud,
        superficie: t.superficie,
        tipoCultivo: t.tipoCultivo,
        estaciones: estacionesFilas.filter((e) => e.terrenoId === t.id).map((e) => porEstacion.get(e.id)!),
    }));
}

/** El terreno si pertenece a la cuenta; si no existe o es ajeno, 404 (no se revela que existe). */
export function terrenoPropio(bd: Bd, cuentaId: number, terrenoId: number) {
    const fila = bd
        .select({ terreno: terrenos })
        .from(terrenos)
        .innerJoin(clientes, eq(clientes.id, terrenos.clienteId))
        .where(and(eq(terrenos.id, terrenoId), eq(clientes.cuentaId, cuentaId)))
        .get();
    if (!fila) throw noEncontrado("No encontramos ese terreno entre los tuyos.");
    return fila.terreno;
}

export function listarTerrenos(bd: BaseDatos, cuentaId: number, pagina: number, tamano: number): Pagina<TerrenoDetalle> {
    const clienteId = clienteDe(bd, cuentaId);
    if (clienteId === null) return { items: [], total: 0, pagina, tamano };

    const total = bd.select({ total: count() }).from(terrenos).where(eq(terrenos.clienteId, clienteId)).get()!.total;
    const filas = bd
        .select()
        .from(terrenos)
        .where(eq(terrenos.clienteId, clienteId))
        .orderBy(asc(terrenos.id))
        .limit(tamano)
        .offset((pagina - 1) * tamano)
        .all();
    return { items: detallar(bd, filas), total, pagina, tamano };
}

export function obtenerTerreno(bd: BaseDatos, cuentaId: number, terrenoId: number): TerrenoDetalle {
    return detallar(bd, [terrenoPropio(bd, cuentaId, terrenoId)])[0];
}

/** Inserta la estación y sus sensores. Si el número de serie existe, lanza 409 con el error en `campo`. */
function insertarEstacion(tx: Transaccion, terreno: { id: number; latitud: number; longitud: number }, datos: DatosEstacion, campo: string, ahora: Date) {
    const repetida = tx.select({ id: estaciones.id }).from(estaciones).where(eq(estaciones.numeroSerie, datos.numeroSerie)).get();
    if (repetida) throw conflicto(mensajeSerieRepetida(datos.numeroSerie), { [campo]: mensajeSerieRepetida(datos.numeroSerie) });

    const estacion = tx
        .insert(estaciones)
        .values({
            terrenoId: terreno.id,
            tipo: datos.tipo,
            modelo: datos.modelo,
            numeroSerie: datos.numeroSerie,
            // RF02.2: sin ubicación propia, la estación usa la del terreno.
            latitud: datos.latitud ?? terreno.latitud,
            longitud: datos.longitud ?? terreno.longitud,
            fechaCreacion: ahora,
            fechaUltimaActualizacion: ahora,
        })
        .returning({ id: estaciones.id })
        .get();

    tx.insert(sensores)
        .values(
            datos.sensores.map((tipo) => {
                const variable = variablePorTipo(tipo)!;
                return {
                    estacionId: estacion.id,
                    codigo: variable.codigo,
                    tipo: variable.tipo,
                    unidad: variable.unidad,
                    rangoMinimo: variable.rangoMinimo,
                    rangoMaximo: variable.rangoMaximo,
                    fechaCreacion: ahora,
                };
            }),
        )
        .run();
}

/** RF02.4: terreno, estación y sensores en una sola transacción; si algo falla, no queda nada escrito. */
export function crearTerreno(
    bd: BaseDatos,
    cuentaId: number,
    datos: { terreno: DatosTerreno; estacion: DatosEstacion },
    ahora = new Date(),
): TerrenoDetalle {
    const clienteId = clienteDe(bd, cuentaId);
    if (clienteId === null) {
        throw noProcesable("Tu cuenta no tiene una empresa asociada. Comunícate con el administrador de la plataforma.");
    }

    const terrenoId = bd.transaction((tx) => {
        const terreno = tx
            .insert(terrenos)
            .values({ clienteId, ...datos.terreno, fechaUltimaActualizacion: ahora })
            .returning()
            .get();
        insertarEstacion(tx, terreno, datos.estacion, "estacion.numeroSerie", ahora);
        return terreno.id;
    });
    return obtenerTerreno(bd, cuentaId, terrenoId);
}

export function agregarEstacion(
    bd: BaseDatos,
    cuentaId: number,
    terrenoId: number,
    datos: DatosEstacion,
    ahora = new Date(),
): TerrenoDetalle {
    bd.transaction((tx) => {
        const terreno = terrenoPropio(tx, cuentaId, terrenoId);
        insertarEstacion(tx, terreno, datos, "numeroSerie", ahora);
    });
    return obtenerTerreno(bd, cuentaId, terrenoId);
}
