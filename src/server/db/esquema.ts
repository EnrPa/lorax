// Modelo de datos del prototipo (diseno.md §4), sobre SQLite con Drizzle.
// Las fechas son enteros en milisegundos UTC (D7); las columnas JSON se guardan como texto.
import { sql, type SQL } from "drizzle-orm";
import {
    check,
    index,
    integer,
    real,
    sqliteTable,
    text,
    uniqueIndex,
    type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";

export const ROLES = ["ADMINISTRADOR", "PRODUCTOR"] as const;
export const CONDICIONES = ["SUPERA", "DESCIENDE"] as const;
export const SEVERIDADES = ["ADVERTENCIA", "CRITICA"] as const;
export const ESTADOS_ALERTA = ["VIGENTE", "RESUELTA"] as const;
export const ESTADOS_NOTIFICACION = ["PENDIENTE", "ENVIADA", "FALLIDA"] as const;
export const CANALES = ["PLATAFORMA", "CORREO", "SMS", "WHATSAPP"] as const;
export const TIPOS_EVENTO = [
    "OPERACION_ADMINISTRATIVA",
    "ACCESO_FALLIDO",
    "ACCESO_DENEGADO",
    "ORIGEN_RECHAZADO",
    "TRAMA_RECHAZADA",
    "ERROR_INGESTA",
    "ERROR_NOTIFICACION",
] as const;

/** Condición CHECK «columna IN (valores)». Los valores son constantes del código, no entrada de usuario. */
function valoresPermitidos(columna: AnySQLiteColumn, valores: readonly string[]): SQL {
    return sql`${columna} IN (${sql.raw(valores.map((v) => `'${v}'`).join(", "))})`;
}

const id = () => integer("id").primaryKey({ autoIncrement: true });
const fecha = (nombre: string) => integer(nombre, { mode: "timestamp_ms" });
const booleano = (nombre: string) => integer(nombre, { mode: "boolean" });

export const empresas = sqliteTable(
    "empresas",
    {
        id: id(),
        nombre: text("nombre").notNull(),
        rut: text("rut").notNull(),
    },
    (t) => [uniqueIndex("empresas_rut_unico").on(t.rut)],
);

export const cuentas = sqliteTable(
    "cuentas",
    {
        id: id(),
        correo: text("correo").notNull(),
        nombre: text("nombre").notNull(),
        apellido: text("apellido").notNull(),
        telefono: text("telefono"),
        // Nulo mientras la cuenta está pendiente de activación.
        contrasenaHash: text("contrasena_hash"),
        rol: text("rol", { enum: ROLES }).notNull(),
        habilitada: booleano("habilitada").notNull().default(true),
    },
    (t) => [
        uniqueIndex("cuentas_correo_unico").on(sql`lower(${t.correo})`),
        check("cuentas_rol_valido", valoresPermitidos(t.rol, ROLES)),
    ],
);

export const clientes = sqliteTable(
    "clientes",
    {
        id: id(),
        cargo: text("cargo"),
        empresaId: integer("empresa_id").notNull().references(() => empresas.id),
        cuentaId: integer("cuenta_id").notNull().references(() => cuentas.id),
    },
    (t) => [uniqueIndex("clientes_cuenta_unica").on(t.cuentaId)],
);

export const sesiones = sqliteTable(
    "sesiones",
    {
        id: id(),
        cuentaId: integer("cuenta_id").notNull().references(() => cuentas.id),
        tokenHash: text("token_hash").notNull(),
        fechaCreacion: fecha("fecha_creacion").notNull(),
        fechaExpiracion: fecha("fecha_expiracion").notNull(),
    },
    (t) => [
        uniqueIndex("sesiones_token_hash_unico").on(t.tokenHash),
        index("sesiones_cuenta_idx").on(t.cuentaId),
    ],
);

export const tokensRecuperacion = sqliteTable(
    "tokens_recuperacion",
    {
        id: id(),
        cuentaId: integer("cuenta_id").notNull().references(() => cuentas.id),
        tokenHash: text("token_hash").notNull(),
        fechaCreacion: fecha("fecha_creacion").notNull(),
        fechaExpiracion: fecha("fecha_expiracion").notNull(),
        utilizado: booleano("utilizado").notNull().default(false),
    },
    (t) => [
        uniqueIndex("tokens_recuperacion_token_hash_unico").on(t.tokenHash),
        index("tokens_recuperacion_cuenta_idx").on(t.cuentaId),
    ],
);

export const terrenos = sqliteTable(
    "terrenos",
    {
        id: id(),
        clienteId: integer("cliente_id").notNull().references(() => clientes.id),
        nombre: text("nombre").notNull(),
        latitud: real("latitud").notNull(),
        longitud: real("longitud").notNull(),
        superficie: real("superficie"),
        // GeoJSON del polígono del predio; no se usa en la interfaz.
        dimensiones: text("dimensiones", { mode: "json" }),
        tipoCultivo: text("tipo_cultivo"),
        fechaUltimaActualizacion: fecha("fecha_ultima_actualizacion").notNull(),
    },
    (t) => [index("terrenos_cliente_idx").on(t.clienteId)],
);

export const estaciones = sqliteTable(
    "estaciones",
    {
        id: id(),
        terrenoId: integer("terreno_id").notNull().references(() => terrenos.id),
        tipo: text("tipo").notNull(),
        modelo: text("modelo").notNull(),
        numeroSerie: text("numero_serie").notNull(),
        // Si el formulario no las trae, el servidor usa las del terreno.
        latitud: real("latitud").notNull(),
        longitud: real("longitud").notNull(),
        habilitada: booleano("habilitada").notNull().default(true),
        fechaCreacion: fecha("fecha_creacion").notNull(),
        fechaUltimaActualizacion: fecha("fecha_ultima_actualizacion").notNull(),
    },
    (t) => [
        uniqueIndex("estaciones_numero_serie_unico").on(t.numeroSerie),
        index("estaciones_terreno_idx").on(t.terrenoId),
    ],
);

export const sensores = sqliteTable(
    "sensores",
    {
        id: id(),
        estacionId: integer("estacion_id").notNull().references(() => estaciones.id),
        codigo: text("codigo").notNull(),
        tipo: text("tipo").notNull(),
        modelo: text("modelo"),
        unidad: text("unidad").notNull(),
        rangoMinimo: real("rango_minimo").notNull(),
        rangoMaximo: real("rango_maximo").notNull(),
        // En segundos.
        intervaloMedicion: integer("intervalo_medicion").notNull().default(900),
        fechaCreacion: fecha("fecha_creacion").notNull(),
        fechaUltimaLectura: fecha("fecha_ultima_lectura"),
    },
    (t) => [uniqueIndex("sensores_estacion_codigo_unico").on(t.estacionId, t.codigo)],
);

// Inmutable: un trigger (migración 0001) rechaza UPDATE y DELETE.
export const mediciones = sqliteTable(
    "mediciones",
    {
        id: id(),
        sensorId: integer("sensor_id").notNull().references(() => sensores.id),
        valor: real("valor").notNull(),
        // Instante informado en la trama.
        fecha: fecha("fecha").notNull(),
        payload: text("payload", { mode: "json" }).notNull(),
        nota: text("nota"),
    },
    // Único y compuesto: sirve para las consultas por sensor y rango, y evita duplicados.
    (t) => [uniqueIndex("mediciones_sensor_fecha_unico").on(t.sensorId, t.fecha)],
);

export const criterios = sqliteTable(
    "criterios",
    {
        id: id(),
        sensorId: integer("sensor_id").notNull().references(() => sensores.id),
        severidad: text("severidad", { enum: SEVERIDADES }).notNull().default("ADVERTENCIA"),
        umbral: real("umbral").notNull(),
        condicion: text("condicion", { enum: CONDICIONES }).notNull(),
        // Lista separada por comas de CANALES; vacía si no se comunica (RF06.3).
        canales: text("canales").notNull().default(""),
        habilitado: booleano("habilitado").notNull().default(true),
        fechaCreacion: fecha("fecha_creacion").notNull(),
        fechaEliminacion: fecha("fecha_eliminacion"),
    },
    (t) => [
        index("criterios_sensor_idx").on(t.sensorId),
        check("criterios_severidad_valida", valoresPermitidos(t.severidad, SEVERIDADES)),
        check("criterios_condicion_valida", valoresPermitidos(t.condicion, CONDICIONES)),
    ],
);

export const alertas = sqliteTable(
    "alertas",
    {
        id: id(),
        medicionId: integer("medicion_id").notNull().references(() => mediciones.id),
        criterioId: integer("criterio_id").notNull().references(() => criterios.id),
        nombre: text("nombre").notNull(),
        tipo: text("tipo").notNull(),
        mensaje: text("mensaje").notNull(),
        descripcion: text("descripcion"),
        estado: text("estado", { enum: ESTADOS_ALERTA }).notNull().default("VIGENTE"),
        leida: booleano("leida").notNull().default(false),
        fecha: fecha("fecha").notNull(),
        fechaResolucion: fecha("fecha_resolucion"),
    },
    (t) => [
        // Nunca dos alertas vigentes para el mismo criterio.
        uniqueIndex("alertas_vigente_por_criterio_unica")
            .on(t.criterioId)
            .where(sql`estado = 'VIGENTE'`),
        index("alertas_criterio_idx").on(t.criterioId),
        check("alertas_estado_valido", valoresPermitidos(t.estado, ESTADOS_ALERTA)),
    ],
);

export const notificaciones = sqliteTable(
    "notificaciones",
    {
        id: id(),
        alertaId: integer("alerta_id").notNull().references(() => alertas.id),
        canal: text("canal", { enum: CANALES }).notNull(),
        estado: text("estado", { enum: ESTADOS_NOTIFICACION }).notNull().default("PENDIENTE"),
        intentos: integer("intentos").notNull().default(0),
        fechaUltimoIntento: fecha("fecha_ultimo_intento"),
        error: text("error"),
    },
    (t) => [
        index("notificaciones_alerta_idx").on(t.alertaId),
        check("notificaciones_canal_valido", valoresPermitidos(t.canal, CANALES)),
        check("notificaciones_estado_valido", valoresPermitidos(t.estado, ESTADOS_NOTIFICACION)),
    ],
);

export const eventos = sqliteTable(
    "eventos",
    {
        id: id(),
        // Responsable; nulo si lo genera el sistema.
        cuentaId: integer("cuenta_id").references(() => cuentas.id),
        tipo: text("tipo", { enum: TIPOS_EVENTO }).notNull(),
        entidad: text("entidad"),
        entidadId: integer("entidad_id"),
        motivo: text("motivo"),
        // Nunca contiene contraseñas, tokens ni API keys.
        detalle: text("detalle", { mode: "json" }),
        fecha: fecha("fecha").notNull(),
    },
    (t) => [index("eventos_tipo_fecha_idx").on(t.tipo, t.fecha)],
);
