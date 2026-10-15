import { Title } from "@solidjs/meta";
import { useNavigate, useSearchParams } from "@solidjs/router";
import MapPinned from "lucide-solid/icons/map-pinned";
import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import ItemAlerta from "~/components/panel/ItemAlerta";
import SelectorTerreno from "~/components/panel/SelectorTerreno";
import TarjetaVariable from "~/components/panel/TarjetaVariable";
import EstadoVacio from "~/components/ui/EstadoVacio";
import InsigniaEstado from "~/components/ui/InsigniaEstado";
import { api, ErrorCliente } from "~/core/api";
import { refrescarNoLeidas } from "~/core/noLeidas";
import type { AlertaResumen, EstadoTerreno } from "~/lib/esquemas/estado";
import type { Pagina } from "~/lib/esquemas/paginacion";
import type { TerrenoDetalle } from "~/lib/esquemas/terrenos";
import { fechaRelativa } from "~/lib/fechas";
import "../styles/Panel.css";

// Panel de estado (RF04). El servidor calcula los estados; aquí solo se presentan.
const REFRESCO_MS = 60_000;

export default function Panel() {
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams<{ terreno?: string }>();
    const [terrenos, setTerrenos] = createSignal<TerrenoDetalle[]>();
    const [estado, setEstado] = createSignal<EstadoTerreno>();
    const [error, setError] = createSignal("");

    // RF04.1: el terreno elegido queda en la URL; por defecto, el primero.
    const terrenoId = () => {
        const lista = terrenos() ?? [];
        const pedido = Number(params.terreno);
        return lista.find((t) => t.id === pedido)?.id ?? lista[0]?.id;
    };

    const cargarEstado = async () => {
        const id = terrenoId();
        if (id === undefined) return;
        try {
            setEstado(await api.get<EstadoTerreno>(`/terrenos/${id}/estado`));
            setError("");
        } catch (err) {
            setError(err instanceof ErrorCliente ? err.message : "No pudimos cargar el panel. Revisa tu conexión.");
        }
    };

    // Regla de diseno.md §3: los datos se piden desde el navegador.
    onMount(async () => {
        try {
            setTerrenos((await api.get<Pagina<TerrenoDetalle>>("/terrenos?tamano=100")).items);
            await cargarEstado();
        } catch (err) {
            setError(err instanceof ErrorCliente ? err.message : "No pudimos cargar tus terrenos. Recarga la página.");
        }
        // RF04.6: se refresca solo cada 60 s mientras la página está abierta.
        const intervalo = setInterval(cargarEstado, REFRESCO_MS);
        onCleanup(() => clearInterval(intervalo));
    });

    const cambiarTerreno = (id: number) => {
        setEstado(undefined);
        setParams({ terreno: String(id) }, { replace: true });
        void cargarEstado();
    };

    const marcarLeida = async (id: number) => {
        try {
            const actualizada = await api.patch<AlertaResumen>(`/alertas/${id}`, { leida: true });
            const actual = estado();
            if (actual) setEstado({ ...actual, alertas: actual.alertas.map((a) => (a.id === id ? actualizada : a)) });
            void refrescarNoLeidas();
        } catch (err) {
            setError(err instanceof ErrorCliente ? err.message : "No pudimos marcar la alerta. Intenta de nuevo.");
        }
    };

    const ahora = () => new Date(estado()?.generado ?? Date.now());

    return (
        <section class="panel">
            <Title>Panel de estado · LoRax</Title>
            <div class="panel-encabezado">
                <h1>Panel de estado</h1>
                <Show when={(terrenos()?.length ?? 0) > 0}>
                    <SelectorTerreno terrenos={terrenos()!} valor={terrenoId()} alCambiar={cambiarTerreno} />
                </Show>
            </div>

            <Show when={error()}>
                <p class="form-error" role="alert">{error()}</p>
            </Show>

            <Show when={terrenos()} fallback={<p class="panel-cargando">Cargando tus terrenos…</p>}>
                {(lista) => (
                    <Show
                        when={lista().length > 0}
                        fallback={
                            <EstadoVacio
                                icono={MapPinned}
                                titulo="Aún no tienes terrenos. Registra el primero."
                                texto="Cuando registres un terreno y su estación, aquí verás el estado de cada variable."
                                accion={{ texto: "Registrar terreno", onClick: () => navigate("/ajustes?pestana=terrenos") }}
                            />
                        }
                    >
                        <Show when={estado()} fallback={<p class="panel-cargando">Cargando el estado del terreno…</p>}>
                            {(e) => (
                                <>
                                    <p class="panel-actualizado" aria-live="polite">
                                        Actualizado {fechaRelativa(e().generado, new Date(e().generado))}. Se actualiza solo cada minuto.
                                    </p>

                                    <section class="panel-alertas" aria-labelledby="titulo-alertas">
                                        <h2 id="titulo-alertas">Alertas recientes</h2>
                                        <Show
                                            when={e().alertas.length > 0}
                                            fallback={<p class="panel-sin-alertas">Este terreno no tiene alertas.</p>}
                                        >
                                            <ul class="alertas">
                                                <For each={e().alertas}>
                                                    {(a) => <ItemAlerta alerta={a} ahora={ahora()} alMarcar={marcarLeida} />}
                                                </For>
                                            </ul>
                                        </Show>
                                    </section>

                                    <For each={e().estaciones}>
                                        {(estacion) => (
                                            <section class="panel-estacion" aria-labelledby={`estacion-${estacion.id}`}>
                                                <header class="panel-estacion-encabezado">
                                                    <h2 id={`estacion-${estacion.id}`}>Estación {estacion.numeroSerie}</h2>
                                                    <InsigniaEstado estado={estacion.estado} />
                                                    <span class="panel-estacion-modelo">
                                                        {estacion.tipo} · {estacion.modelo}
                                                    </span>
                                                </header>
                                                <div class="tarjetas">
                                                    <For each={estacion.variables}>
                                                        {(v) => <TarjetaVariable variable={v} ahora={ahora()} />}
                                                    </For>
                                                </div>
                                            </section>
                                        )}
                                    </For>
                                </>
                            )}
                        </Show>
                    </Show>
                )}
            </Show>
        </section>
    );
}
