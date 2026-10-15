import CircleAlert from "lucide-solid/icons/circle-alert";
import CircleCheck from "lucide-solid/icons/circle-check";
import CircleOff from "lucide-solid/icons/circle-off";
import MapPinned from "lucide-solid/icons/map-pinned";
import Plus from "lucide-solid/icons/plus";
import { createSignal, For, JSX, onMount, Show } from "solid-js";
import EstadoVacio from "~/components/ui/EstadoVacio";
import { api, ErrorCliente } from "~/core/api";
import createForm from "~/core/form";
import type { CamposError } from "~/lib/errores-api";
import type { Pagina } from "~/lib/esquemas/paginacion";
import {
    esquemaFormularioEstacion,
    esquemaFormularioTerreno,
    type EstacionDetalle,
    type TerrenoDetalle,
} from "~/lib/esquemas/terrenos";
import { camposDeZod } from "~/lib/validacion";
import { VARIABLES, variablePorTipo } from "~/lib/variables";
import "../../styles/Terrenos.css";

// Pestaña «Terrenos y estaciones» de Ajustes (RF02). Solo para el productor.

const coordenada = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 5 });
const hectareas = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 });

/** Antepone un prefijo a las claves de los errores de Zod («nombre» → «terreno.nombre»). */
function conPrefijo(campos: CamposError, prefijo: string): CamposError {
    return Object.fromEntries(Object.entries(campos).map(([clave, mensaje]) => [prefijo + clave, mensaje]));
}

// ——— Campos de la estación, compartidos por «Registrar terreno» y «Agregar estación» ———

interface EstadoEstacion {
    tipo: string;
    modelo: string;
    numeroSerie: string;
    latitud: string;
    longitud: string;
    sensores: string[];
}

const estacionVacia = (): EstadoEstacion => ({
    tipo: "",
    modelo: "",
    numeroSerie: "",
    latitud: "",
    longitud: "",
    // RF02.3: los 6 sensores estándar marcados por defecto.
    sensores: VARIABLES.map((v) => v.tipo),
});

function CamposEstacion(props: {
    formulario: ReturnType<typeof createForm>;
    estado: EstadoEstacion;
    cambiar: (cambios: Partial<EstadoEstacion>) => void;
    errores: CamposError;
    /** Prefijo de las claves de error («estacion.» al registrar un terreno; vacío al agregar una estación). */
    prefijo: string;
}) {
    const F = props.formulario;
    const error = (campo: string) => props.errores[props.prefijo + campo];
    const alternar = (tipo: string, marcado: boolean) =>
        props.cambiar({
            sensores: marcado ? [...props.estado.sensores, tipo] : props.estado.sensores.filter((t) => t !== tipo),
        });

    return (
        <>
            <F.Text
                name="tipo"
                label="Tipo de estación"
                placeholder="Ej.: Estación de terreno"
                value={props.estado.tipo}
                onInput={(e) => props.cambiar({ tipo: e.currentTarget.value })}
                error={error("tipo")}
            />
            <F.Text
                name="modelo"
                label="Modelo"
                placeholder="Ej.: LX-100"
                value={props.estado.modelo}
                onInput={(e) => props.cambiar({ modelo: e.currentTarget.value })}
                error={error("modelo")}
            />
            <F.Text
                name="numeroSerie"
                label="Número de serie"
                placeholder="Está en la etiqueta de la estación, ej.: EST-0009"
                autocomplete="off"
                value={props.estado.numeroSerie}
                onInput={(e) => props.cambiar({ numeroSerie: e.currentTarget.value })}
                error={error("numeroSerie")}
            />
            <fieldset class="terreno-coordenadas">
                <legend>Ubicación de la estación (opcional)</legend>
                <p class="field-help">Si la dejas vacía, usamos la ubicación del terreno.</p>
                <div class="terreno-coordenadas-campos">
                    <F.Decimal
                        name="latitud"
                        label="Latitud"
                        placeholder="Ej.: -38,95"
                        value={props.estado.latitud}
                        onInput={(e) => props.cambiar({ latitud: e.currentTarget.value })}
                        error={error("latitud")}
                    />
                    <F.Decimal
                        name="longitud"
                        label="Longitud"
                        placeholder="Ej.: -72,62"
                        value={props.estado.longitud}
                        onInput={(e) => props.cambiar({ longitud: e.currentTarget.value })}
                        error={error("longitud")}
                    />
                </div>
            </fieldset>
            <fieldset class="terreno-sensores" aria-describedby={error("sensores") ? "sensores-error" : undefined}>
                <legend>Sensores de la estación</legend>
                <p class="field-help">Desmarca los que tu estación no tenga. Debe quedar al menos uno.</p>
                <For each={VARIABLES}>
                    {(variable) => (
                        <F.Checkbox
                            name={`sensor-${variable.tipo}`}
                            description={`${variable.etiqueta} (${variable.unidad})`}
                            checked={props.estado.sensores.includes(variable.tipo)}
                            onChange={(e) => alternar(variable.tipo, e.currentTarget.checked)}
                        />
                    )}
                </For>
                <Show when={error("sensores")}>
                    <p id="sensores-error" class="field-error">
                        <CircleAlert size={18} aria-hidden="true" />
                        <span>{error("sensores")}</span>
                    </p>
                </Show>
            </fieldset>
        </>
    );
}

