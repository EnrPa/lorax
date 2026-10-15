import { type LucideProps } from "lucide-solid";
import CircleCheck from "lucide-solid/icons/circle-check";
import CircleDashed from "lucide-solid/icons/circle-dashed";
import CircleOff from "lucide-solid/icons/circle-off";
import Clock from "lucide-solid/icons/clock";
import Radio from "lucide-solid/icons/radio";
import TriangleAlert from "lucide-solid/icons/triangle-alert";
import { Component, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import type { EstadoEstacion, EstadoVariable } from "~/lib/esquemas/estado";
import "../../styles/InsigniaEstado.css";

/** Aspecto de cada estado: color (token de tokens.css) + ícono + texto. Nunca solo color (diseno.md §9). */
const ESTADOS: Record<EstadoVariable | EstadoEstacion, { texto: string; icono: Component<LucideProps>; tono: string }> = {
    NORMAL: { texto: "Normal", icono: CircleCheck, tono: "normal" },
    FUERA_DE_RANGO: { texto: "Fuera de rango", icono: TriangleAlert, tono: "advertencia" },
    SIN_DATOS_RECIENTES: { texto: "Sin datos recientes", icono: Clock, tono: "sin-datos" },
    SIN_EVALUAR: { texto: "Sin evaluar", icono: CircleDashed, tono: "sin-evaluar" },
    SIN_LECTURAS: { texto: "Sin lecturas", icono: CircleOff, tono: "sin-datos" },
    ACTIVA: { texto: "Activa", icono: Radio, tono: "normal" },
    DESHABILITADA: { texto: "Deshabilitada", icono: CircleOff, tono: "sin-datos" },
};

export default function InsigniaEstado(props: {
    estado: EstadoVariable | EstadoEstacion;
    /** Detalle junto al estado, p. ej. «bajo 25 %». */
    detalle?: string;
    /** Un criterio crítico incumplido usa el color crítico en vez del de advertencia. */
    critico?: boolean;
}) {
    const aspecto = () => ESTADOS[props.estado];
    const tono = () => (props.estado === "FUERA_DE_RANGO" && props.critico ? "critico" : aspecto().tono);
    return (
        <span class={`insignia-estado insignia-${tono()}`}>
            <Dynamic component={aspecto().icono} size={16} aria-hidden="true" />
            <span>
                {aspecto().texto}
                <Show when={props.detalle}>: {props.detalle}</Show>
            </span>
        </span>
    );
}
