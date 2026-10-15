import { Title } from "@solidjs/meta";
import { useNavigate } from "@solidjs/router";
import MapPinned from "lucide-solid/icons/map-pinned";
import { createSignal, onMount, Show } from "solid-js";
import ListaAlertas from "~/components/alertas/ListaAlertas";
import Umbrales from "~/components/alertas/Umbrales";
import EstadoVacio from "~/components/ui/EstadoVacio";
import Pestanas from "~/components/ui/Pestanas";
import { api, ErrorCliente } from "~/core/api";
import type { Pagina } from "~/lib/esquemas/paginacion";
import type { TerrenoDetalle } from "~/lib/esquemas/terrenos";

// Alertas (RF06): la lista de alertas y la configuración de umbrales.
export default function Alertas() {
    const navigate = useNavigate();
    const [terrenos, setTerrenos] = createSignal<TerrenoDetalle[]>();
    const [error, setError] = createSignal("");

    // Regla de diseno.md §3: los datos se piden desde el navegador.
    onMount(async () => {
        try {
            setTerrenos((await api.get<Pagina<TerrenoDetalle>>("/terrenos?tamano=100")).items);
        } catch (err) {
            setError(err instanceof ErrorCliente ? err.message : "No pudimos cargar tus terrenos. Recarga la página.");
        }
    });

    return (
        <section class="alertas-pagina">
            <Title>Alertas · LoRax</Title>
            <h1>Alertas</h1>
            <Show when={error()}>
                <p class="form-error" role="alert">{error()}</p>
            </Show>
            <Show when={terrenos()} fallback={<p class="alertas-nota">Cargando…</p>}>
                {(lista) => (
                    <Show
                        when={lista().length > 0}
                        fallback={
                            <EstadoVacio
                                icono={MapPinned}
                                titulo="Aún no tienes terrenos. Registra el primero."
                                texto="Las alertas y los umbrales se configuran sobre los sensores de tus estaciones."
                                accion={{ texto: "Registrar terreno", onClick: () => navigate("/ajustes?pestana=terrenos") }}
                            />
                        }
                    >
                        <Pestanas
                            id="alertas"
                            etiqueta="Secciones de alertas"
                            pestanas={[
                                { id: "alertas", titulo: "Alertas", contenido: () => <ListaAlertas terrenos={lista()} /> },
                                { id: "umbrales", titulo: "Umbrales", contenido: () => <Umbrales terrenos={lista()} /> },
                            ]}
                        />
                    </Show>
                )}
            </Show>
        </section>
    );
}
