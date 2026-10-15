// Administración (RF07, diseno.md §7). Compartido por la pantalla y la API.
import { z } from "zod";
import { esRutValido, normalizarRut } from "~/lib/rut";
import type { CriterioDetalle } from "./criterios";
import type { TerrenoDetalle } from "./terrenos";
import { telefono } from "./cuenta";
import { esquemaPaginacion } from "./paginacion";

export const MENSAJE_RUT_INVALIDO = "El RUT no es válido. Revisa el dígito verificador, por ejemplo 12.345.678-5.";
export const MENSAJE_RUT_REPETIDO = "Ya existe una empresa con ese RUT. Elígela de la lista de empresas existentes";
export const MENSAJE_CORREO_REPETIDO = "Ya existe una cuenta con ese correo. Usa otro correo o busca la cuenta existente.";
export const MENSAJE_AVISO_CAMBIO_CORREO = "El correo de tu cuenta LoRax fue cambiado por el administrador. Si no lo solicitaste, contáctalo.";

const texto = (obligatorio: string, maximo: number, nombre: string) =>
    z.string({ error: obligatorio }).trim().min(1, obligatorio).max(maximo, `${nombre} no puede tener más de ${maximo} caracteres.`);

/** Correo normalizado a minúsculas (diseno.md §7). */
const correo = z
    .string({ error: "Escribe el correo." })
    .trim()
    .min(1, "Escribe el correo.")
    .pipe(z.email("Escribe un correo válido, por ejemplo nombre@correo.cl."))
    .transform((v) => v.toLowerCase());

const cargo = z
    .string()
    .trim()
    .max(50, "El cargo no puede tener más de 50 caracteres.")
    .nullable()
    .optional()
    .transform((v) => v || null);

/** Motivo de una operación sensible (RF07.8). */
export const motivo = z
    .string({ error: "Escribe el motivo de esta acción." })
    .trim()
    .min(1, "Escribe el motivo de esta acción.")
    .max(500, "El motivo no puede tener más de 500 caracteres.");

const motivoOpcional = z.string().trim().max(500, "El motivo no puede tener más de 500 caracteres.").optional();

/** POST /admin/cuentas: empresa existente (`id`) o nueva (`nombre` y `rut`). */
export const esquemaCrearProductor = z.object({
    nombre: texto("Escribe el nombre.", 255, "El nombre"),
    apellido: texto("Escribe el apellido.", 255, "El apellido"),
    correo,
    telefono: telefono.optional().default(null),
    cargo,
    // Validación explícita (no z.union) para que cada error llegue a su campo: «empresa.rut», «empresa.nombre».
    empresa: z
        .object(
            {
                id: z.number().int().positive().optional(),
                nombre: z.string().trim().max(50, "El nombre de la empresa no puede tener más de 50 caracteres.").optional(),
                rut: z.string().trim().optional(),
            },
            { error: "Elige una empresa existente o escribe el nombre y el RUT de una nueva." },
        )
        .transform((e, ctx): { id: number } | { nombre: string; rut: string } => {
            if (e.id !== undefined) return { id: e.id };
            const normalizado = normalizarRut(e.rut ?? "");
            if (!e.nombre) ctx.addIssue({ code: "custom", path: ["nombre"], message: "Escribe el nombre de la empresa." });
            if (!e.rut) ctx.addIssue({ code: "custom", path: ["rut"], message: "Escribe el RUT de la empresa." });
            else if (!esRutValido(normalizado)) ctx.addIssue({ code: "custom", path: ["rut"], message: MENSAJE_RUT_INVALIDO });
            if (!e.nombre || !e.rut || !esRutValido(normalizado)) return z.NEVER;
            return { nombre: e.nombre, rut: normalizado };
        }),
    motivo: motivoOpcional,
});

/** PATCH /admin/cuentas/:id: datos generales (§7). La empresa no se cambia. */
export const esquemaActualizarCuenta = z.object({
    nombre: texto("Escribe el nombre.", 255, "El nombre"),
    apellido: texto("Escribe el apellido.", 255, "El apellido"),
    correo,
    telefono,
    cargo,
    motivo: motivoOpcional,
});

/** POST /admin/cuentas/:id/habilitacion: el motivo es obligatorio al deshabilitar (RF07.8). */
export const esquemaHabilitacionCuenta = z
    .object({ habilitada: z.boolean({ error: "Indica si la cuenta queda habilitada o deshabilitada." }), motivo: motivoOpcional })
    .refine((d) => d.habilitada || (d.motivo ?? "").length > 0, { path: ["motivo"], message: "Escribe el motivo de esta acción." });

export const esquemaMotivo = z.object({ motivo });
export const esquemaReenviar = z.object({ motivo: motivoOpcional });

