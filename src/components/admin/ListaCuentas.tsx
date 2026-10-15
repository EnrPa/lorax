import CircleCheck from "lucide-solid/icons/circle-check";
import CircleOff from "lucide-solid/icons/circle-off";
import Hourglass from "lucide-solid/icons/hourglass";
import UserPlus from "lucide-solid/icons/user-plus";
import Users from "lucide-solid/icons/users";
import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import EstadoVacio from "~/components/ui/EstadoVacio";
import { api, ErrorCliente } from "~/core/api";
import type { CuentaAdmin } from "~/lib/esquemas/admin";
import type { Pagina } from "~/lib/esquemas/paginacion";
import { formatearRut } from "~/lib/rut";
import "../../styles/Admin.css";

const TAMANO = 20;

/** Estado de la cuenta con ícono y texto (nunca solo color). */
export function InsigniasCuenta(props: { cuenta: CuentaAdmin }) {
    return (
        <span class="insignias-cuenta">
            <Show
                when={props.cuenta.habilitada}
                fallback={
                    <span class="insignia-estado insignia-sin-datos">
                        <CircleOff size={16} aria-hidden="true" /> Deshabilitada
                    </span>
                }
            >
                <span class="insignia-estado insignia-normal">
                    <CircleCheck size={16} aria-hidden="true" /> Habilitada
                </span>
            </Show>
            <Show when={props.cuenta.pendienteActivacion}>
                <span class="insignia-estado insignia-advertencia">
                    <Hourglass size={16} aria-hidden="true" /> Pendiente de activación
                </span>
            </Show>
        </span>
    );
}

/** Listado de productores con búsqueda y filtro por estado (RF07.2). */
export default function ListaCuentas(props: { alVer: (id: number) => void; alRegistrar: () => void }) {
    const [q, setQ] = createSignal("");
    const [estado, setEstado] = createSignal("");
    const [pagina, setPagina] = createSignal<Pagina<CuentaAdmin>>();
    const [cargando, setCargando] = createSignal(false);
    const [error, setError] = createSignal("");

    async function cargar(numero = 1) {
        const p = new URLSearchParams({ pagina: String(numero), tamano: String(TAMANO) });
        if (q().trim()) p.set("q", q().trim());
        if (estado()) p.set("habilitada", estado());
        setCargando(true);
        try {
            const nueva = await api.get<Pagina<CuentaAdmin>>(`/admin/cuentas?${p}`);
            setPagina(numero === 1 ? nueva : { ...nueva, items: [...(pagina()?.items ?? []), ...nueva.items] });
            setError("");
        } catch (err) {
            setError(err instanceof ErrorCliente ? err.message : "No pudimos cargar las cuentas. Intenta de nuevo.");
        } finally {
            setCargando(false);
        }
    }

    // La búsqueda se aplica sola al dejar de escribir.
    let espera: ReturnType<typeof setTimeout> | undefined;
    const buscar = (texto: string) => {
        setQ(texto);
        clearTimeout(espera);
        espera = setTimeout(() => void cargar(), 350);
    };
    onCleanup(() => clearTimeout(espera));

    // Regla de diseno.md §3: los datos se piden desde el navegador.
    onMount(() => cargar());

    return (
        <div class="admin-cuentas">
            <div class="admin-barra">
                <h2>Cuentas de productores</h2>
                <button type="button" onClick={() => props.alRegistrar()}>
                    <UserPlus size={18} aria-hidden="true" /> Registrar productor
                </button>
            </div>

            <div class="admin-filtros" role="search">
                <label class="selector-terreno admin-busqueda">
                    <span>Buscar por nombre o correo</span>
                    <input type="search" value={q()} onInput={(e) => buscar(e.currentTarget.value)} placeholder="Ej.: María o maria@correo.cl" />
                </label>
                <label class="selector-terreno">
                    <span>Estado</span>
                    <select value={estado()} onChange={(e) => { setEstado(e.currentTarget.value); void cargar(); }}>
                        <option value="">Todas</option>
                        <option value="true">Habilitadas</option>
                        <option value="false">Deshabilitadas</option>
                    </select>
                </label>
            </div>

            <Show when={error()}>
                <p class="form-error" role="alert">{error()}</p>
            </Show>

            <Show when={pagina()} fallback={<p class="admin-nota">Cargando cuentas…</p>}>
                {(p) => (
                    <Show
                        when={p().items.length > 0}
                        fallback={<EstadoVacio icono={Users} titulo="No hay cuentas con estos filtros." texto="Prueba con otra búsqueda o registra un productor." />}
                    >
                        <p class="admin-nota" aria-live="polite">
                            Mostrando {p().items.length} de {p().total} {p().total === 1 ? "cuenta" : "cuentas"}.
                        </p>
                        <ul class="admin-lista">
                            <For each={p().items}>
                                {(c) => (
                                    <li class="admin-item">
                                        <div class="admin-item-texto">
                                            <p class="admin-item-titulo">
                                                {c.nombre} {c.apellido}
                                            </p>
                                            <p class="admin-nota">
                                                {c.correo}
                                                <Show when={c.empresa}>
                                                    {(e) => (
                                                        <>
                                                            {" "}· {e().nombre} (RUT {formatearRut(e().rut)})
                                                        </>
                                                    )}
                                                </Show>
                                            </p>
                                            <InsigniasCuenta cuenta={c} />
                                        </div>
                                        <button type="button" class="boton-secundario" onClick={() => props.alVer(c.id)}>
                                            Ver detalle<span class="sr-only"> de {c.nombre} {c.apellido}</span>
                                        </button>
                                    </li>
                                )}
                            </For>
                        </ul>
                        <Show when={p().items.length < p().total}>
                            <button type="button" class="boton-secundario" disabled={cargando()} onClick={() => cargar(p().pagina + 1)}>
                                {cargando() ? "Cargando…" : "Ver más cuentas"}
                            </button>
                        </Show>
                    </Show>
                )}
            </Show>
        </div>
    );
}
