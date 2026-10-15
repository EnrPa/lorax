// Administración de cuentas, estaciones y criterios (RF07, diseno.md §7). Solo servidor.
// Toda operación y su evento OPERACION_ADMINISTRATIVA van en la misma transacción (RF07.8).
import { and, asc, count, desc, eq, gte, lt, or, sql, type SQL } from "drizzle-orm";
import type { CuentaAdmin, DetalleCuentaAdmin, EventoAdmin } from "~/lib/esquemas/admin";
import { MENSAJE_AVISO_CAMBIO_CORREO, MENSAJE_CORREO_REPETIDO, MENSAJE_RUT_REPETIDO } from "~/lib/esquemas/admin";
import type { Pagina } from "~/lib/esquemas/paginacion";
import { conflicto, noEncontrado } from "~/server/api/errores";
import { crearEnlace, VIGENCIA_HORAS } from "~/server/auth/enlaces";
import { revocarSesionesDeCuenta } from "~/server/auth/sesiones";
import { enviarCorreo } from "~/server/correo/correo";
import type { BaseDatos } from "~/server/db/cliente";
import { clientes, criterios, cuentas, empresas, estaciones, eventos } from "~/server/db/esquema";
import { DESCRIPCION_CRITERIO_ELIMINADO, listarCriterios, resolverAlertaVigente } from "./criterios";
import { enlaceRestablecer } from "./recuperacion";
import { listarTerrenos } from "./terrenos";

type Transaccion = Parameters<Parameters<BaseDatos["transaction"]>[0]>[0];
type Bd = BaseDatos | Transaccion;

export type AccionAdministrativa =
    | "CREAR_CUENTA"
    | "ACTUALIZAR_CUENTA"
    | "HABILITAR_CUENTA"
    | "DESHABILITAR_CUENTA"
    | "REENVIAR_ACTIVACION"
    | "DESHABILITAR_ESTACION"
    | "ELIMINAR_CRITERIO";

/** Registra la operación: responsable, fecha, acción, elemento afectado y motivo (RF07.8). */
function registrar(
    tx: Bd,
    adminId: number,
    datos: { accion: AccionAdministrativa; entidad: string; entidadId: number; motivo?: string | null; detalle?: Record<string, unknown> },
    ahora: Date,
) {
    tx.insert(eventos)
        .values({
            cuentaId: adminId,
            tipo: "OPERACION_ADMINISTRATIVA",
            entidad: datos.entidad,
            entidadId: datos.entidadId,
            motivo: datos.motivo || null,
            detalle: { accion: datos.accion, ...datos.detalle },
            fecha: ahora,
        })
        .run();
}

// ——— Cuentas ———

function consultaCuentas(bd: Bd) {
    return bd
        .select({
            id: cuentas.id,
            nombre: cuentas.nombre,
            apellido: cuentas.apellido,
            correo: cuentas.correo,
            telefono: cuentas.telefono,
            habilitada: cuentas.habilitada,
            contrasenaHash: cuentas.contrasenaHash,
            cargo: clientes.cargo,
            empresaId: empresas.id,
            empresaNombre: empresas.nombre,
            empresaRut: empresas.rut,
        })
        .from(cuentas)
        .leftJoin(clientes, eq(clientes.cuentaId, cuentas.id))
        .leftJoin(empresas, eq(empresas.id, clientes.empresaId));
}

type FilaCuenta = Awaited<ReturnType<ReturnType<typeof consultaCuentas>["all"]>>[number];

function aCuentaAdmin(f: FilaCuenta): CuentaAdmin {
    return {
        id: f.id,
        nombre: f.nombre,
        apellido: f.apellido,
        correo: f.correo,
        telefono: f.telefono,
        habilitada: f.habilitada,
        // Estado derivado (§4): sin contraseña, la cuenta está pendiente de activación.
        pendienteActivacion: f.contrasenaHash === null,
        cargo: f.cargo ?? null,
        empresa: f.empresaId !== null && f.empresaNombre !== null && f.empresaRut !== null ? { id: f.empresaId, nombre: f.empresaNombre, rut: f.empresaRut } : null,
    };
}

/** Solo cuentas de productor (§7): una de administrador responde 404. */
function productor(bd: Bd, cuentaId: number): FilaCuenta {
    const fila = consultaCuentas(bd).where(and(eq(cuentas.id, cuentaId), eq(cuentas.rol, "PRODUCTOR"))).get();
    if (!fila) throw noEncontrado("No encontramos esa cuenta de productor.");
    return fila;
}

function correoOcupado(bd: Bd, correo: string, excepto?: number): boolean {
    const fila = bd
        .select({ id: cuentas.id })
        .from(cuentas)
        .where(eq(sql`lower(${cuentas.correo})`, correo.toLowerCase()))
        .get();
    return !!fila && fila.id !== excepto;
}

