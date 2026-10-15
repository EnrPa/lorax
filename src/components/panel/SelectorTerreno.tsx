import { For } from "solid-js";

/** Selector de terreno del panel e historial (diseno.md §9). */
export default function SelectorTerreno(props: {
    terrenos: Array<{ id: number; nombre: string }>;
    valor: number | undefined;
    alCambiar: (id: number) => void;
}) {
    return (
        <label class="selector-terreno">
            <span>Terreno</span>
            <select value={props.valor} onChange={(e) => props.alCambiar(Number(e.currentTarget.value))}>
                <For each={props.terrenos}>{(t) => <option value={t.id}>{t.nombre}</option>}</For>
            </select>
        </label>
    );
}
