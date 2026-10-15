// Despacho de notificaciones (RF06.6 y RF06.9, diseno.md §8.5). Solo servidor.
// Corre después de confirmar la transacción de cada trama y cada 60 s (reintentos.ts): envía las
// pendientes y reintenta las que fallaron por una causa pasajera, con espera creciente, hasta MAX_INTENTOS.
import { and, asc, eq, isNull, lt, notInArray, or } from "drizzle-orm";
import type { BaseDatos } from "~/server/db/cliente";
import { alertas, clientes, criterios, cuentas, estaciones, eventos, notificaciones, sensores, terrenos } from "~/server/db/esquema";
import { enviarAviso, ERROR_SIN_TELEFONO, FallaPermanente } from "./canales";

export const MAX_INTENTOS = 5;

/** Espera antes de cada reintento, según los intentos hechos: 1, 2, 4 y 8 minutos (§8.5). */
export const ESPERAS_MS = [1, 2, 4, 8].map((minutos) => minutos * 60_000);

/** Si una notificación fallida ya puede reintentarse: pasó su espera desde el último intento. */
export function puedeReintentarse(intentos: number, ultimoIntento: Date | null, ahora: Date): boolean {
    if (intentos >= MAX_INTENTOS) return false;
    const espera = ESPERAS_MS[intentos - 1] ?? 0;
    return ultimoIntento === null || ahora.getTime() - ultimoIntento.getTime() >= espera;
}

/** Errores de las fallas permanentes: esas notificaciones no se reintentan. */
export const ERRORES_PERMANENTES = [ERROR_SIN_TELEFONO];

export interface ResumenDespacho {
    enviadas: number;
    fallidas: number;
}

// Un despacho a la vez: dos tramas seguidas no envían dos veces la misma notificación.
let cola: Promise<unknown> = Promise.resolve();

export function despacharNotificaciones(bd: BaseDatos, ahora = new Date()): Promise<ResumenDespacho> {
    const turno = cola.then(() => despachar(bd, ahora));
    cola = turno.catch(() => {});
    return turno;
}

async function despachar(bd: BaseDatos, ahora: Date): Promise<ResumenDespacho> {
    const resumen: ResumenDespacho = { enviadas: 0, fallidas: 0 };
    const porEnviar = bd
        .select({
            id: notificaciones.id,
            canal: notificaciones.canal,
            estado: notificaciones.estado,
            intentos: notificaciones.intentos,
            ultimoIntento: notificaciones.fechaUltimoIntento,
            alertaId: alertas.id,
            nombre: alertas.nombre,
            mensaje: alertas.mensaje,
            correo: cuentas.correo,
            telefono: cuentas.telefono,
        })
        .from(notificaciones)
        // Destinatario: el dueño del terreno (alerta → criterio → sensor → estación → terreno → cliente → cuenta).
        .innerJoin(alertas, eq(alertas.id, notificaciones.alertaId))
        .innerJoin(criterios, eq(criterios.id, alertas.criterioId))
        .innerJoin(sensores, eq(sensores.id, criterios.sensorId))
        .innerJoin(estaciones, eq(estaciones.id, sensores.estacionId))
        .innerJoin(terrenos, eq(terrenos.id, estaciones.terrenoId))
        .innerJoin(clientes, eq(clientes.id, terrenos.clienteId))
        .innerJoin(cuentas, eq(cuentas.id, clientes.cuentaId))
        .where(
            or(
                eq(notificaciones.estado, "PENDIENTE"),
                and(
                    eq(notificaciones.estado, "FALLIDA"),
                    lt(notificaciones.intentos, MAX_INTENTOS),
                    or(isNull(notificaciones.error), notInArray(notificaciones.error, ERRORES_PERMANENTES)),
                ),
            ),
        )
        .orderBy(asc(notificaciones.id))
        .all()
        // Una fallida espera su turno, la despache una trama o la tarea periódica.
        .filter((n) => n.estado === "PENDIENTE" || puedeReintentarse(n.intentos, n.ultimoIntento, ahora));

    for (const n of porEnviar) {
        const intentos = n.intentos + 1;
        try {
            await enviarAviso(
                { canal: n.canal, destinatario: { correo: n.correo, telefono: n.telefono }, alerta: { nombre: n.nombre, mensaje: n.mensaje } },
                ahora,
            );
            bd.update(notificaciones)
                .set({ estado: "ENVIADA", intentos, fechaUltimoIntento: ahora, error: null })
                .where(eq(notificaciones.id, n.id))
                .run();
            resumen.enviadas++;
        } catch (error) {
            const permanente = error instanceof FallaPermanente;
            const mensaje = (error instanceof Error ? error.message : String(error)).slice(0, 500);
            // La alerta se conserva; solo cambia el estado del envío (RF06.9).
            bd.update(notificaciones)
                .set({ estado: "FALLIDA", intentos, fechaUltimoIntento: ahora, error: mensaje })
                .where(eq(notificaciones.id, n.id))
                .run();
            bd.insert(eventos)
                .values({
                    tipo: "ERROR_NOTIFICACION",
                    entidad: "notificacion",
                    entidadId: n.id,
                    detalle: {
                        causa: permanente ? error.causa : "ENVIO_FALLIDO",
                        canal: n.canal,
                        alertaId: n.alertaId,
                        intento: intentos,
                        reintentar: !permanente && intentos < MAX_INTENTOS,
                        error: mensaje,
                    },
                    fecha: ahora,
                })
                .run();
            resumen.fallidas++;
        }
    }
    return resumen;
}
