// Números con decimales escritos por el usuario (diseno.md §9, campo Decimal).
// Coma o punto como separador decimal; sin separador de miles. La API siempre recibe números.
import { z } from "zod";

export const MENSAJE_DECIMAL = "Usa coma o punto solo para los decimales, por ejemplo -38,95";

// Signo opcional, dígitos y, a lo más, un separador seguido de dígitos. «1.234,5», «12,» o «,5» no pasan.
const PATRON = /^[+-]?\d+(?:[.,]\d+)?$/;

export type LecturaDecimal = { tipo: "vacio" } | { tipo: "numero"; valor: number } | { tipo: "invalido" };

export function leerDecimal(texto: string): LecturaDecimal {
    // Se acepta el signo menos tipográfico (−) que a veces pegan los teclados o documentos.
    const limpio = texto.trim().replace(/−/g, "-");
    if (limpio === "") return { tipo: "vacio" };
    if (!PATRON.test(limpio)) return { tipo: "invalido" };
    return { tipo: "numero", valor: Number(limpio.replace(",", ".")) };
}

/** Texto de un campo Decimal → número, o `null` si está vacío. Un texto inválido da el error de §9. */
export const textoDecimal = z.string().transform((texto, ctx): number | null => {
    const lectura = leerDecimal(texto);
    if (lectura.tipo === "invalido") {
        ctx.addIssue({ code: "custom", message: MENSAJE_DECIMAL });
        return z.NEVER;
    }
    return lectura.tipo === "numero" ? lectura.valor : null;
});

/**
 * Para los esquemas de formulario: convierte el texto y luego valida con el esquema numérico de la API
 * (rango, obligatorio u opcional). Así el navegador y el servidor aplican las mismas reglas.
 */
export function desdeTexto<T extends z.ZodType<unknown, number | null>>(esquemaNumero: T) {
    return textoDecimal.pipe(esquemaNumero);
}
