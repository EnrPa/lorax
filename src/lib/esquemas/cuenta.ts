// Esquemas del perfil y del cambio de contraseña. Compartidos por la pantalla de Ajustes y la API.
import { z } from "zod";
import { contrasenaNueva } from "./auth";

const MENSAJE_TELEFONO = "Escribe el teléfono con el código de país, por ejemplo +56912345678.";
const E164 = /^\+[1-9]\d{7,14}$/;

/** Teléfono en formato E.164 (diseno.md §4). Se aceptan espacios y guiones al escribirlo; vacío es nulo. */
export const telefono = z
    .string({ error: MENSAJE_TELEFONO })
    .nullable()
    .transform((v) => (v ?? "").replace(/[\s-]/g, ""))
    .refine((v) => v === "" || E164.test(v), MENSAJE_TELEFONO)
    .transform((v) => (v === "" ? null : v));

/** Lo único que la cuenta puede editar de su perfil (diseno.md §7). Otros campos se descartan. */
export const esquemaPerfil = z.object({
    nombre: z
        .string({ error: "Escribe tu nombre." })
        .trim()
        .min(1, "Escribe tu nombre.")
        .max(255, "El nombre no puede tener más de 255 caracteres."),
    apellido: z
        .string({ error: "Escribe tu apellido." })
        .trim()
        .min(1, "Escribe tu apellido.")
        .max(255, "El apellido no puede tener más de 255 caracteres."),
    telefono,
});

export type DatosPerfil = z.input<typeof esquemaPerfil>;

/** Lo que recibe POST /cuenta/contrasena. */
export const esquemaCambioContrasena = z.object({
    actual: z.string({ error: "Escribe tu contraseña actual." }).min(1, "Escribe tu contraseña actual."),
    nueva: contrasenaNueva,
});

/** Formulario de la pestaña Seguridad: la confirmación solo se revisa en el navegador. */
export const esquemaFormularioCambioContrasena = esquemaCambioContrasena
    .extend({ confirmacion: z.string() })
    .refine((d) => d.nueva === d.confirmacion, {
        path: ["confirmacion"],
        message: "Las contraseñas no coinciden. Escríbela de nuevo.",
    });

/** Lo que devuelve GET /cuenta. Empresa y cargo solo existen para el productor. */
export interface Perfil {
    nombre: string;
    apellido: string;
    correo: string;
    telefono: string | null;
    rol: "ADMINISTRADOR" | "PRODUCTOR";
    empresa: { nombre: string; rut: string } | null;
    cargo: string | null;
}
