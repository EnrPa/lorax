import { createEffect, createSignal, For, on, onCleanup, onMount, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import { A, useLocation } from "@solidjs/router";
import LogOut from "lucide-solid/icons/log-out";
import Menu from "lucide-solid/icons/menu";
import X from "lucide-solid/icons/x";
import Layers from "lucide-solid/icons/layers";
import { useSession } from "~/contexts/session";
import { noLeidas, refrescarNoLeidas } from "~/core/noLeidas";
import { inicioDe } from "~/lib/rutas";
import type { Rol } from "~/lib/sesion";
import { AppRoute, routes, visibleFor } from "~/routes";
import "../styles/Sidebar.css";

function Brand(props: { rol: Rol | undefined }) {
    return (
        <A href={props.rol ? inicioDe(props.rol) : "/"} class="brand" end>
            <Layers size={22} aria-hidden="true" />
            <span>LoRax</span>
        </A>
    );
}

function Section(props: { at: AppRoute["location"]; rol: Rol | undefined }) {
    return (
        <ul class={`routes ${props.at}`}>
            <For each={routes}>
                {(r) => (
                    <Show when={r.location == props.at && visibleFor(r, props.rol)}>
                        <li class="route">
                            <A
                                href={r.route}
                                class="sidebar-link"
                                title={r.description}
                                end={r.route === "/"}
                            >
                                <Dynamic component={r.icon} size={20} aria-hidden="true" />
                                <span>{r.title}</span>
                                {/* RF06.10: indicador de alertas no leídas. El número es texto, no solo color. */}
                                <Show when={r.route === "/alertas" && (noLeidas() ?? 0) > 0}>
                                    <span class="contador-menu" aria-hidden="true">{noLeidas()}</span>
                                    <span class="sr-only">, {noLeidas()} sin leer</span>
                                </Show>
                            </A>
                        </li>
                    </Show>
                )}
            </For>
        </ul>
    );
}

export default function Sidebar() {
    const { cuenta, cerrarSesion } = useSession();
    const rol = () => cuenta()?.rol;
    const location = useLocation();
    const [open, setOpen] = createSignal(false);

    // Al navegar se cierra el menú en celular.
    createEffect(on(() => location.pathname, () => setOpen(false), { defer: true }));

    // Alertas no leídas: solo el productor; al cargar, al navegar y cada 60 s.
    createEffect(
        on([rol, () => location.pathname], ([r]) => {
            if (r === "PRODUCTOR") void refrescarNoLeidas();
        }),
    );
    onMount(() => {
        const intervalo = setInterval(() => rol() === "PRODUCTOR" && void refrescarNoLeidas(), 60_000);
        onCleanup(() => clearInterval(intervalo));
    });

    onMount(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("keydown", onKey);
        onCleanup(() => document.removeEventListener("keydown", onKey));
    });

    return (
        <>
            <header class="topbar">
                <Brand rol={rol()} />
                <button
                    class="menu-toggle"
                    aria-label="Abrir menú"
                    aria-expanded={open()}
                    aria-controls="menu-principal"
                    onClick={() => setOpen(true)}
                >
                    <Menu size={26} aria-hidden="true" />
                </button>
            </header>

            <Show when={open()}>
                <div class="sidebar-backdrop" onClick={() => setOpen(false)} />
            </Show>

            <nav id="menu-principal" class="sidebar" classList={{ open: open() }} aria-label="Menú principal">
                <div class="sidebar-header">
                    <Brand rol={rol()} />
                    <button
                        class="menu-toggle sidebar-close"
                        aria-label="Cerrar menú"
                        onClick={() => setOpen(false)}
                    >
                        <X size={26} aria-hidden="true" />
                    </button>
                </div>

                <Show when={cuenta()}>
                    {(c) => <p class="sidebar-user">Hola, {c().nombre}</p>}
                </Show>

                <Section at="top" rol={rol()} />
                <Section at="middle" rol={rol()} />
                <Section at="bottom" rol={rol()} />

                <button class="sidebar-logout" onClick={cerrarSesion}>
                    <LogOut size={20} aria-hidden="true" />
                    <span>Cerrar sesión</span>
                </button>
            </nav>
        </>
    );
}