export const esquemaListaCuentas = esquemaPaginacion.extend({
    q: z.string().trim().max(100).optional(),
    habilitada: z
        .enum(["true", "false"], { error: "El filtro de estado debe ser true o false." })
        .optional()
        .transform((v) => (v === undefined ? undefined : v === "true")),
});

export const TIPOS_EVENTO = [
    "OPERACION_ADMINISTRATIVA",
    "ACCESO_FALLIDO",
    "ACCESO_DENEGADO",
    "ORIGEN_RECHAZADO",
    "TRAMA_RECHAZADA",
    "ERROR_INGESTA",
    "ERROR_NOTIFICACION",
] as const;

export const esquemaListaEventos = esquemaPaginacion.extend({
    tipo: z.enum(TIPOS_EVENTO, { error: "Elige un tipo de evento de la lista." }).optional(),
    desde: z.iso.datetime({ offset: true, error: "La fecha inicial no es válida." }).transform((v) => new Date(v)).optional(),
    hasta: z.iso.datetime({ offset: true, error: "La fecha final no es válida." }).transform((v) => new Date(v)).optional(),
});

// ——— Respuestas ———

export interface CuentaAdmin {
    id: number;
    nombre: string;
    apellido: string;
    correo: string;
    telefono: string | null;
    habilitada: boolean;
    pendienteActivacion: boolean;
    cargo: string | null;
    empresa: { id: number; nombre: string; rut: string } | null;
}

export interface EventoAdmin {
    id: number;
    tipo: (typeof TIPOS_EVENTO)[number];
    fecha: string;
    responsable: { id: number; nombre: string; apellido: string; correo: string } | null;
    entidad: string | null;
    entidadId: number | null;
    motivo: string | null;
    detalle: unknown;
}

/** GET /admin/cuentas/:id: terrenos, estaciones y criterios. Sin mediciones (RF07.5). */
export interface DetalleCuentaAdmin extends CuentaAdmin {
    terrenos: TerrenoDetalle[];
    criterios: CriterioDetalle[];
}

export const ETIQUETA_TIPO_EVENTO: Record<(typeof TIPOS_EVENTO)[number], string> = {
    OPERACION_ADMINISTRATIVA: "Operación administrativa",
    ACCESO_FALLIDO: "Acceso fallido",
    ACCESO_DENEGADO: "Acceso denegado",
    ORIGEN_RECHAZADO: "Origen rechazado",
    TRAMA_RECHAZADA: "Trama rechazada",
    ERROR_INGESTA: "Error de ingesta",
    ERROR_NOTIFICACION: "Error de notificación",
};

/** Causas de los eventos, en palabras simples (diseno.md §9: sin jerga técnica). */
export const ETIQUETA_CAUSA: Record<string, string> = {
    CREDENCIALES_INVALIDAS: "Correo o contraseña incorrectos",
    CUENTA_DESHABILITADA: "La cuenta está deshabilitada",
    INTENTOS_EXCEDIDOS: "Bloqueado por demasiados intentos",
    CREDENCIAL_INVALIDA: "Llave de acceso de la ingesta inválida",
    ESTACION_DESCONOCIDA: "Estación no registrada",
    ESTACION_DESHABILITADA: "Estación deshabilitada",
    SENSOR_DESCONOCIDO: "Sensor no registrado en la estación",
    VALOR_FUERA_DE_RANGO: "Valor fuera del rango del sensor",
    ESTRUCTURA_INVALIDA: "Trama con formato incorrecto",
    ERROR_ALMACENAMIENTO: "No se pudo guardar la trama",
    SIN_TELEFONO: "La cuenta no tiene teléfono registrado",
    ENVIO_FALLIDO: "No se pudo enviar el aviso",
};

/** Etiqueta de una causa; si no está en la lista, «CODIGO_NUEVO» → «Codigo nuevo». */
export function textoCausa(codigo: string): string {
    if (ETIQUETA_CAUSA[codigo]) return ETIQUETA_CAUSA[codigo];
    const texto = codigo.replace(/_/g, " ").toLowerCase();
    return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export const ETIQUETA_ACCION: Record<string, string> = {
    CREAR_CUENTA: "Registró una cuenta",
    ACTUALIZAR_CUENTA: "Actualizó los datos de una cuenta",
    HABILITAR_CUENTA: "Habilitó una cuenta",
    DESHABILITAR_CUENTA: "Deshabilitó una cuenta",
    REENVIAR_ACTIVACION: "Reenvió el enlace de activación",
    DESHABILITAR_ESTACION: "Deshabilitó una estación",
    ELIMINAR_CRITERIO: "Eliminó un umbral",
};
