import Check from "lucide-solid/icons/check";
import CircleCheck from "lucide-solid/icons/circle-check";
import TriangleAlert from "lucide-solid/icons/triangle-alert";
import { Show } from "solid-js";
import type { AlertaResumen } from "~/lib/esquemas/estado";
import { fechaRelativa } from "~/lib/fechas";
import "../../styles/Panel.css";

/** Una alerta del panel o de la lista de alertas: estado con ícono y texto, mensaje y «Marcar como leída». */
export default function ItemAlerta(props: { alerta: AlertaResumen; ahora: Date; alMarcar: (id: number) => void; conTerreno?: boolean }) {
    const a = () => props.alerta;
    const vigente = () => a().estado === "VIGENTE";
    return (
        <li class="alerta" classList={{ "alerta-vigente": vigente(), "alerta-leida": a().leida }}>
            <span class={`insignia-estado ${vigente() ? (a().severidad === "CRITICA" ? "insignia-critico" : "insignia-advertencia") : "insignia-normal"}`}>
                {vigente() ? <TriangleAlert size={16} aria-hidden="true" /> : <CircleCheck size={16} aria-hidden="true" />}
                <span>{vigente() ? "Vigente" : "Resuelta"}</span>
            </span>
            <div class="alerta-cuerpo">
                <p class="alerta-mensaje">{a().mensaje}</p>
                <p class="alerta-fecha">
                    <Show when={props.conTerreno}>{a().terreno} · </Show>
                    {fechaRelativa(a().fecha, props.ahora)}
                    <Show when={a().fechaResolucion}> · resuelta {fechaRelativa(a().fechaResolucion!, props.ahora)}</Show>
                    <Show when={a().descripcion}> ({a().descripcion})</Show>
                </p>
            </div>
            <Show
                when={!a().leida}
                fallback={
                    <span class="alerta-leida-texto">
                        <Check size={16} aria-hidden="true" /> Leída
                    </span>
                }
            >
                <button type="button" class="boton-secundario" onClick={() => props.alMarcar(a().id)}>
                    Marcar como leída
                </button>
            </Show>
        </li>
    );
}
