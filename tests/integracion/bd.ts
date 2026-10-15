// Utilidades para pruebas de integración: base SQLite en memoria, nueva por archivo (diseno.md §12).
import { hashContrasena } from "~/server/auth/contrasenas";
import type { Rol } from "~/server/auth/jwt";
import { crearConexion, type BaseDatos } from "~/server/db/cliente";
import { cuentas } from "~/server/db/esquema";
import { aplicarMigraciones } from "~/server/db/migrar";

export function crearBdPrueba(): BaseDatos {
    const bd = crearConexion(":memory:");
    aplicarMigraciones(bd);
    return bd;
}

/** Hace que `obtenerBd()` (lo que usan los endpoints) devuelva esta base. */
export function usarComoBdGlobal(bd: BaseDatos) {
    (globalThis as { __loraxBd?: BaseDatos }).__loraxBd = bd;
}

export const CONTRASENA_PRUEBA = "ContrasenaDePrueba2026";

/** Crea una cuenta. `contrasena: null` la deja pendiente de activación. */
export async function crearCuenta(
    bd: BaseDatos,
    datos: { correo: string; rol?: Rol; habilitada?: boolean; contrasena?: string | null },
) {
    const contrasena = datos.contrasena === undefined ? CONTRASENA_PRUEBA : datos.contrasena;
    return bd
        .insert(cuentas)
        .values({
            correo: datos.correo,
            nombre: "Nombre",
            apellido: "Apellido",
            rol: datos.rol ?? "PRODUCTOR",
            habilitada: datos.habilitada ?? true,
            contrasenaHash: contrasena === null ? null : await hashContrasena(contrasena),
        })
        .returning()
        .get();
}

/** Ejecuta `fn`, exige que falle y devuelve el mensaje de SQLite (Drizzle lo envuelve en `cause`). */
export function errorSqlite(fn: () => unknown): string {
    try {
        fn();
    } catch (e) {
        const causa = (e as { cause?: unknown }).cause;
        return causa instanceof Error ? causa.message : (e as Error).message;
    }
    throw new Error("Se esperaba que la operación fallara");
}
