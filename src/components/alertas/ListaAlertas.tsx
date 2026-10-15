import BellOff from "lucide-solid/icons/bell-off";
import { createSignal, For, onMount, Show } from "solid-js";
import ItemAlerta from "~/components/panel/ItemAlerta";
import EstadoVacio from "~/components/ui/EstadoVacio";
import { api, ErrorCliente } from "~/core/api";
import createForm from "~/core/form";
import { refrescarNoLeidas } from "~/core/noLeidas";
import type { AlertaResumen } from "~/lib/esquemas/estado";
import type { Pagina } from "~/lib/esquemas/paginacion";
import "../../styles/Alertas.css";

const TAMANO = 20;

/** Pestaña «Alertas» (RF06.10): lista con filtros por terreno, estado y no leídas. */
export default function ListaAlertas(props: { terrenos: Array<{ id: number; nombre: string }> }) {
    const Form = createForm("filtro-alertas");
    const [terrenoId, setTerrenoId] = createSignal("");
    const [estado, setEstado] = createSignal("");
    const [soloNoLeidas, setSoloNoLeidas] = createSignal(false);
    const [pagina, setPagina] = createSignal<Pagina<AlertaResumen>>();
    const [cargando, setCargando] = createSignal(false);
    const [error, setError] = createSignal("");

    async function cargar(numero = 1) {
        const p = new URLSearchParams({ pagina: String(numero), tamano: String(TAMANO) });
        if (terrenoId()) p.set("terrenoId", terrenoId());
        if (estado()) p.set("estado", estado());
        if (soloNoLeidas()) p.set("noLeidas", "true");
        setCargando(true);
        try {
            const nueva = await api.get<Pagina<AlertaResumen>>(`/alertas?${p}`);
            // «Ver más» agrega la página siguiente a la lista ya mostrada.
            setPagina(numero === 1 ? nueva : { ...nueva, items: [...(pagina()?.items ?? []), ...nueva.items] });
            setError("");
        } catch (err) {
            setError(err instanceof ErrorCliente ? err.message : "No pudimos cargar las alertas. Intenta de nuevo.");
        } finally {
            setCargando(false);
        }
    }

    // Regla de diseno.md §3: los datos se piden desde el navegador.
    onMount(() => cargar());

    const marcar = async (id: number) => {
        try {
            const actualizada = await api.patch<AlertaResumen>(`/alertas/${id}`, { leida: true });
            const actual = pagina();
            if (actual) {
                const items = soloNoLeidas()
                    ? actual.items.filter((a) => a.id !== id)
                    : actual.items.map((a) => (a.id === id ? actualizada : a));
                setPagina({ ...actual, items, total: soloNoLeidas() ? actual.total - 1 : actual.total });
            }
            void refrescarNoLeidas();
        } catch (err) {
            setError(err instanceof ErrorCliente ? err.message : "No pudimos marcar la alerta. Intenta de nuevo.");
        }
    };

    const ahora = () => new Date();

    return (
        <div class="lista-alertas">
            <div class="alertas-filtros" role="group" aria-label="Filtrar alertas">
                <label class="selector-terreno">
                    <span>Terreno</span>
                    <select value={terrenoId()} onChange={(e) => { setTerrenoId(e.currentTarget.value); void cargar(); }}>
                        <option value="">Todos mis terrenos</option>
                        <For each={props.terrenos}>{(t) => <option value={t.id}>{t.nombre}</option>}</For>
                    </select>
                </label>
                <label class="selector-terreno">
                    <span>Estado</span>
                    <select value={estado()} onChange={(e) => { setEstado(e.currentTarget.value); void cargar(); }}>
                        <option value="">Todas</option>
                        <option value="VIGENTE">Vigentes</option>
                        <option value="RESUELTA">Resueltas</option>
                    </select>
                </label>
                <Form.Checkbox
                    name="noLeidas"
                    description="Solo las que no he leído"
                    checked={soloNoLeidas()}
                    onChange={(e) => { setSoloNoLeidas(e.currentTarget.checked); void cargar(); }}
                />
            </div>

            <Show when={error()}>
                <p class="form-error" role="alert">{error()}</p>
            </Show>

            <Show when={pagina()} fallback={<p class="alertas-nota">Cargando alertas…</p>}>
                {(p) => (
                    <Show
                        when={p().items.length > 0}
                        fallback={
                            <EstadoVacio
                                icono={BellOff}
                                titulo="No hay alertas con estos filtros."
                                texto="Cuando una medición no cumpla uno de tus umbrales, la alerta aparecerá aquí."
                            />
                        }
                    >
                        <p class="alertas-nota" aria-live="polite">
                            Mostrando {p().items.length} de {p().total} {p().total === 1 ? "alerta" : "alertas"}.
                        </p>
                        <ul class="alertas">
                            <For each={p().items}>{(a) => <ItemAlerta alerta={a} ahora={ahora()} alMarcar={marcar} conTerreno />}</For>
                        </ul>
                        <Show when={p().items.length < p().total}>
                            <button type="button" class="boton-secundario" disabled={cargando()} onClick={() => cargar(p().pagina + 1)}>
                                {cargando() ? "Cargando…" : "Ver más alertas"}
                            </button>
                        </Show>
                    </Show>
                )}
            </Show>
        </div>
    );
}