export function listarCuentas(
    bd: BaseDatos,
    filtros: { q?: string; habilitada?: boolean; pagina: number; tamano: number },
): Pagina<CuentaAdmin> {
    const patron = filtros.q ? `%${filtros.q.toLowerCase().replace(/[%_\\]/g, "\\$&")}%` : null;
    const condiciones = and(
        eq(cuentas.rol, "PRODUCTOR"),
        filtros.habilitada === undefined ? undefined : eq(cuentas.habilitada, filtros.habilitada),
        patron
            ? or(
                  sql`lower(${cuentas.nombre}) LIKE ${patron} ESCAPE '\\'`,
                  sql`lower(${cuentas.apellido}) LIKE ${patron} ESCAPE '\\'`,
                  sql`lower(${cuentas.nombre} || ' ' || ${cuentas.apellido}) LIKE ${patron} ESCAPE '\\'`,
                  sql`lower(${cuentas.correo}) LIKE ${patron} ESCAPE '\\'`,
              )
            : undefined,
    );
    const total = bd.select({ total: count() }).from(cuentas).where(condiciones).get()!.total;
    const items = consultaCuentas(bd)
        .where(condiciones)
        .orderBy(asc(cuentas.apellido), asc(cuentas.nombre), asc(cuentas.id))
        .limit(filtros.tamano)
        .offset((filtros.pagina - 1) * filtros.tamano)
        .all()
        .map(aCuentaAdmin);
    return { items, total, pagina: filtros.pagina, tamano: filtros.tamano };
}

/** Detalle con terrenos, estaciones y criterios. No incluye mediciones (RF07.5). */
export function detalleCuenta(bd: BaseDatos, cuentaId: number): DetalleCuentaAdmin {
    const cuenta = aCuentaAdmin(productor(bd, cuentaId));
    return {
        ...cuenta,
        terrenos: listarTerrenos(bd, cuentaId, 1, 1000).items,
        criterios: listarCriterios(bd, cuentaId, { pagina: 1, tamano: 1000 }).items,
    };
}

async function enviarActivacion(para: { correo: string; nombre: string }, token: string) {
    await enviarCorreo({
        para: para.correo,
        asunto: "Activa tu cuenta en LoRax",
        texto: [
            `Hola, ${para.nombre}:`,
            "",
            "El administrador de LoRax creó una cuenta para ti. Para empezar, define tu contraseña con este enlace:",
            "",
            enlaceRestablecer(token),
            "",
            `El enlace sirve una sola vez y vence en ${VIGENCIA_HORAS.ACTIVACION} horas. Si vence, pide al administrador que te envíe uno nuevo.`,
        ].join("\n"),
    });
}

/** RF07.3: crea el productor (y su empresa si es nueva) sin contraseña, y le envía el enlace de activación. */
export async function crearProductor(
    bd: BaseDatos,
    adminId: number,
    datos: {
        nombre: string;
        apellido: string;
        correo: string;
        telefono: string | null;
        cargo: string | null;
        empresa: { id: number } | { nombre: string; rut: string };
        motivo?: string;
    },
    ahora = new Date(),
): Promise<CuentaAdmin> {
    const { cuentaId, token } = bd.transaction((tx) => {
        if (correoOcupado(tx, datos.correo)) throw conflicto(MENSAJE_CORREO_REPETIDO, { correo: MENSAJE_CORREO_REPETIDO });

        let empresaId: number;
        if ("id" in datos.empresa) {
            const existente = tx.select({ id: empresas.id }).from(empresas).where(eq(empresas.id, datos.empresa.id)).get();
            if (!existente) throw noEncontrado("No encontramos esa empresa. Elígela de nuevo de la lista.");
            empresaId = existente.id;
        } else {
            const repetida = tx.select({ id: empresas.id }).from(empresas).where(eq(empresas.rut, datos.empresa.rut)).get();
            if (repetida) throw conflicto(MENSAJE_RUT_REPETIDO, { "empresa.rut": MENSAJE_RUT_REPETIDO });
            empresaId = tx.insert(empresas).values(datos.empresa).returning({ id: empresas.id }).get().id;
        }

        const cuenta = tx
            .insert(cuentas)
            .values({ nombre: datos.nombre, apellido: datos.apellido, correo: datos.correo, telefono: datos.telefono, rol: "PRODUCTOR", contrasenaHash: null })
            .returning({ id: cuentas.id })
            .get();
        tx.insert(clientes).values({ cargo: datos.cargo, empresaId, cuentaId: cuenta.id }).run();
        const token = crearEnlace(tx, cuenta.id, "ACTIVACION", ahora);
        registrar(tx, adminId, { accion: "CREAR_CUENTA", entidad: "cuentas", entidadId: cuenta.id, motivo: datos.motivo, detalle: { correo: datos.correo, empresaId } }, ahora);
        return { cuentaId: cuenta.id, token };
    });

    // El correo se envía después de confirmar; si fallara, el administrador puede reenviar la activación.
    await enviarActivacion({ correo: datos.correo, nombre: datos.nombre }, token);
    return aCuentaAdmin(productor(bd, cuentaId));
}

