// Formato de valores para la interfaz y los mensajes (español de Chile).

const numero = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 });

/** 18.25, "%" → "18,3 %". Los valores siempre se muestran con su unidad. */
export function formatearValor(valor: number, unidad: string): string {
    return `${numero.format(valor)} ${unidad}`;
}
