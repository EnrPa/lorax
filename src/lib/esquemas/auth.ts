// Esquemas de autenticación. Compartidos: los usan el formulario de inicio de sesión y la API.
import { z } from "zod";

const correo = z
    .string({ error: "Escribe tu correo." })
    .trim()
    .min(1, "Escribe tu correo.")
    .pipe(z.email("Escribe un correo válido, por ejemplo nombre@correo.cl."));

/** Contraseña nueva: entre 12 y 128 caracteres (diseno.md §8.4). */
export const contrasenaNueva = z
    .string({ error: "Escribe una contraseña." })
    .min(12, "La contraseña debe tener al menos 12 caracteres.")
    .max(128, "La contraseña no puede tener más de 128 caracteres.");

export const esquemaLogin = z.object({
    correo,
    contrasena: z
        .string({ error: "Escribe tu contraseña." })
        .min(1, "Escribe tu contraseña.")
        .max(128, "La contraseña no puede tener más de 128 caracteres."),
    recordar: z.boolean().default(false),
});

export type DatosLogin = z.input<typeof esquemaLogin>;

export const esquemaRecuperar = z.object({ correo });

/** Lo que recibe POST /auth/restablecer. */
export const esquemaRestablecer = z.object({
    token: z.string({ error: "Falta el enlace." }).min(1, "Falta el enlace."),
    contrasena: contrasenaNueva,
});

/** Formulario de /restablecer: la confirmación solo se revisa en el navegador. */
export const esquemaFormularioContrasena = z
    .object({ contrasena: contrasenaNueva, confirmacion: z.string() })
    .refine((d) => d.contrasena === d.confirmacion, {
        path: ["confirmacion"],
        message: "Las contraseñas no coinciden. Escríbela de nuevo.",
    });

/** Mensaje único de /auth/recuperar: no revela si el correo existe (RF01.5). */
export const MENSAJE_RECUPERACION =
    "Si el correo está registrado, te enviamos un enlace para crear una nueva contraseña. Revisa tu bandeja de entrada; el enlace vence en 1 hora.";

/** Aviso de /login después de restablecer o activar (diseno.md §8.4). */
export const AVISO_CONTRASENA_ACTUALIZADA = "Tu contraseña se actualizó. Inicia sesión con ella.";
