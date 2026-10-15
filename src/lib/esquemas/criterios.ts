// Criterios (umbrales) y lista de alertas (RF06, diseno.md §7). Compartido por la pantalla y la API.
import { z } from "zod";
import { desdeTexto } from "~/lib/decimal";
import { esquemaPaginacion } from "./paginacion";

export const CANALES = ["PLATAFORMA", "CORREO", "SMS", "WHATSAPP"] as const;
export type Canal = (typeof CANALES)[number];

export const ETIQUETA_CANAL: Record<Canal, string> = {
    PLATAFORMA: "En la plataforma",
    CORREO: "Correo",
    SMS: "SMS",
    WHATSAPP: "WhatsApp",
};

export const CONDICIONES = ["SUPERA", "DESCIENDE"] as const;
export type Condicion = (typeof CONDICIONES)[number];
export const ETIQUETA_CONDICION: Record<Condicion, string> = { SUPERA: "Supera", DESCIENDE: "Desciende bajo" };

/** RF06.3: sin canales la alerta queda registrada, pero no se comunica. Se puede guardar igual. */
export const AVISO_SIN_CANALES = "La alerta quedará registrada en la plataforma, pero no se te comunicará por ningún medio.";

/** §8.5: sin teléfono, los avisos por SMS o WhatsApp fallan. Se advierte, pero se puede guardar igual. */
export const AVISO_SIN_TELEFONO = "Agrega tu teléfono en Ajustes para recibir avisos por SMS o WhatsApp";

const umbral = z.number({ error: "Escribe el umbral como número, por ejemplo 25." });
const condicion = z.enum(CONDICIONES, { error: "Elige «Supera» o «Desciende bajo»." });
const canales = z
    .array(z.enum(CANALES, { error: "Elige canales de la lista." }), { error: "Elige canales de la lista." })
    .transform((lista) => [...new Set(lista)]);
const sensorId = z.number({ error: "Elige el sensor." }).int().positive("Elige el sensor.");

/** POST /criterios. El rango admisible del sensor lo valida el servidor (RF06.2). */
export const esquemaCriterio = z.object({ sensorId, umbral, condicion, canales: canales.optional().default([]) });

/** Formulario «Nuevo umbral»: el umbral llega como texto del campo Decimal (§9). */
export const esquemaFormularioCriterio = z.object({
    sensorId: z.coerce.number({ error: "Elige el sensor." }).int().positive("Elige el sensor."),
    umbral: desdeTexto(umbral),
    condicion,
    canales,
});

/** PATCH /criterios/:id */
export const esquemaHabilitacion = z.object({
    habilitado: z.boolean({ error: "Indica si el umbral queda habilitado o deshabilitado." }),
});

export const esquemaListaCriterios = esquemaPaginacion.extend({
    terrenoId: z.coerce.number().int().positive().optional(),
});

/** GET /alertas?terrenoId&estado&noLeidas */
export const esquemaListaAlertas = esquemaPaginacion.extend({
    terrenoId: z.coerce.number().int().positive().optional(),
    estado: z.enum(["VIGENTE", "RESUELTA"], { error: "El estado debe ser VIGENTE o RESUELTA." }).optional(),
    noLeidas: z
        .enum(["true", "false"])
        .optional()
        .transform((v) => v === "true"),
});

export interface CriterioDetalle {
    id: number;
    sensorId: number;
    terreno: { id: number; nombre: string };
    numeroSerie: string;
    tipo: string;
    etiqueta: string;
    unidad: string;
    umbral: number;
    condicion: Condicion;
    severidad: string;
    canales: Canal[];
    habilitado: boolean;
    fechaCreacion: string;
}

export interface LecturasRecientes {
    sensorId: number;
    etiqueta: string;
    unidad: string;
    rangoMinimo: number;
    rangoMaximo: number;
    /** Las 5 más recientes, de la más nueva a la más antigua. */
    lecturas: Array<{ fecha: string; valor: number }>;
}

/** «Debe estar entre 0 y 100 %.» (RF06.2, ejemplo de diseno.md §7). */
export function mensajeFueraDeRango(min: number, max: number, unidad: string): string {
    const n = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 });
    return `Debe estar entre ${n.format(min)} y ${n.format(max)} ${unidad}.`;
}
