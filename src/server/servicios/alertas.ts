// Alertas del productor (RF04.5 y RF06). Solo servidor.
// Propiedad: alerta → criterio → sensor → estación → terreno → cliente → cuenta.
import { and, count, desc, eq, sql } from "drizzle-orm";
import type { AlertaResumen } from "~/lib/esquemas/estado";
import type { Pagina } from "~/lib/esquemas/paginacion";
import { variablePorTipo } from "~/lib/variables";
import { noEncontrado } from "~/server/api/errores";
import type { BaseDatos } from "~/server/db/cliente";
import { alertas, clientes, criterios, estaciones, sensores, terrenos } from "~/server/db/esquema";

function consultaAlertas(bd: BaseDatos) {
    return bd
        .select({
            id: alertas.id,
            nombre: alertas.nombre,
            mensaje: alertas.mensaje,
            severidad: alertas.tipo,
            estado: alertas.estado,
            leida: alertas.leida,
            fecha: alertas.fecha,
            fechaResolucion: alertas.fechaResolucion,
            descripcion: alertas.descripcion,
            numeroSerie: estaciones.numeroSerie,
            terreno: terrenos.nombre,
            tipoSensor: sensores.tipo,
        })
        .from(alertas)
        .innerJoin(criterios, eq(criterios.id, alertas.criterioId))
        .innerJoin(sensores, eq(sensores.id, criterios.sensorId))
        .innerJoin(estaciones, eq(estaciones.id, sensores.estacionId))
        .innerJoin(terrenos, eq(terrenos.id, estaciones.terrenoId))
        .innerJoin(clientes, eq(clientes.id, terrenos.clienteId));
}

type FilaAlerta = Awaited<ReturnType<ReturnType<typeof consultaAlertas>["all"]>>[number];

function resumir(f: FilaAlerta): AlertaResumen {
    return {
        id: f.id,
        nombre: f.nombre,
        mensaje: f.mensaje,
        severidad: f.severidad,
        estado: f.estado,
        leida: f.leida,
        fecha: f.fecha.toISOString(),
        fechaResolucion: f.fechaResolucion?.toISOString() ?? null,
        descripcion: f.descripcion,
        numeroSerie: f.numeroSerie,
        terreno: f.terreno,
        variable: variablePorTipo(f.tipoSensor)?.etiqueta ?? f.tipoSensor,
    };
}

/** Las más recientes de un terreno, con las vigentes primero (RF04.5). */
export function alertasRecientes(bd: BaseDatos, terrenoId: number, limite = 10): AlertaResumen[] {
    return consultaAlertas(bd)
        .where(eq(terrenos.id, terrenoId))
        .orderBy(sql`${alertas.estado} = 'VIGENTE' DESC`, desc(alertas.fecha), desc(alertas.id))
        .limit(limite)
        .all()
        .map(resumir);
}

/** PATCH /alertas/:id: marca como leída una alerta de la cuenta; una ajena responde 404. */
export function marcarLeida(bd: BaseDatos, cuentaId: number, alertaId: number): AlertaResumen {
    const propia = consultaAlertas(bd).where(and(eq(alertas.id, alertaId), eq(clientes.cuentaId, cuentaId))).get();
    if (!propia) throw noEncontrado("No encontramos esa alerta entre las tuyas.");
    bd.update(alertas).set({ leida: true }).where(eq(alertas.id, alertaId)).run();
    return resumir({ ...propia, leida: true });
}

const ordenAlertas = [sql`${alertas.estado} = 'VIGENTE' DESC`, desc(alertas.fecha), desc(alertas.id)] as const;

/** GET /alertas (RF06.10): filtros por terreno, estado y no leídas; vigentes primero, como en el panel. */
export function listarAlertas(
    bd: BaseDatos,
    cuentaId: number,
    filtros: { terrenoId?: number; estado?: "VIGENTE" | "RESUELTA"; noLeidas: boolean; pagina: number; tamano: number },
): Pagina<AlertaResumen> {
    const condiciones = and(
        eq(clientes.cuentaId, cuentaId),
        filtros.terrenoId ? eq(terrenos.id, filtros.terrenoId) : undefined,
        filtros.estado ? eq(alertas.estado, filtros.estado) : undefined,
        filtros.noLeidas ? eq(alertas.leida, false) : undefined,
    );
    const total = bd
        .select({ total: count() })
        .from(alertas)
        .innerJoin(criterios, eq(criterios.id, alertas.criterioId))
        .innerJoin(sensores, eq(sensores.id, criterios.sensorId))
        .innerJoin(estaciones, eq(estaciones.id, sensores.estacionId))
        .innerJoin(terrenos, eq(terrenos.id, estaciones.terrenoId))
        .innerJoin(clientes, eq(clientes.id, terrenos.clienteId))
        .where(condiciones)
        .get()!.total;
    const items = consultaAlertas(bd)
        .where(condiciones)
        .orderBy(...ordenAlertas)
        .limit(filtros.tamano)
        .offset((filtros.pagina - 1) * filtros.tamano)
        .all()
        .map(resumir);
    return { items, total, pagina: filtros.pagina, tamano: filtros.tamano };
}

/** GET /alertas/no-leidas/cantidad: para el indicador del menú (RF06.10). */
export function contarNoLeidas(bd: BaseDatos, cuentaId: number): number {
    return bd
        .select({ total: count() })
        .from(alertas)
        .innerJoin(criterios, eq(criterios.id, alertas.criterioId))
        .innerJoin(sensores, eq(sensores.id, criterios.sensorId))
        .innerJoin(estaciones, eq(estaciones.id, sensores.estacionId))
        .innerJoin(terrenos, eq(terrenos.id, estaciones.terrenoId))
        .innerJoin(clientes, eq(clientes.id, terrenos.clienteId))
        .where(and(eq(clientes.cuentaId, cuentaId), eq(alertas.leida, false)))
        .get()!.total;
}
