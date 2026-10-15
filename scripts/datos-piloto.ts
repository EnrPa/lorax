// Datos piloto (diseno.md §10). Los usan la semilla y el emulador.
// Todos los datos son ficticios; los RUT tienen dígito verificador válido.

/** Contraseña común de demostración, documentada en el README. No es un secreto. */
export const CONTRASENA_DEMO = "LoraxDemo2026!";

export const TIPO_ESTACION = "Estación de terreno";
export const MODELO_ESTACION = "LX-100";

/** Clima base de cada terreno para el modelo de valores (fin de septiembre). */
export interface ClimaPiloto {
    /** Temperatura media diaria, en °C. */
    temperaturaMedia: number;
    /** Diferencia entre la media y la máxima del día, en °C. */
    amplitudTermica: number;
}

export interface EstacionPiloto {
    numeroSerie: string;
    latitud: number;
    longitud: number;
    /** Valores base de N, P y K, en mg/kg. */
    nutrientes: { n: number; p: number; k: number };
}

export interface TerrenoPiloto {
    nombre: string;
    comuna: string;
    region: string;
    latitud: number;
    longitud: number;
    superficie: number;
    tipoCultivo: string;
    clima: ClimaPiloto;
    estaciones: EstacionPiloto[];
}

export interface ProductorPiloto {
    nombre: string;
    apellido: string;
    correo: string;
    telefono: string;
    cargo: string;
    habilitada: boolean;
    empresa: { nombre: string; rut: string };
    terrenos: TerrenoPiloto[];
}

export interface CriterioPiloto {
    numeroSerie: string;
    codigo: string;
    condicion: "SUPERA" | "DESCIENDE";
    umbral: number;
    severidad: "ADVERTENCIA" | "CRITICA";
    canales: Array<"PLATAFORMA" | "CORREO" | "SMS" | "WHATSAPP">;
}

export const ADMINISTRADOR = {
    nombre: "Admin",
    apellido: "LoRax",
    correo: "admin@lorax.local",
};

export const PRODUCTORES: ProductorPiloto[] = [
    {
        nombre: "María",
        apellido: "González",
        correo: "maria.gonzalez@lorax.local",
        telefono: "+56911111111",
        cargo: "Dueña",
        habilitada: true,
        empresa: { nombre: "Agrícola Los Castaños SpA", rut: "76123456-0" },
        terrenos: [
            {
                nombre: "Parcela Los Castaños",
                comuna: "Freire",
                region: "La Araucanía",
                latitud: -38.95,
                longitud: -72.62,
                superficie: 12.5,
                tipoCultivo: "Arándanos",
                clima: { temperaturaMedia: 9, amplitudTermica: 6 },
                estaciones: [
                    { numeroSerie: "EST-0001", latitud: -38.9488, longitud: -72.6215, nutrientes: { n: 48, p: 26, k: 180 } },
                    { numeroSerie: "EST-0002", latitud: -38.9495, longitud: -72.6182, nutrientes: { n: 52, p: 24, k: 172 } },
                    { numeroSerie: "EST-0003", latitud: -38.9512, longitud: -72.6208, nutrientes: { n: 45, p: 28, k: 190 } },
                    { numeroSerie: "EST-0004", latitud: -38.9509, longitud: -72.6179, nutrientes: { n: 50, p: 25, k: 176 } },
                ],
            },
        ],
    },
    {
        nombre: "José",
        apellido: "Muñoz",
        correo: "jose.munoz@lorax.local",
        telefono: "+56922222222",
        cargo: "Administrador de campo",
        habilitada: true,
        empresa: { nombre: "Hortalizas Ñuble Ltda.", rut: "77234567-4" },
        terrenos: [
            {
                nombre: "Huerto San Nicolás",
                comuna: "San Nicolás",
                region: "Ñuble",
                latitud: -36.5,
                longitud: -72.21,
                superficie: 4.2,
                tipoCultivo: "Hortalizas",
                clima: { temperaturaMedia: 11, amplitudTermica: 6 },
                estaciones: [
                    { numeroSerie: "EST-0005", latitud: -36.4991, longitud: -72.2112, nutrientes: { n: 62, p: 32, k: 210 } },
                    { numeroSerie: "EST-0006", latitud: -36.5008, longitud: -72.2089, nutrientes: { n: 58, p: 30, k: 205 } },
                ],
            },
            {
                nombre: "Potrero El Alba",
                comuna: "Purranque",
                region: "Los Lagos",
                latitud: -40.91,
                longitud: -73.16,
                superficie: 30,
                tipoCultivo: "Praderas",
                clima: { temperaturaMedia: 8, amplitudTermica: 5 },
                estaciones: [
                    { numeroSerie: "EST-0007", latitud: -40.9087, longitud: -73.1618, nutrientes: { n: 34, p: 18, k: 150 } },
                    { numeroSerie: "EST-0008", latitud: -40.9114, longitud: -73.1581, nutrientes: { n: 38, p: 20, k: 158 } },
                ],
            },
        ],
    },
    {
        // Sin terrenos: para el estado vacío del panel.
        nombre: "Ana",
        apellido: "Soto",
        correo: "ana.soto@lorax.local",
        telefono: "+56933333333",
        cargo: "Dueña",
        habilitada: true,
        empresa: { nombre: "Viñedos Soto EIRL", rut: "76345678-1" },
        terrenos: [],
    },
    {
        // Cuenta deshabilitada: para la prueba de acceso.
        nombre: "Pedro",
        apellido: "Rojas",
        correo: "pedro.rojas@lorax.local",
        telefono: "+56944444444",
        cargo: "Dueño",
        habilitada: false,
        empresa: { nombre: "Frutícola Rojas SpA", rut: "78456789-3" },
        terrenos: [],
    },
];

export const CRITERIOS_PILOTO: CriterioPiloto[] = [
    { numeroSerie: "EST-0001", codigo: "hum_suelo", condicion: "DESCIENDE", umbral: 25, severidad: "ADVERTENCIA", canales: ["PLATAFORMA", "CORREO"] },
    { numeroSerie: "EST-0005", codigo: "temp_aire", condicion: "DESCIENDE", umbral: 0, severidad: "CRITICA", canales: ["PLATAFORMA", "CORREO", "SMS"] },
    { numeroSerie: "EST-0007", codigo: "n", condicion: "DESCIENDE", umbral: 20, severidad: "ADVERTENCIA", canales: ["PLATAFORMA"] },
];

/** Situaciones preparadas en la Parcela Los Castaños (diseno.md §10). */
export const SITUACIONES = {
    /** Estación que deja de reportar antes del fin de la historia («sin datos recientes»). */
    estacionSilenciosa: { numeroSerie: "EST-0003", horasSinReportar: 3 },
    /**
     * Episodios de sequía de la humedad del suelo en EST-0001, en días antes del fin de la historia.
     * Los dos primeros se riegan al terminar (alertas resueltas); el último sigue en curso (alerta vigente).
     */
    sequias: {
        numeroSerie: "EST-0001",
        episodios: [
            { desdeDias: 21, hastaDias: 19.5 },
            { desdeDias: 11, hastaDias: 9.5 },
            { desdeDias: 1.5, hastaDias: null },
        ],
    },
} as const;

export const DIAS_DE_HISTORIA = 30;
/** Intervalo de medición, en segundos (diseno.md §4, valor por defecto). */
export const INTERVALO_SEGUNDOS = 900;

export function estacionesPiloto() {
    return PRODUCTORES.flatMap((p) => p.terrenos.flatMap((t) => t.estaciones.map((e) => ({ ...e, terreno: t }))));
}
