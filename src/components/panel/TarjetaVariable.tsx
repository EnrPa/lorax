import { Show } from "solid-js";
import GraficoSerie from "~/components/ui/GraficoSerie";
import InsigniaEstado from "~/components/ui/InsigniaEstado";
import type { VariableEstado } from "~/lib/esquemas/estado";
import { fechaRelativa } from "~/lib/fechas";
import { formatearValor } from "~/lib/formato";
import "../../styles/Panel.css";

const numero = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 });

/** «bajo 25 %» / «sobre 30 °C»: los criterios que incumple la última lectura. */
function detalleFueraDeRango(v: VariableEstado): string {
    return v.criterios
        .filter((c) => c.incumplido)
        .map((c) => `${c.condicion === "DESCIENDE" ? "bajo" : "sobre"} ${formatearValor(c.umbral, v.unidad)}`)
        .join(", ");
}

/**
 * Tarjeta de variable (diseno.md §9): el elemento protagonista del panel. Valor grande con unidad,
 * estado con color + ícono + texto, fecha relativa y absoluta, y la curva de 24 h.
 */
export default function TarjetaVariable(props: { variable: VariableEstado; ahora: Date }) {
    const v = () => props.variable;
    const antigua = () => v().estado === "SIN_DATOS_RECIENTES";
    const critico = () => v().criterios.some((c) => c.incumplido && c.severidad === "CRITICA");

    return (
        <article class={`tarjeta-variable tarjeta-${v().estado.toLowerCase().replaceAll("_", "-")}`} aria-label={v().etiqueta}>
            <header class="tarjeta-encabezado">
                <h3>{v().etiqueta}</h3>
                <InsigniaEstado
                    estado={v().estado}
                    critico={critico()}
                    detalle={v().estado === "FUERA_DE_RANGO" ? detalleFueraDeRango(v()) : undefined}
                />
            </header>

            <Show
                when={v().valor !== null}
                fallback={<p class="tarjeta-sin-lecturas">Esta variable aún no tiene lecturas.</p>}
            >
                {/* Sin datos recientes: el valor antiguo no se destaca (RF04.2). */}
                <p class="tarjeta-valor" classList={{ "tarjeta-valor-antiguo": antigua() }}>
                    <span class="tarjeta-numero">{numero.format(v().valor!)}</span>
                    <span class="tarjeta-unidad">{v().unidad}</span>
                </p>
                <p class="tarjeta-fecha">
                    {antigua() ? "Último dato: " : ""}
                    <time datetime={v().fecha!}>{fechaRelativa(v().fecha!, props.ahora)}</time>
                </p>
            </Show>

            <Show when={v().serie.length > 1}>
                <GraficoSerie
                    compacto
                    unidad={v().unidad}
                    etiqueta={`Evolución de ${v().etiqueta.toLowerCase()} en las últimas 24 horas`}
                    desde={props.ahora.getTime() - 24 * 3_600_000}
                    hasta={props.ahora.getTime()}
                    series={[{ nombre: v().etiqueta, puntos: v().serie.map((p) => ({ x: p.t, y: p.v })) }]}
                />
                <p class="tarjeta-pie">Últimas 24 horas</p>
            </Show>
        </article>
    );
}