/** RF07.4: datos generales. El evento guarda cada campo modificado con su valor anterior y nuevo (§7). */
export async function actualizarCuenta(
    bd: BaseDatos,
    adminId: number,
    cuentaId: number,
    datos: { nombre: string; apellido: string; correo: string; telefono: string | null; cargo: string | null; motivo?: string },
    ahora = new Date(),
): Promise<CuentaAdmin> {
    const { correoAnterior, nombre } = bd.transaction((tx) => {
        const actual = productor(tx, cuentaId);
        if (datos.correo !== actual.correo.toLowerCase() && correoOcupado(tx, datos.correo, cuentaId)) {
            throw conflicto(MENSAJE_CORREO_REPETIDO, { correo: MENSAJE_CORREO_REPETIDO });
        }

        const cambios: Record<string, { anterior: unknown; nuevo: unknown }> = {};
        const comparar = (campo: string, anterior: unknown, nuevo: unknown) => {
            if (anterior !== nuevo) cambios[campo] = { anterior, nuevo };
        };
        comparar("nombre", actual.nombre, datos.nombre);
        comparar("apellido", actual.apellido, datos.apellido);
        comparar("correo", actual.correo, datos.correo);
        comparar("telefono", actual.telefono, datos.telefono);
        comparar("cargo", actual.cargo ?? null, datos.cargo);

        tx.update(cuentas)
            .set({ nombre: datos.nombre, apellido: datos.apellido, correo: datos.correo, telefono: datos.telefono })
            .where(eq(cuentas.id, cuentaId))
            .run();
        tx.update(clientes).set({ cargo: datos.cargo }).where(eq(clientes.cuentaId, cuentaId)).run();
        registrar(tx, adminId, { accion: "ACTUALIZAR_CUENTA", entidad: "cuentas", entidadId: cuentaId, motivo: datos.motivo, detalle: { cambios } }, ahora);
        return { correoAnterior: "correo" in cambios ? actual.correo : null, nombre: datos.nombre };
    });

    // Aviso al correo anterior (§7), después de confirmar.
    if (correoAnterior) {
        await enviarCorreo({
            para: correoAnterior,
            asunto: "El correo de tu cuenta LoRax cambió",
            texto: [`Hola, ${nombre}:`, "", MENSAJE_AVISO_CAMBIO_CORREO].join("\n"),
        });
    }
    return aCuentaAdmin(productor(bd, cuentaId));
}

/** RF07.4 y RF07.9: deshabilitar revoca las sesiones abiertas; los datos se conservan. */
export function cambiarHabilitacionCuenta(
    bd: BaseDatos,
    adminId: number,
    cuentaId: number,
    datos: { habilitada: boolean; motivo?: string },
    ahora = new Date(),
): CuentaAdmin {
    bd.transaction((tx) => {
        const actual = productor(tx, cuentaId);
        if (actual.habilitada === datos.habilitada) {
            throw conflicto(datos.habilitada ? "La cuenta ya está habilitada." : "La cuenta ya está deshabilitada.");
        }
        tx.update(cuentas).set({ habilitada: datos.habilitada }).where(eq(cuentas.id, cuentaId)).run();
        if (!datos.habilitada) revocarSesionesDeCuenta(tx, cuentaId);
        registrar(
            tx,
            adminId,
            { accion: datos.habilitada ? "HABILITAR_CUENTA" : "DESHABILITAR_CUENTA", entidad: "cuentas", entidadId: cuentaId, motivo: datos.motivo },
            ahora,
        );
    });
    return aCuentaAdmin(productor(bd, cuentaId));
}

/** Solo para cuentas pendientes de activación (§7): invalida los enlaces anteriores y envía uno nuevo. */
export async function reenviarActivacion(bd: BaseDatos, adminId: number, cuentaId: number, motivo?: string, ahora = new Date()): Promise<void> {
    const { token, cuenta } = bd.transaction((tx) => {
        const cuenta = productor(tx, cuentaId);
        if (cuenta.contrasenaHash !== null) throw conflicto("Esta cuenta ya está activa: su dueño ya definió su contraseña.");
        const token = crearEnlace(tx, cuentaId, "ACTIVACION", ahora); // invalida los anteriores no usados
        registrar(tx, adminId, { accion: "REENVIAR_ACTIVACION", entidad: "cuentas", entidadId: cuentaId, motivo }, ahora);
        return { token, cuenta };
    });
    await enviarActivacion(cuenta, token);
}

