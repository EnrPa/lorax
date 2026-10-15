// Tipos de la sesión. Compartidos por cliente y servidor.

export type Rol = "ADMINISTRADOR" | "PRODUCTOR";

/** Lo que devuelve GET /api/v1/auth/sesion. */
export interface CuentaSesion {
    id: number;
    nombre: string;
    apellido: string;
    correo: string;
    rol: Rol;
}
