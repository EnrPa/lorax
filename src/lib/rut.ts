// RUT chileno: cuerpo numérico y dígito verificador calculado con módulo 11.

/** Quita puntos, guion y espacios, y pasa la K a mayúscula: "76.123.456-0" → "761234560". */
export function limpiarRut(rut: string): string {
    return rut.replace(/[.\-\s]/g, "").toUpperCase();
}

export function calcularDigitoVerificador(cuerpo: string): string {
    let suma = 0;
    let multiplicador = 2;
    for (const digito of cuerpo.split("").reverse()) {
        suma += Number(digito) * multiplicador;
        multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
    }
    const resto = 11 - (suma % 11);
    if (resto === 11) return "0";
    if (resto === 10) return "K";
    return String(resto);
}

export function esRutValido(rut: string): boolean {
    const limpio = limpiarRut(rut);
    const coincide = /^(\d{7,8})([\dK])$/.exec(limpio);
    if (!coincide) return false;
    return calcularDigitoVerificador(coincide[1]) === coincide[2];
}

/** "761234560" → "76.123.456-0". Supone un RUT válido. */
export function formatearRut(rut: string): string {
    const limpio = limpiarRut(rut);
    const cuerpo = limpio.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `${cuerpo}-${limpio.slice(-1)}`;
}

/**
 * Forma normalizada con que se valida, compara y guarda (diseno.md §4): sin puntos, con guion y con el
 * dígito verificador en mayúscula. «12.345.678-k» → «12345678-K». La interfaz lo muestra con `formatearRut`.
 */
export function normalizarRut(rut: string): string {
    const limpio = limpiarRut(rut);
    if (limpio.length < 2) return limpio;
    return `${limpio.slice(0, -1)}-${limpio.slice(-1)}`;
}
