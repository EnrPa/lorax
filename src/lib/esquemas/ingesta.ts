// Trama de ingesta (RF03, diseno.md §6). La comparten el endpoint y el emulador.
import { z } from "zod";

export const MAX_LECTURAS = 20;
/** Una trama puede venir hasta 5 min «en el futuro», por desfase de reloj de la estación. */
export const TOLERANCIA_FUTURO_MS = 5 * 60_000;

const lectura = z.object({
    codigo: z
        .string({ error: "Indica el código del sensor." })
        .trim()
        .min(1, "Indica el código del sensor.")
        .max(50, "El código del sensor no puede tener más de 50 caracteres."),
    valor: z.number({ error: "El valor de la lectura debe ser un número." }),
});

/** Esquema de la trama; `ahora` fija el límite de fechas futuras. */
export function esquemaTrama(ahora: Date) {
    return z.object({
        numero_serie: z
            .string({ error: "Indica el número de serie de la estación." })
            .trim()
            .min(1, "Indica el número de serie de la estación.")
            .max(255, "El número de serie no puede tener más de 255 caracteres."),
        fecha: z.iso
            .datetime({ offset: true, error: "La fecha debe estar en formato ISO 8601, por ejemplo 2026-10-05T14:15:00Z." })
            .transform((v) => new Date(v))
            .refine((f) => f.getTime() <= ahora.getTime() + TOLERANCIA_FUTURO_MS, "La fecha está más de 5 minutos en el futuro."),
        lecturas: z
            .array(lectura, { error: "Incluye la lista de lecturas." })
            .min(1, "Incluye al menos una lectura.")
            .max(MAX_LECTURAS, `Una trama admite como máximo ${MAX_LECTURAS} lecturas.`)
            .superRefine((lecturas, ctx) => {
                const vistos = new Set<string>();
                lecturas.forEach((l, i) => {
                    if (vistos.has(l.codigo)) {
                        ctx.addIssue({ code: "custom", path: [i, "codigo"], message: `El código «${l.codigo}» está repetido en la trama.` });
                    }
                    vistos.add(l.codigo);
                });
            }),
        meta: z.record(z.string(), z.unknown()).optional(),
    });
}

export type Trama = z.output<ReturnType<typeof esquemaTrama>>;

/** Respuesta 200 de la ingesta. */
export interface RespuestaIngesta {
    aceptadas: number;
    /** Lecturas que ya estaban guardadas (mismo sensor y fecha): se omiten. */
    duplicadas: number;
}
