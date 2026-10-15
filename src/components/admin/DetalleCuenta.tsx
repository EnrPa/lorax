import ArrowLeft from "lucide-solid/icons/arrow-left";
import CircleCheck from "lucide-solid/icons/circle-check";
import CircleOff from "lucide-solid/icons/circle-off";
import Send from "lucide-solid/icons/send";
import { createSignal, For, JSX, onMount, Show } from "solid-js";
import DialogoConfirmacion from "~/components/ui/DialogoConfirmacion";
import Pestanas from "~/components/ui/Pestanas";
import { api, ErrorCliente } from "~/core/api";
import createForm from "~/core/form";
import type { CamposError } from "~/lib/errores-api";
import { esquemaActualizarCuenta, type CuentaAdmin, type DetalleCuentaAdmin } from "~/lib/esquemas/admin";
import { ETIQUETA_CANAL, type CriterioDetalle } from "~/lib/esquemas/criterios";
import { formatearValor } from "~/lib/formato";
import { formatearRut } from "~/lib/rut";
import { camposDeZod } from "~/lib/validacion";
import { variablePorTipo } from "~/lib/variables";
import { InsigniasCuenta } from "./ListaCuentas";
import "../../styles/Admin.css";

type Dialogo =
    | { tipo: "deshabilitarCuenta" }
    | { tipo: "habilitarCuenta" }
    | { tipo: "deshabilitarEstacion"; id: number; nombre: string }
    | { tipo: "eliminarCriterio"; id: number; nombre: string };

const describir = (c: CriterioDetalle) =>
    `${c.etiqueta} de ${c.numeroSerie} ${c.condicion === "SUPERA" ? "supera" : "desciende bajo"} ${formatearValor(c.umbral, c.unidad)}`;

/** Pestaña «Datos»: datos generales editables (RF07.4). La empresa no se cambia. */
function PestanaDatos(props: { cuenta: DetalleCuentaAdmin; alGuardar: (mensaje: string) => void }) {
    const F = createForm("datos-cuenta");
    const [datos, setDatos] = createSignal({
        nombre: props.cuenta.nombre,
        apellido: props.cuenta.apellido,
        correo: props.cuenta.correo,
        telefono: props.cuenta.telefono ?? "",
        cargo: props.cuenta.cargo ?? "",
    });
    const [errores, setErrores] = createSignal<CamposError>({});
    const [errorGeneral, setErrorGeneral] = createSignal("");
    const [guardando, setGuardando] = createSignal(false);
    const cambiar = (c: Partial<ReturnType<typeof datos>>) => setDatos({ ...datos(), ...c });
    const cambiaCorreo = () => datos().correo.trim().toLowerCase() !== props.cuenta.correo;

    const enviar: JSX.EventHandler<HTMLFormElement, SubmitEvent> = async (e) => {
        e.preventDefault();
        setErrorGeneral("");
        const validado = esquemaActualizarCuenta.safeParse(datos());
        if (!validado.success) {
            setErrores(camposDeZod(validado.error));
            return;
        }
        setErrores({});
        setGuardando(true);
        try {
            const anterior = props.cuenta.correo;
            const actualizada = await api.patch<CuentaAdmin>(`/admin/cuentas/${props.cuenta.id}`, validado.data);
            // El mensaje lo muestra el detalle: esta pestaña se vuelve a montar al recargar la cuenta.
            props.alGuardar(
                actualizada.correo !== anterior
                    ? `Los datos se guardaron. Enviamos un aviso del cambio a ${anterior}.`
                    : "Los datos se guardaron.",
            );
        } catch (err) {
            if (err instanceof ErrorCliente && Object.keys(err.campos).length) setErrores(err.campos);
            else setErrorGeneral(err instanceof ErrorCliente ? err.message : "No pudimos guardar. Intenta de nuevo.");
        } finally {
            setGuardando(false);
        }
    };

    return (
        <F.Form onSubmit={enviar} noValidate class="admin-form">
            <F.ErrorGeneral mensaje={errorGeneral()} />
            <div class="admin-fila">
                <F.Text name="nombre" label="Nombre" placeholder="Nombre" value={datos().nombre} onInput={(e) => cambiar({ nombre: e.currentTarget.value })} error={errores().nombre} />
                <F.Text name="apellido" label="Apellido" placeholder="Apellido" value={datos().apellido} onInput={(e) => cambiar({ apellido: e.currentTarget.value })} error={errores().apellido} />
            </div>
            <F.Email name="correo" label="Correo" value={datos().correo} onInput={(e) => cambiar({ correo: e.currentTarget.value })} error={errores().correo} />
            <Show when={cambiaCorreo()}>
                <p class="admin-nota">Al guardar, enviaremos un aviso del cambio al correo anterior ({props.cuenta.correo}).</p>
            </Show>
            <div class="admin-fila">
                <F.Text name="telefono" label="Teléfono (opcional)" placeholder="+56912345678" inputmode="tel" value={datos().telefono} onInput={(e) => cambiar({ telefono: e.currentTarget.value })} error={errores().telefono} />
                <F.Text name="cargo" label="Cargo (opcional)" placeholder="Cargo" value={datos().cargo} onInput={(e) => cambiar({ cargo: e.currentTarget.value })} error={errores().cargo} />
            </div>
            <Show when={props.cuenta.empresa}>
                {(e) => (
                    <dl class="ajustes-solo-lectura">
                        <div>
                            <dt>Empresa</dt>
                            <dd>
                                {e().nombre} · RUT {formatearRut(e().rut)}
                            </dd>
                        </div>
                    </dl>
                )}
            </Show>
            <F.Submit name="Guardar cambios" class="admin-submit" guardando={guardando()} />
        </F.Form>
    );
}

