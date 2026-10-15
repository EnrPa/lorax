// Recuperación de contraseña y definición de la primera contraseña (RF01.5, diseno.md §8.4).
import { eq, sql } from "drizzle-orm";
import { noProcesable } from "~/server/api/errores";
import { hashContrasena } from "~/server/auth/contrasenas";
import { consumirEnlace, crearEnlace, VIGENCIA_HORAS } from "~/server/auth/enlaces";
import { revocarSesionesDeCuenta } from "~/server/auth/sesiones";
import { appUrl } from "~/server/config";
import { enviarCorreo } from "~/server/correo/correo";
import type { BaseDatos } from "~/server/db/cliente";
import { cuentas } from "~/server/db/esquema";

export const MENSAJE_ENLACE_INVALIDO =
    "El enlace no es válido o ya venció. Pide uno nuevo desde «¿Olvidaste tu contraseña?» en la página de inicio de sesión.";

export const enlaceRestablecer = (token: string) => `${appUrl()}/restablecer?token=${encodeURIComponent(token)}`;

/**
 * Si la cuenta existe y está habilitada, le envía un enlace de recuperación. Quien llama responde
 * siempre lo mismo, así que desde fuera no se distingue si el correo existe.
 */
export async function solicitarRecuperacion(bd: BaseDatos, correo: string, ahora = new Date()): Promise<void> {
    const cuenta = bd
        .select({ id: cuentas.id, nombre: cuentas.nombre, correo: cuentas.correo, habilitada: cuentas.habilitada })
        .from(cuentas)
        .where(eq(sql`lower(${cuentas.correo})`, correo.toLowerCase()))
        .get();
    if (!cuenta || !cuenta.habilitada) return;

    const token = crearEnlace(bd, cuenta.id, "RECUPERACION", ahora);
    await enviarCorreo(
        {
            para: cuenta.correo,
            asunto: "Crea una nueva contraseña para LoRax",
            texto: [
                `Hola, ${cuenta.nombre}:`,
                "",
                "Recibimos una solicitud para cambiar la contraseña de tu cuenta en LoRax.",
                "Para crear una nueva, abre este enlace:",
                "",
                enlaceRestablecer(token),
                "",
                `El enlace sirve una sola vez y vence en ${VIGENCIA_HORAS.RECUPERACION} hora.`,
                "Si no pediste este cambio, ignora este correo: tu contraseña actual sigue funcionando.",
            ].join("\n"),
        },
        ahora,
    );
}

/**
 * Consume el enlace, guarda la contraseña nueva y revoca todas las sesiones de la cuenta, en una sola
 * transacción. No inicia sesión: la interfaz lleva a /login con un aviso.
 */
export async function restablecerContrasena(bd: BaseDatos, token: string, contrasena: string, ahora = new Date()): Promise<void> {
    // scrypt es asíncrono y lento: se calcula antes de abrir la transacción.
    const hash = await hashContrasena(contrasena);

    const valido = bd.transaction((tx) => {
        const cuentaId = consumirEnlace(tx, token, ahora);
        if (cuentaId === null) return false;
        tx.update(cuentas).set({ contrasenaHash: hash }).where(eq(cuentas.id, cuentaId)).run();
        revocarSesionesDeCuenta(tx, cuentaId);
        return true;
    });
    if (!valido) throw noProcesable(MENSAJE_ENLACE_INVALIDO);
}
