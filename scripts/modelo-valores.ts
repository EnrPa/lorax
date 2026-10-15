// Modelo de valores simulados de una estación (diseno.md §10). Lo usan la semilla y el emulador.
// Es determinista: la misma estación, con las mismas fechas, produce siempre los mismos valores.
// Tiene estado (humedad del suelo, nutrientes), así que `lecturas` debe llamarse en orden cronológico.
import type { CodigoVariable } from "~/lib/variables";
import type { ClimaPiloto, EstacionPiloto } from "./datos-piloto";

/** Periodo sin riego, en milisegundos UTC. `hasta` nulo: la sequía sigue en curso. */
export interface VentanaSequia {
    desde: number;
    hasta: number | null;
}

export type Lecturas = Record<CodigoVariable, number>;

export interface Meta {
    rssi: number;
    snr: number;
    bateria: number;
}

// Hora de Chile a fin de septiembre (horario de verano, UTC−3).
const DESFASE_CHILE_HORAS = -3;
const HORA_MAXIMA_TEMPERATURA = 15;
const MS_DIA = 86_400_000;

// Humedad del suelo, en puntos porcentuales por medición de 15 minutos.
const SECADO_NORMAL = 0.07;
const SECADO_SEQUIA = 0.3;
const HUMEDAD_SUELO_MINIMA = 17;

/** Generador pseudoaleatorio mulberry32, sembrado con un texto. */
function crearAleatorio(semilla: string): () => number {
    let estado = 0;
    for (const caracter of semilla) estado = (Math.imul(estado, 31) + caracter.charCodeAt(0)) | 0;
    return () => {
        estado = (estado + 0x6d2b79f5) | 0;
        let t = Math.imul(estado ^ (estado >>> 15), 1 | estado);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
    };
}

const redondear = (valor: number, decimales = 1) => Number(valor.toFixed(decimales));
const acotar = (valor: number, min: number, max: number) => Math.min(max, Math.max(min, valor));

export class ModeloEstacion {
    private readonly aleatorio: () => number;
    private dia = Number.NaN;
    private desvioTemperatura = 0;
    private humedadSuelo: number;
    private nutrientes: { n: number; p: number; k: number };
    private bateria = 4.1;

    constructor(
        private readonly estacion: EstacionPiloto,
        private readonly clima: ClimaPiloto,
        private readonly sequias: VentanaSequia[] = [],
    ) {
        this.aleatorio = crearAleatorio(estacion.numeroSerie);
        this.humedadSuelo = 36 + this.aleatorio() * 8;
        this.nutrientes = { ...estacion.nutrientes };
    }

    /** Ruido aproximadamente normal, acotado a ±amplitud. */
    private ruido(amplitud: number): number {
        return ((this.aleatorio() + this.aleatorio() + this.aleatorio() - 1.5) / 1.5) * amplitud;
    }

    private enSequia(ms: number): boolean {
        return this.sequias.some((s) => ms >= s.desde && (s.hasta === null || ms < s.hasta));
    }

    lecturas(fecha: Date): Lecturas {
        const ms = fecha.getTime();

        // Cada día, la media se desvía un poco y vuelve lentamente al clima base.
        const dia = Math.floor(ms / MS_DIA);
        if (dia !== this.dia) {
            this.dia = dia;
            this.desvioTemperatura = acotar(0.6 * this.desvioTemperatura + this.ruido(1.2), -2.5, 2.5);
        }

        // Temperatura con ciclo diario: máxima a las 15:00 hora de Chile.
        const horaLocal = (((ms / 3_600_000 + DESFASE_CHILE_HORAS) % 24) + 24) % 24;
        const ciclo = Math.cos((2 * Math.PI * (horaLocal - HORA_MAXIMA_TEMPERATURA)) / 24);
        const media = this.clima.temperaturaMedia + this.desvioTemperatura;
        const temperatura = media + this.clima.amplitudTermica * ciclo + this.ruido(0.3);

        // Humedad del aire inversa a la temperatura.
        const humedadAire = acotar(70 - (temperatura - media) * 3.5 + this.ruido(2), 30, 99);

        // Humedad del suelo: baja lentamente y sube con riegos; en sequía baja rápido y no se riega.
        if (this.enSequia(ms)) {
            this.humedadSuelo = Math.max(HUMEDAD_SUELO_MINIMA, this.humedadSuelo - SECADO_SEQUIA);
        } else {
            this.humedadSuelo -= SECADO_NORMAL;
            if (this.humedadSuelo < 30 + this.aleatorio() * 4) this.humedadSuelo = 42 + this.aleatorio() * 6;
        }

        // Nutrientes estables: deriva lenta que vuelve al valor base de la estación.
        const base = this.estacion.nutrientes;
        for (const clave of ["n", "p", "k"] as const) {
            this.nutrientes[clave] += 0.02 * (base[clave] - this.nutrientes[clave]) + this.ruido(0.3);
        }

        return {
            temp_aire: redondear(temperatura),
            hum_aire: redondear(humedadAire),
            // Ruido menor que el secado en sequía: el valor no oscila en torno al umbral.
            hum_suelo: redondear(this.humedadSuelo + this.ruido(0.1)),
            n: Math.round(this.nutrientes.n + this.ruido(1)),
            p: Math.round(this.nutrientes.p + this.ruido(1)),
            k: Math.round(this.nutrientes.k + this.ruido(1)),
        };
    }

    /** Datos de radio y batería que acompañan a la trama. */
    meta(): Meta {
        this.bateria = Math.max(3.5, this.bateria - 0.00002);
        return {
            rssi: Math.round(-100 + this.ruido(8)),
            snr: redondear(7 + this.ruido(1.5)),
            bateria: redondear(this.bateria, 2),
        };
    }
}
