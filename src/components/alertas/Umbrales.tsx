import CircleCheck from "lucide-solid/icons/circle-check";
import CircleOff from "lucide-solid/icons/circle-off";
import Info from "lucide-solid/icons/info";
import SlidersHorizontal from "lucide-solid/icons/sliders-horizontal";
import { createMemo, createSignal, For, JSX, onMount, Show } from "solid-js";
import EstadoVacio from "~/components/ui/EstadoVacio";
import { api, ErrorCliente } from "~/core/api";
import createForm from "~/core/form";
import type { CamposError } from "~/lib/errores-api";
import type { Perfil } from "~/lib/esquemas/cuenta";
import {
    AVISO_SIN_CANALES,
    AVISO_SIN_TELEFONO,
    CANALES,
    ETIQUETA_CANAL,
    esquemaFormularioCriterio,
    mensajeFueraDeRango,
    type Canal,
    type CriterioDetalle,
    type LecturasRecientes,
} from "~/lib/esquemas/criterios";
import type { Pagina } from "~/lib/esquemas/paginacion";
import type { TerrenoDetalle } from "~/lib/esquemas/terrenos";
import { fechaRelativa } from "~/lib/fechas";
import { formatearValor } from "~/lib/formato";
import { camposDeZod } from "~/lib/validacion";
import { variablePorTipo } from "~/lib/variables";
import "../../styles/Alertas.css";

/** «Humedad del suelo de EST-0001 desciende bajo 25 %». */
function describir(c: CriterioDetalle): string {
    const verbo = c.condicion === "SUPERA" ? "supera" : "desciende bajo";
    return `${c.etiqueta} de ${c.numeroSerie} ${verbo} ${formatearValor(c.umbral, c.unidad)}`;
}

