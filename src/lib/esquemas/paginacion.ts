// Paginación de listas (diseno.md §7): `?pagina&tamano`, 20 por defecto.
import { z } from "zod";

export const esquemaPaginacion = z.object({
    pagina: z.coerce.number().int().min(1, "La página debe ser 1 o mayor.").default(1),
    tamano: z.coerce.number().int().min(1).max(100, "El tamaño máximo de página es 100.").default(20),
});

export interface Pagina<T> {
    items: T[];
    total: number;
    pagina: number;
    tamano: number;
}
