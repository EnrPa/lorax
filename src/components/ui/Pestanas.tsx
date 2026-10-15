import { useSearchParams } from "@solidjs/router";
import { For, JSX, Show } from "solid-js";
import "../../styles/Pestanas.css";

export interface Pestana {
    id: string;
    titulo: string;
    contenido: () => JSX.Element;
}

/**
 * Pestañas accesibles (patrón WAI-ARIA «tabs»): se cambian con clic o con las flechas del teclado.
 * La pestaña activa queda en la URL (`?pestana=...`) para poder enlazarla y volver con «Atrás».
 */
export default function Pestanas(props: {
    pestanas: Pestana[];
    etiqueta: string;
    id?: string;
    /** Parámetro de la URL donde se guarda la pestaña activa (por defecto «pestana»). Permite pestañas anidadas. */
    parametro?: string;
}) {
    const [params, setParams] = useSearchParams<Record<string, string>>();
    const clave = () => props.parametro ?? "pestana";
    const prefijo = () => props.id ?? "pestanas";
    const activa = () => props.pestanas.find((p) => p.id === params[clave()])?.id ?? props.pestanas[0]?.id;

    const activar = (id: string) => setParams({ [clave()]: id }, { replace: true });

    const teclado = (e: KeyboardEvent, indice: number) => {
        const total = props.pestanas.length;
        const destino = { ArrowRight: indice + 1, ArrowLeft: indice - 1, Home: 0, End: total - 1 }[e.key];
        if (destino === undefined) return;
        e.preventDefault();
        const pestana = props.pestanas[(destino + total) % total];
        activar(pestana.id);
        document.getElementById(`${prefijo()}-tab-${pestana.id}`)?.focus();
    };

    return (
        <div class="pestanas">
            <div role="tablist" aria-label={props.etiqueta} class="pestanas-lista">
                <For each={props.pestanas}>
                    {(pestana, i) => (
                        <button
                            type="button"
                            role="tab"
                            id={`${prefijo()}-tab-${pestana.id}`}
                            aria-selected={activa() === pestana.id}
                            aria-controls={`${prefijo()}-panel-${pestana.id}`}
                            tabIndex={activa() === pestana.id ? 0 : -1}
                            class="pestana"
                            onClick={() => activar(pestana.id)}
                            onKeyDown={(e) => teclado(e, i())}
                        >
                            {pestana.titulo}
                        </button>
                    )}
                </For>
            </div>
            <For each={props.pestanas}>
                {(pestana) => (
                    <Show when={activa() === pestana.id}>
                        <div
                            role="tabpanel"
                            id={`${prefijo()}-panel-${pestana.id}`}
                            aria-labelledby={`${prefijo()}-tab-${pestana.id}`}
                            class="pestanas-panel"
                        >
                            {pestana.contenido()}
                        </div>
                    </Show>
                )}
            </For>
        </div>
    );
}