/** Formulario «Nuevo umbral» (RF06.1 a RF06.3). */
function NuevoUmbral(props: { terrenos: TerrenoDetalle[]; alGuardar: (c: CriterioDetalle) => void }) {
    const F = createForm("nuevo-umbral");
    const [terrenoId, setTerrenoId] = createSignal(props.terrenos[0]?.id);
    const [sensorId, setSensorId] = createSignal<number>();
    const [referencia, setReferencia] = createSignal<LecturasRecientes>();
    const [umbral, setUmbral] = createSignal("");
    const [condicion, setCondicion] = createSignal<"SUPERA" | "DESCIENDE">("DESCIENDE");
    const [canales, setCanales] = createSignal<Canal[]>(["PLATAFORMA"]);
    const [errores, setErrores] = createSignal<CamposError>({});
    const [errorGeneral, setErrorGeneral] = createSignal("");
    const [guardando, setGuardando] = createSignal(false);
    const [sinTelefono, setSinTelefono] = createSignal(false);

    /** Sensores del terreno elegido, como «EST-0001 · Humedad del suelo». */
    const sensores = createMemo(() => {
        const t = props.terrenos.find((x) => x.id === terrenoId());
        return (t?.estaciones ?? []).flatMap((e) =>
            e.sensores.map((s) => ({ id: s.id, texto: `${e.numeroSerie} · ${variablePorTipo(s.tipo)?.etiqueta ?? s.tipo}` })),
        );
    });

    // RF06.1: al elegir el sensor se muestran su unidad y sus últimas 5 lecturas.
    async function elegirSensor(id: number | undefined) {
        setSensorId(id);
        setReferencia(undefined);
        if (id === undefined) return;
        try {
            setReferencia(await api.get<LecturasRecientes>(`/sensores/${id}/lecturas-recientes`));
        } catch (err) {
            setErrorGeneral(err instanceof ErrorCliente ? err.message : "No pudimos cargar las lecturas del sensor.");
        }
    }

    onMount(() => {
        void elegirSensor(sensores()[0]?.id);
        // Si no se puede saber, no se avisa: el aviso es solo una ayuda.
        api.get<Perfil>("/cuenta")
            .then((p) => setSinTelefono(!p.telefono))
            .catch(() => {});
    });

    const avisoTelefono = () => sinTelefono() && canales().some((c) => c === "SMS" || c === "WHATSAPP");

    const alternarCanal = (canal: Canal, marcado: boolean) =>
        setCanales(marcado ? [...canales(), canal] : canales().filter((c) => c !== canal));

    const enviar: JSX.EventHandler<HTMLFormElement, SubmitEvent> = async (e) => {
        e.preventDefault();
        setErrorGeneral("");
        const validado = esquemaFormularioCriterio.safeParse({
            sensorId: sensorId() ?? "",
            umbral: umbral(),
            condicion: condicion(),
            canales: canales(),
        });
        if (!validado.success) {
            setErrores(camposDeZod(validado.error));
            return;
        }
        // RF06.2 en el navegador; el servidor lo vuelve a validar.
        const ref = referencia();
        if (ref && (validado.data.umbral < ref.rangoMinimo || validado.data.umbral > ref.rangoMaximo)) {
            setErrores({ umbral: mensajeFueraDeRango(ref.rangoMinimo, ref.rangoMaximo, ref.unidad) });
            return;
        }
        setErrores({});
        setGuardando(true);
        try {
            props.alGuardar(await api.post<CriterioDetalle>("/criterios", validado.data));
            setUmbral("");
        } catch (err) {
            if (err instanceof ErrorCliente && Object.keys(err.campos).length) setErrores(err.campos);
            else setErrorGeneral(err instanceof ErrorCliente ? err.message : "No pudimos guardar el umbral. Intenta de nuevo.");
        } finally {
            setGuardando(false);
        }
    };

    return (
        <F.Form title="Nuevo umbral" onSubmit={enviar} noValidate class="umbral-form">
            <F.ErrorGeneral mensaje={errorGeneral()} />
            <div class="umbral-fila">
                <label class="selector-terreno">
                    <span>Terreno</span>
                    <select
                        value={terrenoId()}
                        onChange={(e) => {
                            setTerrenoId(Number(e.currentTarget.value));
                            void elegirSensor(sensores()[0]?.id);
                        }}
                    >
                        <For each={props.terrenos}>{(t) => <option value={t.id}>{t.nombre}</option>}</For>
                    </select>
                </label>
                <label class="selector-terreno">
                    <span>Sensor</span>
                    <select value={sensorId()} onChange={(e) => void elegirSensor(Number(e.currentTarget.value))}>
                        <For each={sensores()}>{(s) => <option value={s.id}>{s.texto}</option>}</For>
                    </select>
                </label>
            </div>

            <Show when={referencia()}>
                {(ref) => (
                    <div class="umbral-referencia">
                        <p>
                            <strong>{ref().etiqueta}</strong> se mide en <strong>{ref().unidad}</strong>. Valores posibles:{" "}
                            {formatearValor(ref().rangoMinimo, ref().unidad)} a {formatearValor(ref().rangoMaximo, ref().unidad)}.
                        </p>
                        <Show when={ref().lecturas.length > 0} fallback={<p>Este sensor aún no tiene lecturas.</p>}>
                            <p>Últimas lecturas:</p>
                            <ul>
                                <For each={ref().lecturas}>
                                    {(l) => (
                                        <li>
                                            <strong>{formatearValor(l.valor, ref().unidad)}</strong>{" "}
                                            <span>{fechaRelativa(l.fecha, new Date())}</span>
                                        </li>
                                    )}
                                </For>
                            </ul>
                        </Show>
                    </div>
                )}
            </Show>

            <F.Opciones
                name="condicion"
                leyenda="Avisarme cuando el valor"
                valor={condicion()}
                alCambiar={(v) => setCondicion(v as "SUPERA" | "DESCIENDE")}
                opciones={[
                    { valor: "SUPERA", etiqueta: "Supera" },
                    { valor: "DESCIENDE", etiqueta: "Desciende bajo" },
                ]}
                error={errores().condicion}
            />
            <F.Decimal
                name="umbral"
                label={`Umbral${referencia() ? ` (${referencia()!.unidad})` : ""}`}
                placeholder="Ej.: 25"
                value={umbral()}
                onInput={(e) => setUmbral(e.currentTarget.value)}
                error={errores().umbral}
            />

            <fieldset class="umbral-canales">
                <legend>¿Cómo quieres recibir el aviso?</legend>
                <For each={CANALES}>
                    {(canal) => (
                        <F.Checkbox
                            name={`canal-${canal}`}
                            description={ETIQUETA_CANAL[canal]}
                            checked={canales().includes(canal)}
                            onChange={(e) => alternarCanal(canal, e.currentTarget.checked)}
                        />
                    )}
                </For>
                {/* RF06.3: se advierte, pero igual se puede guardar. */}
                <Show when={canales().length === 0}>
                    <p class="umbral-aviso" role="status">
                        <Info size={18} aria-hidden="true" />
                        <span>{AVISO_SIN_CANALES}</span>
                    </p>
                </Show>
                <Show when={avisoTelefono()}>
                    <p class="umbral-aviso" role="status">
                        <Info size={18} aria-hidden="true" />
                        <span>
                            {AVISO_SIN_TELEFONO}. <a href="/ajustes">Ir a Ajustes</a>
                        </span>
                    </p>
                </Show>
            </fieldset>

            <F.Submit name="Guardar umbral" class="umbral-submit" guardando={guardando()} />
        </F.Form>
    );
}