/** Detalle de una cuenta: datos, terrenos y estaciones, y umbrales. Sin mediciones (RF07.5). */
export default function DetalleCuenta(props: { cuentaId: number; alVolver: () => void; mensajeInicial?: string }) {
    const [cuenta, setCuenta] = createSignal<DetalleCuentaAdmin>();
    const [error, setError] = createSignal("");
    const [confirmacion, setConfirmacion] = createSignal(props.mensajeInicial ?? "");
    const [dialogo, setDialogo] = createSignal<Dialogo | null>(null);
    const [reenviando, setReenviando] = createSignal(false);
    let mensaje: HTMLParagraphElement | undefined;

    async function cargar() {
        try {
            setCuenta(await api.get<DetalleCuentaAdmin>(`/admin/cuentas/${props.cuentaId}`));
            setError("");
        } catch (err) {
            setError(err instanceof ErrorCliente ? err.message : "No pudimos cargar la cuenta. Intenta de nuevo.");
        }
    }
    // Regla de diseno.md §3: los datos se piden desde el navegador.
    onMount(cargar);

    const reenviar = async () => {
        setReenviando(true);
        try {
            await api.post(`/admin/cuentas/${props.cuentaId}/reenviar-activacion`, {});
            setConfirmacion(`Enviamos un nuevo enlace de activación a ${cuenta()!.correo}. Los enlaces anteriores ya no sirven.`);
        } catch (err) {
            setError(err instanceof ErrorCliente ? err.message : "No pudimos reenviar el enlace. Intenta de nuevo.");
        } finally {
            setReenviando(false);
        }
    };

    /** Ejecuta la operación del diálogo; los errores se muestran dentro del diálogo. */
    async function confirmar(motivo: string) {
        const d = dialogo()!;
        const c = cuenta()!;
        const conMotivo = motivo ? { motivo } : {};
        if (d.tipo === "deshabilitarCuenta") await api.post(`/admin/cuentas/${c.id}/habilitacion`, { habilitada: false, motivo });
        if (d.tipo === "habilitarCuenta") await api.post(`/admin/cuentas/${c.id}/habilitacion`, { habilitada: true, ...conMotivo });
        if (d.tipo === "deshabilitarEstacion") await api.post(`/admin/estaciones/${d.id}/deshabilitar`, { motivo });
        if (d.tipo === "eliminarCriterio") await api.post(`/admin/criterios/${d.id}/eliminar`, { motivo });
        const mensajes: Record<Dialogo["tipo"], string> = {
            deshabilitarCuenta: "La cuenta quedó deshabilitada y se cerraron sus sesiones abiertas.",
            habilitarCuenta: "La cuenta quedó habilitada.",
            deshabilitarEstacion: "La estación quedó deshabilitada. Su historial se conserva.",
            eliminarCriterio: "El umbral se eliminó. Sus alertas se conservan.",
        };
        setConfirmacion(mensajes[d.tipo]);
        await cargar();
        // El botón que abrió el diálogo puede haber cambiado: el foco va al mensaje de confirmación.
        setTimeout(() => mensaje?.focus(), 0);
    }

    const textoDialogo = () => {
        const d = dialogo();
        const c = cuenta();
        if (!d || !c) return null;
        const nombre = `${c.nombre} ${c.apellido}`;
        switch (d.tipo) {
            case "deshabilitarCuenta":
                return { titulo: "Deshabilitar cuenta", accion: "Deshabilitar cuenta", obligatorio: true, peligro: true, descripcion: `${nombre} no podrá iniciar sesión y se cerrarán sus sesiones abiertas. Sus datos se conservan.` };
            case "habilitarCuenta":
                return { titulo: "Habilitar cuenta", accion: "Habilitar cuenta", obligatorio: false, peligro: false, descripcion: `${nombre} podrá volver a iniciar sesión.` };
            case "deshabilitarEstacion":
                return { titulo: "Deshabilitar estación", accion: "Deshabilitar estación", obligatorio: true, peligro: true, descripcion: `La estación ${d.nombre} dejará de aceptar lecturas. Su historial se conserva.` };
            case "eliminarCriterio":
                return { titulo: "Eliminar umbral", accion: "Eliminar umbral", obligatorio: true, peligro: true, descripcion: `«${d.nombre}» dejará de evaluarse. Sus alertas se conservan y la vigente, si hay, se marcará como resuelta.` };
        }
    };

    return (
        <div class="admin-detalle">
            <button type="button" class="boton-secundario" onClick={() => props.alVolver()}>
                <ArrowLeft size={18} aria-hidden="true" /> Volver a las cuentas
            </button>
            <Show when={error()}>
                <p class="form-error" role="alert">{error()}</p>
            </Show>
            <Show when={cuenta()} fallback={<p class="admin-nota">{error() ? "" : "Cargando la cuenta…"}</p>}>
                {(c) => (
                    <>
                        <header class="admin-detalle-encabezado">
                            <div>
                                <h2>
                                    {c().nombre} {c().apellido}
                                </h2>
                                <p class="admin-nota">{c().correo}</p>
                                <InsigniasCuenta cuenta={c()} />
                            </div>
                            <div class="admin-acciones">
                                <Show when={c().pendienteActivacion}>
                                    <button type="button" class="boton-secundario" disabled={reenviando()} onClick={reenviar}>
                                        <Send size={18} aria-hidden="true" /> {reenviando() ? "Enviando…" : "Reenviar enlace de activación"}
                                    </button>
                                </Show>
                                <Show
                                    when={c().habilitada}
                                    fallback={
                                        <button type="button" onClick={() => setDialogo({ tipo: "habilitarCuenta" })}>
                                            Habilitar cuenta
                                        </button>
                                    }
                                >
                                    <button type="button" class="boton-peligro" onClick={() => setDialogo({ tipo: "deshabilitarCuenta" })}>
                                        Deshabilitar cuenta
                                    </button>
                                </Show>
                            </div>
                        </header>

                        <Show when={confirmacion()}>
                            <p class="form-ok" role="status" tabindex="-1" ref={mensaje}>
                                <CircleCheck size={18} aria-hidden="true" />
                                <span>{confirmacion()}</span>
                            </p>
                        </Show>

                        <Pestanas
                            id="detalle-cuenta"
                            etiqueta="Secciones de la cuenta"
                            pestanas={[
                                { id: "datos", titulo: "Datos", contenido: () => (
                                        <PestanaDatos
                                            cuenta={c()}
                                            alGuardar={(mensaje) => {
                                                setConfirmacion(mensaje);
                                                void cargar();
                                            }}
                                        />
                                    ),
                                },
                                {
                                    id: "terrenos",
                                    titulo: "Terrenos y estaciones",
                                    contenido: () => (
                                        <Show when={c().terrenos.length > 0} fallback={<p class="admin-nota">Esta cuenta aún no tiene terrenos.</p>}>
                                            <For each={c().terrenos}>
                                                {(t) => (
                                                    <article class="admin-terreno" aria-label={t.nombre}>
                                                        <h3>{t.nombre}</h3>
                                                        <ul class="admin-lista">
                                                            <For each={t.estaciones}>
                                                                {(e) => (
                                                                    <li class="admin-item">
                                                                        <div class="admin-item-texto">
                                                                            <p class="admin-item-titulo">
                                                                                {e.numeroSerie} <span class="admin-nota">· {e.tipo} · {e.modelo}</span>
                                                                            </p>
                                                                            <p class="admin-nota">{e.sensores.map((s) => variablePorTipo(s.tipo)?.etiqueta ?? s.tipo).join(" · ")}</p>
                                                                            <Show
                                                                                when={e.habilitada}
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
                                                                        </div>
                                                                        <Show when={e.habilitada}>
                                                                            <button
                                                                                type="button"
                                                                                class="boton-secundario"
                                                                                onClick={() => setDialogo({ tipo: "deshabilitarEstacion", id: e.id, nombre: e.numeroSerie })}
                                                                            >
                                                                                Deshabilitar estación
                                                                            </button>
                                                                        </Show>
                                                                    </li>
                                                                )}
                                                            </For>
                                                        </ul>
                                                    </article>
                                                )}
                                            </For>
                                        </Show>
                                    ),
                                },
                                {
                                    id: "umbrales",
                                    titulo: "Umbrales",
                                    contenido: () => (
                                        <Show when={c().criterios.length > 0} fallback={<p class="admin-nota">Esta cuenta no tiene umbrales configurados.</p>}>
                                            <ul class="admin-lista">
                                                <For each={c().criterios}>
                                                    {(cr) => (
                                                        <li class="admin-item">
                                                            <div class="admin-item-texto">
                                                                <p class="admin-item-titulo">{describir(cr)}</p>
                                                                <p class="admin-nota">
                                                                    {cr.terreno.nombre} ·{" "}
                                                                    {cr.canales.length ? `Aviso: ${cr.canales.map((x) => ETIQUETA_CANAL[x]).join(", ")}` : "Sin avisos"} ·{" "}
                                                                    {cr.habilitado ? "Habilitado" : "Deshabilitado"}
                                                                </p>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                class="boton-secundario"
                                                                onClick={() => setDialogo({ tipo: "eliminarCriterio", id: cr.id, nombre: describir(cr) })}
                                                            >
                                                                Eliminar umbral
                                                            </button>
                                                        </li>
                                                    )}
                                                </For>
                                            </ul>
                                        </Show>
                                    ),
                                },
                            ]}
                        />
                    </>
                )}
            </Show>

            <Show when={textoDialogo()}>
                {(t) => (
                    <DialogoConfirmacion
                        abierto={dialogo() !== null}
                        titulo={t().titulo}
                        descripcion={t().descripcion}
                        accion={t().accion}
                        motivoObligatorio={t().obligatorio}
                        peligro={t().peligro}
                        alConfirmar={confirmar}
                        alCerrar={() => setDialogo(null)}
                    />
                )}
            </Show>
        </div>
    );
}