/** Valida en el navegador los campos de la estación; devuelve los datos para la API o los errores. */
function validarEstacion(estado: EstadoEstacion, prefijo: string) {
    const r = esquemaFormularioEstacion.safeParse(estado);
    return r.success ? { datos: r.data, errores: {} } : { datos: null, errores: conPrefijo(camposDeZod(r.error), prefijo) };
}

/** Errores de la API: por campo si los hay; si no, un mensaje general. */
function repartirError(err: unknown, setErrores: (c: CamposError) => void, setGeneral: (m: string) => void) {
    if (err instanceof ErrorCliente && Object.keys(err.campos).length > 0) setErrores(err.campos);
    else setGeneral(err instanceof ErrorCliente ? err.message : "No pudimos guardar. Intenta de nuevo.");
}

// ——— Formulario «Registrar terreno»: terreno + primera estación (RF02.1 a RF02.5) ———

function FormularioTerreno(props: { alGuardar: (terreno: TerrenoDetalle) => void; alCancelar?: () => void }) {
    const F = createForm("nuevo-terreno");
    const [terreno, setTerreno] = createSignal({ nombre: "", latitud: "", longitud: "", superficie: "", tipoCultivo: "" });
    const [estacion, setEstacion] = createSignal(estacionVacia());
    const [errores, setErrores] = createSignal<CamposError>({});
    const [errorGeneral, setErrorGeneral] = createSignal("");
    const [guardando, setGuardando] = createSignal(false);
    const cambiarTerreno = (cambios: Partial<ReturnType<typeof terreno>>) => setTerreno({ ...terreno(), ...cambios });

    const enviar: JSX.EventHandler<HTMLFormElement, SubmitEvent> = async (e) => {
        e.preventDefault();
        setErrorGeneral("");
        const t = esquemaFormularioTerreno.safeParse(terreno());
        const est = validarEstacion(estacion(), "estacion.");
        const erroresTerreno = t.success ? {} : conPrefijo(camposDeZod(t.error), "terreno.");
        setErrores({ ...erroresTerreno, ...est.errores });
        if (!t.success || !est.datos) return;

        setGuardando(true);
        try {
            props.alGuardar(await api.post<TerrenoDetalle>("/terrenos", { terreno: t.data, estacion: est.datos }));
        } catch (err) {
            // RF02.5: lo ya ingresado se conserva; el error queda junto al campo (p. ej. número de serie repetido).
            repartirError(err, setErrores, setErrorGeneral);
        } finally {
            setGuardando(false);
        }
    };

    return (
        <F.Form title="Registrar terreno" onSubmit={enviar} noValidate class="terreno-form">
            <F.ErrorGeneral mensaje={errorGeneral()} />
            <fieldset>
                <legend>Datos del terreno</legend>
                <F.Text
                    name="nombre"
                    label="Nombre del terreno"
                    placeholder="Ej.: Parcela Los Castaños"
                    value={terreno().nombre}
                    onInput={(e) => cambiarTerreno({ nombre: e.currentTarget.value })}
                    error={errores()["terreno.nombre"]}
                />
                <div class="terreno-coordenadas-campos">
                    <F.Decimal
                        name="latitud-terreno"
                        label="Latitud"
                        placeholder="Ej.: -38,95"
                        value={terreno().latitud}
                        onInput={(e) => cambiarTerreno({ latitud: e.currentTarget.value })}
                        error={errores()["terreno.latitud"]}
                    />
                    <F.Decimal
                        name="longitud-terreno"
                        label="Longitud"
                        placeholder="Ej.: -72,62"
                        value={terreno().longitud}
                        onInput={(e) => cambiarTerreno({ longitud: e.currentTarget.value })}
                        error={errores()["terreno.longitud"]}
                    />
                </div>
                <F.Decimal
                    name="superficie"
                    label="Superficie en hectáreas (opcional)"
                    placeholder="Ej.: 12,5"
                    value={terreno().superficie}
                    onInput={(e) => cambiarTerreno({ superficie: e.currentTarget.value })}
                    error={errores()["terreno.superficie"]}
                />
                <F.Text
                    name="tipoCultivo"
                    label="Tipo de cultivo (opcional)"
                    placeholder="Ej.: Arándanos"
                    value={terreno().tipoCultivo}
                    onInput={(e) => cambiarTerreno({ tipoCultivo: e.currentTarget.value })}
                    error={errores()["terreno.tipoCultivo"]}
                />
            </fieldset>
            <fieldset>
                <legend>Estación instalada en el terreno</legend>
                <CamposEstacion
                    formulario={F}
                    estado={estacion()}
                    cambiar={(c) => setEstacion({ ...estacion(), ...c })}
                    errores={errores()}
                    prefijo="estacion."
                />
            </fieldset>
            <div class="terreno-acciones">
                <F.Submit name="Registrar terreno" class="terreno-submit" guardando={guardando()} textoGuardando="Registrando…" />
                <Show when={props.alCancelar}>
                    <button type="button" class="boton-secundario" onClick={() => props.alCancelar?.()}>
                        Cancelar
                    </button>
                </Show>
            </div>
        </F.Form>
    );
}

