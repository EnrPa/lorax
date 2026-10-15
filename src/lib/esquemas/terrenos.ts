// Terrenos, estaciones y sensores (RF02, diseno.md §4 y §7). Compartido por la pantalla y la API.
import { z } from "zod";
import { desdeTexto } from "~/lib/decimal";
import { VARIABLES } from "~/lib/variables";

const texto = (obligatorio: string, maximo: number, nombre: string) =>
    z
        .string({ error: obligatorio })
        .trim()
        .min(1, obligatorio)
        .max(maximo, `${nombre} no puede tener más de ${maximo} caracteres.`);

const latitud = z
    .number({ error: "Escribe la latitud, por ejemplo -38,95." })
    .min(-90, "La latitud debe estar entre -90 y 90.")
    .max(90, "La latitud debe estar entre -90 y 90.");

const longitud = z
    .number({ error: "Escribe la longitud, por ejemplo -72,62." })
    .min(-180, "La longitud debe estar entre -180 y 180.")
    .max(180, "La longitud debe estar entre -180 y 180.");

const superficie = z.number().positive("La superficie debe ser mayor que 0 hectáreas.").nullable();

const tipoCultivo = z
    .string()
    .trim()
    .max(256, "El tipo de cultivo no puede tener más de 256 caracteres.")
    .nullable()
    .transform((v) => v || null);

const TIPOS_SENSOR = VARIABLES.map((v) => v.tipo) as [string, ...string[]];

/** Tipos de sensor del catálogo (§5); al menos uno, sin repetidos (RF02.3). */
const sensores = z
    .array(z.enum(TIPOS_SENSOR, { error: "Elige sensores de la lista." }), { error: "Marca al menos un sensor." })
    .min(1, "Marca al menos un sensor.")
    .transform((tipos) => [...new Set(tipos)]);

/** Latitud y longitud de la estación: las dos o ninguna (si falta, se usa la del terreno). */
function ambasONinguna(d: { latitud?: number | null; longitud?: number | null }) {
    return (d.latitud == null) === (d.longitud == null);
}
const MENSAJE_AMBAS = "Escribe la latitud y la longitud de la estación, o deja las dos vacías para usar las del terreno.";

// ——— API: recibe números ———

export const esquemaTerreno = z.object({
    nombre: texto("Escribe el nombre del terreno.", 100, "El nombre"),
    latitud,
    longitud,
    superficie: superficie.optional().default(null),
    tipoCultivo: tipoCultivo.optional().default(null),
});

export const esquemaEstacion = z
    .object({
        tipo: texto("Escribe el tipo de estación.", 255, "El tipo"),
        modelo: texto("Escribe el modelo de la estación.", 255, "El modelo"),
        numeroSerie: texto("Escribe el número de serie de la estación.", 255, "El número de serie"),
        latitud: latitud.nullable().optional().default(null),
        longitud: longitud.nullable().optional().default(null),
        sensores,
    })
    .refine(ambasONinguna, { path: ["longitud"], message: MENSAJE_AMBAS });

/** POST /terrenos: terreno + primera estación, en una transacción (RF02.4). */
export const esquemaCrearTerreno = z.object({ terreno: esquemaTerreno, estacion: esquemaEstacion });

export type DatosTerreno = z.output<typeof esquemaTerreno>;
export type DatosEstacion = z.output<typeof esquemaEstacion>;

// ——— Formularios: reciben el texto de los campos Decimal (§9) y validan con las mismas reglas ———

export const esquemaFormularioTerreno = z.object({
    nombre: esquemaTerreno.shape.nombre,
    latitud: desdeTexto(latitud),
    longitud: desdeTexto(longitud),
    superficie: desdeTexto(superficie),
    tipoCultivo,
});

export const esquemaFormularioEstacion = z
    .object({
        tipo: texto("Escribe el tipo de estación.", 255, "El tipo"),
        modelo: texto("Escribe el modelo de la estación.", 255, "El modelo"),
        numeroSerie: texto("Escribe el número de serie de la estación.", 255, "El número de serie"),
        latitud: desdeTexto(latitud.nullable()),
        longitud: desdeTexto(longitud.nullable()),
        sensores,
    })
    .refine(ambasONinguna, { path: ["longitud"], message: MENSAJE_AMBAS });

// ——— Respuestas de la API ———

export interface SensorDetalle {
    id: number;
    codigo: string;
    tipo: string;
    unidad: string;
    rangoMinimo: number;
    rangoMaximo: number;
}

export interface EstacionDetalle {
    id: number;
    tipo: string;
    modelo: string;
    numeroSerie: string;
    latitud: number;
    longitud: number;
    habilitada: boolean;
    sensores: SensorDetalle[];
}

export interface TerrenoDetalle {
    id: number;
    nombre: string;
    latitud: number;
    longitud: number;
    superficie: number | null;
    tipoCultivo: string | null;
    estaciones: EstacionDetalle[];
}