/** Un umbral de la lista, con habilitar o deshabilitar y eliminar (RF06.4). */
function ItemUmbral(props: { criterio: CriterioDetalle; alCambiar: () => void; alError: (m: string) => void }) {
    const c = () => props.criterio;
    const [confirmando, setConfirmando] = createSignal(false);
    const [ocupado, setOcupado] = createSignal(false);

    async function ejecutar(accion: () => Promise<unknown>) {
        setOcupado(true);
        try {
            await accion();
            props.alCambiar();
        } catch (err) {
            props.alError(err instanceof ErrorCliente ? err.message : "No pudimos guardar el cambio. Intenta de nuevo.");
        } finally {
            setOcupado(false);
            setConfirmando(false);
        }
    }

    return (
        <li class="umbral" classList={{ "umbral-deshabilitado": !c().habilitado }}>
            <div class="umbral-texto">
                <p class="umbral-descripcion">{describir(c())}</p>
                <p class="umbral-detalle">
                    {c().terreno.nombre} ·{" "}
                    {c().canales.length ? `Aviso: ${c().canales.map((x) => ETIQUETA_CANAL[x]).join(", ")}` : "Sin avisos: solo queda registrada"}
                </p>
            </div>
            <span class={`insignia-estado ${c().habilitado ? "insignia-normal" : "insignia-sin-datos"}`}>
                {c().habilitado ? <CircleCheck size={16} aria-hidden="true" /> : <CircleOff size={16} aria-hidden="true" />}
                <span>{c().habilitado ? "Habilitado" : "Deshabilitado"}</span>
            </span>
            <div class="umbral-acciones">
                <Show
                    when={!confirmando()}
                    fallback={
                        <>
                            <span>¿Eliminar este umbral?</span>
                            <button type="button" class="boton-peligro" disabled={ocupado()} onClick={() => ejecutar(() => api.delete(`/criterios/${c().id}`))}>
                                Sí, eliminar
                            </button>
                            <button type="button" class="boton-secundario" onClick={() => setConfirmando(false)}>
                                Cancelar
                            </button>
                        </>
                    }
                >
                    <button
                        type="button"
                        class="boton-secundario"
                        disabled={ocupado()}
                        onClick={() => ejecutar(() => api.patch(`/criterios/${c().id}`, { habilitado: !c().habilitado }))}
                    >
                        {c().habilitado ? "Deshabilitar" : "Habilitar"}
                    </button>
                    <button type="button" class="boton-secundario" onClick={() => setConfirmando(true)}>
                        Eliminar
                    </button>
                </Show>
            </div>
        </li>
    );
}

/** Pestaña «Umbrales». */
export default function Umbrales(props: { terrenos: TerrenoDetalle[] }) {
    const F = createForm("umbrales");
    const [criterios, setCriterios] = createSignal<CriterioDetalle[]>();
    const [confirmacion, setConfirmacion] = createSignal("");
    const [error, setError] = createSignal("");

    async function cargar() {
        try {
            setCriterios((await api.get<Pagina<CriterioDetalle>>("/criterios?tamano=100")).items);
        } catch (err) {
            setError(err instanceof ErrorCliente ? err.message : "No pudimos cargar tus umbrales. Recarga la página.");
        }
    }
    onMount(cargar);

    return (
        <div class="umbrales">
            <Show
                when={props.terrenos.some((t) => t.estaciones.some((e) => e.sensores.length > 0))}
                fallback={<p class="alertas-nota">Para crear un umbral, primero registra un terreno con su estación en Ajustes.</p>}
            >
                <NuevoUmbral
                    terrenos={props.terrenos}
                    alGuardar={(c) => {
                        setConfirmacion(`Se guardó el umbral: ${describir(c)}.`);
                        void cargar();
                    }}
                />
            </Show>

            <section aria-labelledby="titulo-umbrales" class="umbrales-lista">
                <h2 id="titulo-umbrales">Mis umbrales</h2>
                <F.Confirmacion mensaje={confirmacion()} />
                <Show when={error()}>
                    <p class="form-error" role="alert">{error()}</p>
                </Show>
                <Show when={criterios()} fallback={<p class="alertas-nota">Cargando tus umbrales…</p>}>
                    {(lista) => (
                        <Show
                            when={lista().length > 0}
                            fallback={
                                <EstadoVacio
                                    icono={SlidersHorizontal}
                                    titulo="Aún no tienes umbrales. Crea el primero."
                                    texto="Un umbral te avisa cuando una variable pasa del valor que elijas."
                                />
                            }
                        >
                            <ul class="umbrales-items">
                                <For each={lista()}>
                                    {(c) => (
                                        <ItemUmbral
                                            criterio={c}
                                            alCambiar={() => { setConfirmacion(""); void cargar(); }}
                                            alError={setError}
                                        />
                                    )}
                                </For>
                            </ul>
                        </Show>
                    )}
                </Show>
            </section>
        </div>
    );
}