// ——— Formulario «Agregar estación» a un terreno existente (RF02.6) ———

function FormularioEstacion(props: { terreno: TerrenoDetalle; alGuardar: (t: TerrenoDetalle) => void; alCancelar: () => void }) {
    const F = createForm(`estacion-${props.terreno.id}`);
    const [estacion, setEstacion] = createSignal(estacionVacia());
    const [errores, setErrores] = createSignal<CamposError>({});
    const [errorGeneral, setErrorGeneral] = createSignal("");
    const [guardando, setGuardando] = createSignal(false);

    const enviar: JSX.EventHandler<HTMLFormElement, SubmitEvent> = async (e) => {
        e.preventDefault();
        setErrorGeneral("");
        const est = validarEstacion(estacion(), "");
        setErrores(est.errores);
        if (!est.datos) return;

        setGuardando(true);
        try {
            props.alGuardar(await api.post<TerrenoDetalle>(`/terrenos/${props.terreno.id}/estaciones`, est.datos));
        } catch (err) {
            repartirError(err, setErrores, setErrorGeneral);
        } finally {
            setGuardando(false);
        }
    };

    return (
        <F.Form title={`Agregar estación a ${props.terreno.nombre}`} onSubmit={enviar} noValidate class="terreno-form">
            <F.ErrorGeneral mensaje={errorGeneral()} />
            <CamposEstacion
                formulario={F}
                estado={estacion()}
                cambiar={(c) => setEstacion({ ...estacion(), ...c })}
                errores={errores()}
                prefijo=""
            />
            <div class="terreno-acciones">
                <F.Submit name="Agregar estación" class="terreno-submit" guardando={guardando()} textoGuardando="Agregando…" />
                <button type="button" class="boton-secundario" onClick={() => props.alCancelar()}>
                    Cancelar
                </button>
            </div>
        </F.Form>
    );
}

// ——— Listado (RF02.6) ———

function Estacion(props: { estacion: EstacionDetalle }) {
    return (
        <li class="estacion">
            <div class="estacion-encabezado">
                <strong>{props.estacion.numeroSerie}</strong>
                <span class="estacion-modelo">
                    {props.estacion.tipo} · {props.estacion.modelo}
                </span>
                {/* El estado siempre con ícono y texto, nunca solo con color. */}
                <Show
                    when={props.estacion.habilitada}
                    fallback={
                        <span class="insignia insignia-sin-datos">
                            <CircleOff size={16} aria-hidden="true" /> Deshabilitada
                        </span>
                    }
                >
                    <span class="insignia insignia-normal">
                        <CircleCheck size={16} aria-hidden="true" /> Habilitada
                    </span>
                </Show>
            </div>
            <p class="estacion-sensores">
                <span class="sr-only">Sensores: </span>
                {props.estacion.sensores.map((s) => variablePorTipo(s.tipo)?.etiqueta ?? s.tipo).join(" · ")}
            </p>
        </li>
    );
}