// ——— Estaciones y criterios ———

/** RF07.6: la estación deja de aceptar lecturas (la ingesta lo aplica) y conserva su historial. */
export function deshabilitarEstacion(bd: BaseDatos, adminId: number, estacionId: number, motivo: string, ahora = new Date()) {
    return bd.transaction((tx) => {
        const estacion = tx.select().from(estaciones).where(eq(estaciones.id, estacionId)).get();
        if (!estacion) throw noEncontrado("No encontramos esa estación.");
        if (!estacion.habilitada) throw conflicto("La estación ya está deshabilitada.");
        tx.update(estaciones).set({ habilitada: false, fechaUltimaActualizacion: ahora }).where(eq(estaciones.id, estacionId)).run();
        registrar(tx, adminId, { accion: "DESHABILITAR_ESTACION", entidad: "estaciones", entidadId: estacionId, motivo, detalle: { numeroSerie: estacion.numeroSerie } }, ahora);
        return { id: estacion.id, numeroSerie: estacion.numeroSerie, habilitada: false };
    });
}

/** RF07.7: eliminación lógica; sus alertas se conservan y la vigente se resuelve (§8.2). */
export function eliminarCriterioAdmin(bd: BaseDatos, adminId: number, criterioId: number, motivo: string, ahora = new Date()): void {
    bd.transaction((tx) => {
        const criterio = tx.select().from(criterios).where(and(eq(criterios.id, criterioId), sql`${criterios.fechaEliminacion} IS NULL`)).get();
        if (!criterio) throw noEncontrado("No encontramos ese umbral, o ya estaba eliminado.");
        tx.update(criterios).set({ fechaEliminacion: ahora }).where(eq(criterios.id, criterioId)).run();
        resolverAlertaVigente(tx, criterioId, DESCRIPCION_CRITERIO_ELIMINADO, ahora);
        registrar(tx, adminId, { accion: "ELIMINAR_CRITERIO", entidad: "criterios", entidadId: criterioId, motivo, detalle: { sensorId: criterio.sensorId } }, ahora);
    });
}

// ——— Listas de apoyo ———

export function listarEmpresas(bd: BaseDatos) {
    return bd.select({ id: empresas.id, nombre: empresas.nombre, rut: empresas.rut }).from(empresas).orderBy(asc(empresas.nombre)).all();
}

/** RF07.10: eventos del sistema, del más reciente al más antiguo. */
export function listarEventos(
    bd: BaseDatos,
    filtros: { tipo?: EventoAdmin["tipo"]; desde?: Date; hasta?: Date; pagina: number; tamano: number },
): Pagina<EventoAdmin> {
    const condiciones: Array<SQL | undefined> = [
        filtros.tipo ? eq(eventos.tipo, filtros.tipo) : undefined,
        filtros.desde ? gte(eventos.fecha, filtros.desde) : undefined,
        filtros.hasta ? lt(eventos.fecha, filtros.hasta) : undefined,
    ];
    const donde = and(...condiciones);
    const total = bd.select({ total: count() }).from(eventos).where(donde).get()!.total;
    const filas = bd
        .select({
            id: eventos.id,
            tipo: eventos.tipo,
            fecha: eventos.fecha,
            entidad: eventos.entidad,
            entidadId: eventos.entidadId,
            motivo: eventos.motivo,
            detalle: eventos.detalle,
            responsableId: cuentas.id,
            responsableNombre: cuentas.nombre,
            responsableApellido: cuentas.apellido,
            responsableCorreo: cuentas.correo,
        })
        .from(eventos)
        .leftJoin(cuentas, eq(cuentas.id, eventos.cuentaId))
        .where(donde)
        .orderBy(desc(eventos.fecha), desc(eventos.id))
        .limit(filtros.tamano)
        .offset((filtros.pagina - 1) * filtros.tamano)
        .all();
    return {
        items: filas.map((f) => ({
            id: f.id,
            tipo: f.tipo,
            fecha: f.fecha.toISOString(),
            responsable:
                f.responsableId !== null
                    ? { id: f.responsableId, nombre: f.responsableNombre!, apellido: f.responsableApellido!, correo: f.responsableCorreo! }
                    : null,
            entidad: f.entidad,
            entidadId: f.entidadId,
            motivo: f.motivo,
            detalle: f.detalle,
        })),
        total,
        pagina: filtros.pagina,
        tamano: filtros.tamano,
    };
}

