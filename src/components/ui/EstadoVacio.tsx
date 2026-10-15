import { type LucideProps } from "lucide-solid";
import { Component, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import "../../styles/EstadoVacio.css";

/** Estado vacío que invita a actuar (diseno.md §9): «Aún no tienes terrenos. Registra el primero.» */
export default function EstadoVacio(props: {
    icono: Component<LucideProps>;
    titulo: string;
    texto?: string;
    accion?: { texto: string; onClick: () => void };
}) {
    return (
        <div class="estado-vacio">
            <Dynamic component={props.icono} size={40} aria-hidden="true" />
            <p class="estado-vacio-titulo">{props.titulo}</p>
            <Show when={props.texto}>
                <p class="estado-vacio-texto">{props.texto}</p>
            </Show>
            <Show when={props.accion}>
                {(accion) => (
                    <button type="button" class="estado-vacio-accion" onClick={() => accion().onClick()}>
                        {accion().texto}
                    </button>
                )}
            </Show>
        </div>
    );
}