function Terreno(props: { terreno: TerrenoDetalle; alAgregar: () => void }) {
    const t = () => props.terreno;
    return (
        <article class="terreno" aria-labelledby={`terreno-${t().id}`}>
            <h3 id={`terreno-${t().id}`}>{t().nombre}</h3>
            <p class="terreno-datos">
                Ubicación {coordenada.format(t().latitud)}, {coordenada.format(t().longitud)}
                <Show when={t().superficie !== null}> · {hectareas.format(t().superficie!)} ha</Show>
                <Show when={t().tipoCultivo}> · {t().tipoCultivo}</Show>
            </p>
            <h4>
                {t().estaciones.length} {t().estaciones.length === 1 ? "estación" : "estaciones"}
            </h4>
            <ul class="estaciones">
                <For each={t().estaciones}>{(estacion) => <Estacion estacion={estacion} />}</For>
            </ul>
            <button type="button" class="boton-secundario" onClick={() => props.alAgregar()}>
                <Plus size={18} aria-hidden="true" /> Agregar estación
            </button>
        </article>
    );
}

type Modo = { tipo: "lista" } | { tipo: "nuevo" } | { tipo: "agregar"; terreno: TerrenoDetalle };

export default function PestanaTerrenos() {
    const F = createForm("terrenos");
    const [terrenos, setTerrenos] = createSignal<TerrenoDetalle[]>();
    const [errorCarga, setErrorCarga] = createSignal("");
    const [modo, setModo] = createSignal<Modo>({ tipo: "lista" });
    const [confirmacion, setConfirmacion] = createSignal("");

    const cargar = async () => {
        try {
            setTerrenos((await api.get<Pagina<TerrenoDetalle>>("/terrenos?tamano=100")).items);
        } catch (err) {
            setErrorCarga(err instanceof ErrorCliente ? err.message : "No pudimos cargar tus terrenos. Recarga la página.");
        }
    };
    // Regla de diseno.md §3: los datos se piden desde el navegador.
    onMount(cargar);

    const volver = async (mensaje: string) => {
        setModo({ tipo: "lista" });
        setConfirmacion(mensaje);
        await cargar();
    };

    return (
        <section class="terrenos" aria-live="polite">
            <Show when={terrenos()} fallback={<p class="ajustes-cargando">{errorCarga() || "Cargando tus terrenos…"}</p>}>
                {(lista) => (
                    <Show
                        when={modo().tipo === "lista"}
                        fallback={
                            <Show
                                when={(() => { const m = modo(); return m.tipo === "agregar" ? m.terreno : null; })()}
                                fallback={
                                    <FormularioTerreno
                                        alGuardar={(t) => volver(`Se registró el terreno «${t.nombre}».`)}
                                        alCancelar={() => setModo({ tipo: "lista" })}
                                    />
                                }
                            >
                                {(terreno) => (
                                    <FormularioEstacion
                                        terreno={terreno()}
                                        alGuardar={(t) => volver(`Se agregó la estación a «${t.nombre}».`)}
                                        alCancelar={() => setModo({ tipo: "lista" })}
                                    />
                                )}
                            </Show>
                        }
                    >
                        <F.Confirmacion mensaje={confirmacion()} />
                        <Show
                            when={lista().length > 0}
                            fallback={
                                <EstadoVacio
                                    icono={MapPinned}
                                    titulo="Aún no tienes terrenos. Registra el primero."
                                    texto="Anota dónde está tu terreno y la estación que instalaste. Después verás aquí sus mediciones."
                                    accion={{ texto: "Registrar terreno", onClick: () => setModo({ tipo: "nuevo" }) }}
                                />
                            }
                        >
                            <div class="terrenos-encabezado">
                                <h2>Mis terrenos</h2>
                                <button type="button" onClick={() => { setConfirmacion(""); setModo({ tipo: "nuevo" }); }}>
                                    <Plus size={18} aria-hidden="true" /> Registrar terreno
                                </button>
                            </div>
                            <For each={lista()}>
                                {(terreno) => (
                                    <Terreno
                                        terreno={terreno}
                                        alAgregar={() => { setConfirmacion(""); setModo({ tipo: "agregar", terreno }); }}
                                    />
                                )}
                            </For>
                        </Show>
                    </Show>
                )}
            </Show>
        </section>
    );
}
