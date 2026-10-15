import { type LucideProps } from "lucide-solid";
import Ban from "lucide-solid/icons/ban";
import CircleAlert from "lucide-solid/icons/circle-alert";
import KeyRound from "lucide-solid/icons/key-round";
import RadioTower from "lucide-solid/icons/radio-tower";
import ScrollText from "lucide-solid/icons/scroll-text";
import ShieldCheck from "lucide-solid/icons/shield-check";
import ShieldX from "lucide-solid/icons/shield-x";
import { Component, createSignal, For, JSX, onMount, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import EstadoVacio from "~/components/ui/EstadoVacio";
import { api, ErrorCliente } from "~/core/api";
import createForm from "~/core/form";
import { ETIQUETA_ACCION, ETIQUETA_TIPO_EVENTO, textoCausa, TIPOS_EVENTO, type EventoAdmin } from "~/lib/esquemas/admin";
import type { Pagina } from "~/lib/esquemas/paginacion";
import { fechaRelativa, rangoDeDias } from "~/lib/fechas";
import "../../styles/Admin.css";

const TAMANO = 30;

const ASPECTO: Record<EventoAdmin["tipo"], { icono: Component<LucideProps>; tono: string }> = {
    OPERACION_ADMINISTRATIVA: { icono: ShieldCheck, tono: "sin-evaluar" },
    ACCESO_FALLIDO: { icono: KeyRound, tono: "advertencia" },
    ACCESO_DENEGADO: { icono: Ban, tono: "advertencia" },
    ORIGEN_RECHAZADO: { icono: ShieldX, tono: "advertencia" },
    TRAMA_RECHAZADA: { icono: RadioTower, tono: "sin-datos" },
    ERROR_INGESTA: { icono: CircleAlert, tono: "critico" },
    ERROR_NOTIFICACION: { icono: CircleAlert, tono: "critico" },
};

const ENTIDAD: Record<string, string> = { cuentas: "cuenta", estaciones: "estación", criterios: "umbral" };

type Detalle = Record<string, unknown> & {
    accion?: string;
    cambios?: Record<string, { anterior: unknown; nuevo: unknown }>;
    correo?: string;
    causa?: string;
    ruta?: string;
    origen?: string;
    metodo?: string;
    trama?: { numero_serie?: string };
    numeroSerie?: string;
};

const valor = (v: unknown) => (v === null || v === undefined || v === "" ? "(vacío)" : String(v));

/** Descripción legible del evento, sin datos sensibles (el servidor ya los excluye). */
function descripcion(e: EventoAdmin): string[] {
    const d = (e.detalle ?? {}) as Detalle;
    const lineas: string[] = [];
    if (e.tipo === "OPERACION_ADMINISTRATIVA") {
        const elemento = e.entidad ? `${ENTIDAD[e.entidad] ?? e.entidad} n.º ${e.entidadId}` : "";
        lineas.push([ETIQUETA_ACCION[d.accion ?? ""] ?? d.accion ?? "Operación", elemento, d.numeroSerie ?? d.correo ?? ""].filter(Boolean).join(" · "));
        for (const [campo, c] of Object.entries(d.cambios ?? {})) lineas.push(`${campo}: ${valor(c.anterior)} → ${valor(c.nuevo)}`);
    } else if (e.tipo === "ACCESO_FALLIDO") {
        lineas.push(`Correo: ${d.correo ?? "(sin dato)"}${d.causa ? ` · ${textoCausa(d.causa)}` : ""}`);
    } else if (e.tipo === "ORIGEN_RECHAZADO") {
        lineas.push(`Solicitud desde otro sitio: ${d.origen ?? "(desconocido)"} · ${d.metodo ?? ""} ${d.ruta ?? ""}`.trim());
    } else if (e.tipo === "ACCESO_DENEGADO") {
        lineas.push(`Intentó entrar a ${d.ruta ?? "una ruta restringida"}`);
    } else if (e.tipo === "TRAMA_RECHAZADA") {
        lineas.push([d.causa ? textoCausa(d.causa) : "", d.trama?.numero_serie ? `estación ${d.trama.numero_serie}` : ""].filter(Boolean).join(" · ") || "Trama rechazada");
    } else if (d.causa) {
        lineas.push(textoCausa(String(d.causa)));
    }
    if (e.motivo) lineas.push(`Motivo: ${e.motivo}`);
    return lineas;
}

/** Registro de eventos del sistema (RF07.10). */
export default function Eventos() {
    const F = createForm("eventos");
    const [tipo, setTipo] = createSignal("");
    const [desde, setDesde] = createSignal("");
    const [hasta, setHasta] = createSignal("");
    const [errores, setErrores] = createSignal<Record<string, string>>({});
    const [pagina, setPagina] = createSignal<Pagina<EventoAdmin>>();
    const [cargando, setCargando] = createSignal(false);
    const [error, setError] = createSignal("");

    async function cargar(numero = 1) {
        const p = new URLSearchParams({ pagina: String(numero), tamano: String(TAMANO) });
        if (tipo()) p.set("tipo", tipo());
        if (desde() && hasta() && desde() > hasta()) {
            setErrores({ desde: "La fecha inicial no puede ser posterior a la final." });
            return;
        }
        setErrores({});
        // Días de Chile, rango semiabierto como en el historial (diseno.md §8.3).
        if (desde()) p.set("desde", rangoDeDias(desde(), desde()).desde.toISOString());
        if (hasta()) p.set("hasta", rangoDeDias(hasta(), hasta()).hasta.toISOString());
        setCargando(true);
        try {
            const nueva = await api.get<Pagina<EventoAdmin>>(`/admin/eventos?${p}`);
            setPagina(numero === 1 ? nueva : { ...nueva, items: [...(pagina()?.items ?? []), ...nueva.items] });
            setError("");
        } catch (err) {
            setError(err instanceof ErrorCliente ? err.message : "No pudimos cargar los eventos. Intenta de nuevo.");
        } finally {
            setCargando(false);
        }
    }

    // Regla de diseno.md §3: los datos se piden desde el navegador.
    onMount(() => cargar());

    const enviar: JSX.EventHandler<HTMLFormElement, SubmitEvent> = (e) => {
        e.preventDefault();
        void cargar();
    };

    return (
        <div class="admin-eventos">
            <h2>Registro de eventos</h2>
            <F.Form onSubmit={enviar} noValidate class="admin-filtros">
                <label class="selector-terreno">
                    <span>Tipo</span>
                    <select value={tipo()} onChange={(e) => { setTipo(e.currentTarget.value); void cargar(); }}>
                        <option value="">Todos</option>
                        <For each={TIPOS_EVENTO}>{(t) => <option value={t}>{ETIQUETA_TIPO_EVENTO[t]}</option>}</For>
                    </select>
                </label>
                <F.Fecha name="desde" label="Desde" value={desde()} onInput={(e) => setDesde(e.currentTarget.value)} error={errores().desde} />
                <F.Fecha name="hasta" label="Hasta" value={hasta()} onInput={(e) => setHasta(e.currentTarget.value)} error={errores().hasta} />
                <F.Submit name="Filtrar" class="admin-submit" guardando={cargando()} textoGuardando="Cargando…" />
            </F.Form>

            <Show when={error()}>
                <p class="form-error" role="alert">{error()}</p>
            </Show>

            <Show when={pagina()} fallback={<p class="admin-nota">Cargando eventos…</p>}>
                {(p) => (
                    <Show when={p().items.length > 0} fallback={<EstadoVacio icono={ScrollText} titulo="No hay eventos con estos filtros." />}>
                        <p class="admin-nota" aria-live="polite">
                            Mostrando {p().items.length} de {p().total} eventos.
                        </p>
                        <ul class="admin-lista">
                            <For each={p().items}>
                                {(ev) => (
                                    <li class="admin-item admin-evento">
                                        <span class={`insignia-estado insignia-${ASPECTO[ev.tipo].tono}`}>
                                            <Dynamic component={ASPECTO[ev.tipo].icono} size={16} aria-hidden="true" />
                                            <span>{ETIQUETA_TIPO_EVENTO[ev.tipo]}</span>
                                        </span>
                                        <div class="admin-item-texto">
                                            <For each={descripcion(ev)}>{(linea, i) => <p class={i() === 0 ? "admin-item-titulo" : "admin-nota"}>{linea}</p>}</For>
                                            <p class="admin-nota">
                                                {fechaRelativa(ev.fecha, new Date())} ·{" "}
                                                {ev.responsable ? `${ev.responsable.nombre} ${ev.responsable.apellido} (${ev.responsable.correo})` : "Sistema"}
                                            </p>
                                        </div>
                                    </li>
                                )}
                            </For>
                        </ul>
                        <Show when={p().items.length < p().total}>
                            <button type="button" class="boton-secundario" disabled={cargando()} onClick={() => cargar(p().pagina + 1)}>
                                {cargando() ? "Cargando…" : "Ver más eventos"}
                            </button>
                        </Show>
                    </Show>
                )}
            </Show>
        </div>
    );
}
