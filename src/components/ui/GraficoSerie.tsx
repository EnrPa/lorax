import {
    Chart,
    Filler,
    LinearScale,
    LineController,
    LineElement,
    PointElement,
    Tooltip,
    Legend,
    type ChartConfiguration,
} from "chart.js";
import { createEffect, on, onCleanup, onMount } from "solid-js";
import { fechaEje, fechaHoraEje, horaEje, marcasDiarias, marcasHorarias } from "~/lib/fechas";

Chart.register(LineController, LineElement, PointElement, LinearScale, Filler, Tooltip, Legend);

export interface PuntoGrafico {
    /** Instante en milisegundos. */
    x: number;
    /** Valor (el promedio, si la serie está agregada). */
    y: number;
    /** Mínimo y máximo del intervalo, si la serie está agregada: se muestran en el detalle del punto. */
    min?: number;
    max?: number;
}

export interface SerieGrafico {
    nombre: string;
    puntos: PuntoGrafico[];
    /** Línea punteada (p. ej. el periodo comparado). */
    discontinua?: boolean;
    /** Índice de color; series con el mismo índice comparten color (estación y su periodo comparado). */
    color?: number;
}

const numero = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 });
const DOS_DIAS = 2 * 24 * 3_600_000;

/** Lee un token de color de tokens.css (Chart.js no entiende `var(--...)`). */
function token(nombre: string, porDefecto: string): string {
    if (typeof window === "undefined") return porDefecto;
    return getComputedStyle(document.documentElement).getPropertyValue(nombre).trim() || porDefecto;
}

/**
 * Serie de tiempo con Chart.js (diseno.md D5): eje lineal en milisegundos, etiquetas con la hora de
 * Chile y sin adaptadores de fecha. `compacto` es la curva de 24 h de las tarjetas del panel.
 * El gráfico se destruye al desmontar el componente.
 */
export default function GraficoSerie(props: {
    series: SerieGrafico[];
    unidad: string;
    /** Descripción para lectores de pantalla. */
    etiqueta: string;
    compacto?: boolean;
    alto?: number;
    /** Rango fijo del eje de tiempo (ms). Sin él, Chart.js redondea los extremos y la curva no llena el ancho. */
    desde?: number;
    hasta?: number;
}) {
    let lienzo!: HTMLCanvasElement;
    let grafico: Chart<"line", PuntoGrafico[]> | undefined;

    const rangoLargo = () => props.desde !== undefined && props.hasta !== undefined && props.hasta - props.desde > DOS_DIAS;
    const conValor = (v: number) => `${numero.format(v)} ${props.unidad}`;

    const datasets = () => {
        const colores = [
            token("--accent", "#15803d"),
            token("--estado-sin-evaluar", "#1d4ed8"),
            token("--estado-advertencia", "#b45309"),
            token("--estado-critico", "#b91c1c"),
        ];
        return props.series.map((s, i) => {
            const color = colores[(s.color ?? i) % colores.length];
            return {
                label: s.nombre,
                data: s.puntos,
                borderColor: color,
                backgroundColor: `${color}1a`,
                borderWidth: props.compacto ? 2 : 2.5,
                borderDash: s.discontinua ? [6, 4] : undefined,
                pointRadius: 0,
                pointHitRadius: 8,
                tension: 0.3,
                fill: props.compacto && i === 0,
            };
        });
    };

    onMount(() => {
        const sinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const config: ChartConfiguration<"line", PuntoGrafico[]> = {
            type: "line",
            data: { datasets: datasets() },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                parsing: false,
                animation: sinMovimiento ? false : { duration: 300 },
                interaction: { mode: "nearest", axis: "x", intersect: false },
                scales: {
                    x: {
                        type: "linear",
                        min: props.desde,
                        max: props.hasta,
                        // Horas enteras de Chile hasta 2 días (cada 6 h en la tarjeta, 3 h en grande); días después.
                        afterBuildTicks: (eje) => {
                            if (props.desde === undefined || props.hasta === undefined) return;
                            const marcas = rangoLargo()
                                ? marcasDiarias(props.desde, props.hasta, props.compacto ? 4 : 8)
                                : marcasHorarias(props.desde, props.hasta, props.compacto ? 6 : 3);
                            eje.ticks = marcas.map((value) => ({ value }));
                        },
                        ticks: {
                            callback: (v) => (rangoLargo() ? fechaEje(Number(v)) : horaEje(Number(v))),
                            autoSkip: true,
                            maxTicksLimit: props.compacto ? 5 : 9,
                            color: token("--fg-muted", "#4b5563"),
                        },
                        grid: { display: !props.compacto },
                    },
                    y: {
                        display: !props.compacto,
                        ticks: { callback: (v) => conValor(Number(v)), color: token("--fg-muted", "#4b5563") },
                    },
                },
                plugins: {
                    legend: { display: !props.compacto && props.series.length > 1 },
                    tooltip: {
                        callbacks: {
                            title: (items) => {
                                const x = items[0]?.parsed.x;
                                if (x === undefined || x === null) return "";
                                return rangoLargo() ? fechaHoraEje(Number(x)) : horaEje(Number(x));
                            },
                            label: (item) => {
                                const p = item.raw as PuntoGrafico;
                                const extremos =
                                    p.min !== undefined && p.max !== undefined && p.min !== p.max
                                        ? ` (mínimo ${conValor(p.min)} · máximo ${conValor(p.max)})`
                                        : "";
                                return `${item.dataset.label}: ${conValor(p.y)}${extremos}`;
                            },
                        },
                    },
                },
            },
        };
        grafico = new Chart(lienzo, config);
    });

    // Al refrescar los datos se actualiza el mismo gráfico, sin recrearlo.
    createEffect(
        on(
            () => [props.series, props.desde, props.hasta],
            () => {
                if (!grafico) return;
                grafico.data.datasets = datasets();
                const x = grafico.options.scales?.x;
                if (x) {
                    x.min = props.desde;
                    x.max = props.hasta;
                }
                grafico.options.plugins!.legend!.display = !props.compacto && props.series.length > 1;
                grafico.update("none");
            },
            { defer: true },
        ),
    );

    onCleanup(() => grafico?.destroy());

    return (
        <div class="grafico-serie" style={{ height: `${props.alto ?? (props.compacto ? 96 : 320)}px`, position: "relative" }}>
            <canvas ref={lienzo} role="img" aria-label={props.etiqueta} />
        </div>
    );
}
