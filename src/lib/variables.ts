// Catálogo de variables (diseno.md §5). Compartido por cliente y servidor.

export interface Variable {
    tipo: string;
    /** Nombre que ve el productor. */
    etiqueta: string;
    /** Código por defecto del sensor en la trama de ingesta. */
    codigo: string;
    unidad: string;
    rangoMinimo: number;
    rangoMaximo: number;
}

export const VARIABLES = [
    { tipo: "temperatura_aire", etiqueta: "Temperatura del aire", codigo: "temp_aire", unidad: "°C", rangoMinimo: -20, rangoMaximo: 60 },
    { tipo: "humedad_aire", etiqueta: "Humedad del aire", codigo: "hum_aire", unidad: "%", rangoMinimo: 0, rangoMaximo: 100 },
    { tipo: "humedad_suelo", etiqueta: "Humedad del suelo", codigo: "hum_suelo", unidad: "%", rangoMinimo: 0, rangoMaximo: 100 },
    { tipo: "nitrogeno", etiqueta: "Nitrógeno (N)", codigo: "n", unidad: "mg/kg", rangoMinimo: 0, rangoMaximo: 1999 },
    { tipo: "fosforo", etiqueta: "Fósforo (P)", codigo: "p", unidad: "mg/kg", rangoMinimo: 0, rangoMaximo: 1999 },
    { tipo: "potasio", etiqueta: "Potasio (K)", codigo: "k", unidad: "mg/kg", rangoMinimo: 0, rangoMaximo: 1999 },
] as const satisfies readonly Variable[];

export type TipoVariable = (typeof VARIABLES)[number]["tipo"];
export type CodigoVariable = (typeof VARIABLES)[number]["codigo"];

export function variablePorTipo(tipo: string): Variable | undefined {
    return VARIABLES.find((v) => v.tipo === tipo);
}

export function variablePorCodigo(codigo: string): Variable | undefined {
    return VARIABLES.find((v) => v.codigo === codigo);
}
