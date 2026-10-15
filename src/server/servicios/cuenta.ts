// Perfil de la cuenta de la sesión y cambio de contraseña (diseno.md §7). Solo servidor.
import { eq } from "drizzle-orm";
import type { Perfil } from "~/lib/esquemas/cuenta";
import { noEncontrado, validacion } from "~/server/api/errores";
import { hashContrasena, verificarContrasena } from "~/server/auth/contrasenas";
import type { BaseDatos } from "~/server/db/cliente";
import { clientes, cuentas, empresas } from "~/server/db/esquema";

export function obtenerPerfil(bd: BaseDatos, cuentaId: number): Perfil {
    const fila = bd
        .select({
            nombre: cuentas.nombre,
            apellido: cuentas.apellido,
            correo: cuentas.correo,
            telefono: cuentas.telefono,
            rol: cuentas.rol,
            cargo: clientes.cargo,
            empresaNombre: empresas.nombre,
            empresaRut: empresas.rut,
        })
        .from(cuentas)
        // Las cuentas de administrador no tienen cliente ni empresa.
        .leftJoin(clientes, eq(clientes.cuentaId, cuentas.id))
        .leftJoin(empresas, eq(empresas.id, clientes.empresaId))
        .where(eq(cuentas.id, cuentaId))
        .get();
    if (!fila) throw noEncontrado();

    const { empresaNombre, empresaRut, ...perfil } = fila;
    return {
        ...perfil,
        empresa: empresaNombre && empresaRut ? { nombre: empresaNombre, rut: empresaRut } : null,
        cargo: perfil.cargo ?? null,
    };
}

export function actualizarPerfil(
    bd: BaseDatos,
    cuentaId: number,
    datos: { nombre: string; apellido: string; telefono: string | null },
): Perfil {
    bd.update(cuentas)
        .set({ nombre: datos.nombre, apellido: datos.apellido, telefono: datos.telefono })
        .where(eq(cuentas.id, cuentaId))
        .run();
    return obtenerPerfil(bd, cuentaId);
}

export async function cambiarContrasena(bd: BaseDatos, cuentaId: number, actual: string, nueva: string): Promise<void> {
    const cuenta = bd.select({ hash: cuentas.contrasenaHash }).from(cuentas).where(eq(cuentas.id, cuentaId)).get();
    if (!cuenta) throw noEncontrado();
    if (!(await verificarContrasena(actual, cuenta.hash))) {
        throw validacion({ actual: "La contraseña actual no es correcta. Revísala e intenta de nuevo." });
    }
    const hash = await hashContrasena(nueva);
    bd.update(cuentas).set({ contrasenaHash: hash }).where(eq(cuentas.id, cuentaId)).run();
}
