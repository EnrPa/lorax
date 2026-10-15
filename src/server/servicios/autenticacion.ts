// Inicio de sesión (RF01, diseno.md §8.4). Solo servidor.
import { eq, sql } from "drizzle-orm";
import { demasiadosIntentos, ErrorApi } from "~/server/api/errores";
import { verificarContrasena } from "~/server/auth/contrasenas";
import { bloqueoDe, mensajeBloqueo, registrarFallo } from "~/server/auth/intentos";
import { crearSesion, type CuentaSesion } from "~/server/auth/sesiones";
import type { BaseDatos } from "~/server/db/cliente";
import { cuentas } from "~/server/db/esquema";

/** Mismo mensaje para correo inexistente, contraseña incorrecta o cuenta pendiente de activación (RF01.3). */
export const MENSAJE_CREDENCIALES_INVALIDAS = "El correo o la contraseña no son correctos. Revísalos e intenta de nuevo.";
export const MENSAJE_CUENTA_NO_DISPONIBLE = "Tu cuenta no está disponible. Comunícate con el administrador de la plataforma.";

export interface ResultadoLogin {
    cuenta: CuentaSesion;
    token: string;
    expira: Date;
}

export async function iniciarSesion(
    bd: BaseDatos,
    datos: { correo: string; contrasena: string; recordar: boolean },
    ahora = new Date(),
): Promise<ResultadoLogin> {
    const correo = datos.correo.toLowerCase();

    // RF01.9: con el correo bloqueado no se revisa la contraseña. Responde igual exista o no la cuenta.
    const bloqueo = bloqueoDe(bd, correo, ahora);
    if (bloqueo) {
        registrarFallo(bd, correo, "INTENTOS_EXCEDIDOS", ahora);
        const restante = bloqueo.getTime() - ahora.getTime();
        throw demasiadosIntentos(mensajeBloqueo(Math.ceil(restante / 60_000)), Math.ceil(restante / 1000));
    }

    const cuenta = bd
        .select()
        .from(cuentas)
        .where(eq(sql`lower(${cuentas.correo})`, correo))
        .get();

    // Siempre se calcula scrypt, exista o no la cuenta, para no revelarlo por el tiempo de respuesta.
    const contrasenaCorrecta = await verificarContrasena(datos.contrasena, cuenta?.contrasenaHash);
    if (!cuenta || !contrasenaCorrecta) {
        registrarFallo(bd, correo, "CREDENCIALES_INVALIDAS", ahora);
        throw new ErrorApi("NO_AUTENTICADO", MENSAJE_CREDENCIALES_INVALIDAS);
    }
    // Solo quien conoce la contraseña se entera de que la cuenta está deshabilitada (RF01.4).
    if (!cuenta.habilitada) {
        registrarFallo(bd, correo, "CUENTA_DESHABILITADA", ahora);
        throw new ErrorApi("PROHIBIDO", MENSAJE_CUENTA_NO_DISPONIBLE);
    }

    const { token, expira } = await crearSesion(bd, cuenta, datos.recordar, ahora);
    const { id, nombre, apellido, rol } = cuenta;
    return { cuenta: { id, nombre, apellido, correo: cuenta.correo, rol }, token, expira };
}
