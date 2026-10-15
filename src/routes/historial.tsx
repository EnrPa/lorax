import { Title } from "@solidjs/meta";
import { useNavigate } from "@solidjs/router";
import Download from "lucide-solid/icons/download";
import MapPinned from "lucide-solid/icons/map-pinned";
import { createMemo, createSignal, For, JSX, onMount, Show } from "solid-js";
import SelectorTerreno from "~/components/panel/SelectorTerreno";
import EstadoVacio from "~/components/ui/EstadoVacio";
import GraficoSerie, { type SerieGrafico } from "~/components/ui/GraficoSerie";
import { api, ErrorCliente } from "~/core/api";
import createForm from "~/core/form";
import { RANGO_MAXIMO_MS, type RespuestaHistorial } from "~/lib/esquemas/historial";
import type { Pagina } from "~/lib/esquemas/paginacion";
import type { TerrenoDetalle } from "~/lib/esquemas/terrenos";
import { diaChile, inicioDelDiaChile, periodoTexto, rangoDeDias } from "~/lib/fechas";
import { VARIABLES } from "~/lib/variables";
import "../styles/Historial.css";

// Historial de mediciones (RF05, diseno.md §8.3).
const HORA = 3_600_000;
const DIA = 24 * HORA;
const ATAJOS = [
    { id: "24h", texto: "Últimas 24 h", ms: DIA },
    { id: "7d", texto: "7 días", ms: 7 * DIA },
    { id: "30d", texto: "30 días", ms: 30 * DIA },
    { id: "1a", texto: "1 año", ms: 365 * DIA },
] as const;

type Rango = { tipo: "atajo"; id: string; desde: Date; hasta: Date } | { tipo: "dias"; desde: string; hasta: string };

export default function Historial() {
    const Form = createForm("historial");
    const navigate = useNavigate();
    const [terrenos, setTerrenos] = createSignal<TerrenoDetalle[]>();
    const [terrenoId, setTerrenoId] = createSignal<number>();
    const [tipo, setTipo] = createSignal<string>("");
    const [rango, setRango] = createSignal<Rango>();
    const [comparar, setComparar] = createSignal<"ninguna" | "semana" | "otro">("ninguna");
    const [compararDia, setCompararDia] = createSignal("");
    const [errores, setErrores] = createSignal<Record<string, string>>({});
    const [resultado, setResultado] = createSignal<RespuestaHistorial>();
    const [cargando, setCargando] = createSignal(false);
    const [errorGeneral, setErrorGeneral] = createSignal("");

    const terreno = () => terrenos()?.find((t) => t.id === terrenoId());
    const atajoActivo = () => {
        const r = rango();
        return r?.tipo === "atajo" ? r.id : null;
    };
    /** Variables que existen en el terreno, en el orden del catálogo. */
    const tipos = createMemo(() => {
        const presentes = new Set(terreno()?.estaciones.flatMap((e) => e.sensores.map((s) => s.tipo)) ?? []);
        return VARIABLES.filter((v) => presentes.has(v.tipo));
    });

    /** Campos de día que se muestran: los del rango elegido, o los días que cubre el atajo. */
    const diaDesde = () => {
        const r = rango();
        return !r ? "" : r.tipo === "dias" ? r.desde : diaChile(r.desde);
    };
    const diaHasta = () => {
        const r = rango();
        return !r ? "" : r.tipo === "dias" ? r.hasta : diaChile(r.hasta.getTime() - 1);
    };

    /** Valida en el navegador (RF05.2) y devuelve los instantes a consultar, o `null` si hay errores. */
    function limites(): { desde: Date; hasta: Date; compararDesde?: Date } | null {
        const r = rango();
        if (!r) return null;
        const nuevos: Record<string, string> = {};
        let desde: Date;
        let hasta: Date;
        if (r.tipo === "dias") {
            if (!r.desde) nuevos.desde = "Elige la fecha inicial.";
            if (!r.hasta) nuevos.hasta = "Elige la fecha final.";
            if (r.desde && r.hasta && r.desde > r.hasta) nuevos.desde = "La fecha inicial no puede ser posterior a la final.";
            if (Object.keys(nuevos).length) {
                setErrores(nuevos);
                return null;
            }
            ({ desde, hasta } = rangoDeDias(r.desde, r.hasta));
        } else {
            ({ desde, hasta } = r);
        }
        if (hasta.getTime() - desde.getTime() > RANGO_MAXIMO_MS) nuevos.hasta = "El periodo puede ser de hasta 1 año. Elige un rango más corto.";

        let compararDesde: Date | undefined;
        if (comparar() === "semana") compararDesde = new Date(desde.getTime() - 7 * DIA);
        if (comparar() === "otro") {
            if (!compararDia()) nuevos.comparar = "Elige el día en que empieza el periodo a comparar.";
            else compararDesde = inicioDelDiaChile(compararDia());
        }
        setErrores(nuevos);
        return Object.keys(nuevos).length ? null : { desde, hasta, compararDesde };
    }

    const parametros = (l: { desde: Date; hasta: Date; compararDesde?: Date }, conComparacion: boolean) => {
        const p = new URLSearchParams({ terrenoId: String(terrenoId()), tipo: tipo(), desde: l.desde.toISOString(), hasta: l.hasta.toISOString() });
        if (conComparacion && l.compararDesde) p.set("compararDesde", l.compararDesde.toISOString());
        return p;
    };

    async function consultar() {
        setErrorGeneral("");
        const l = limites();
        if (!l || terrenoId() === undefined || !tipo()) return;
        setCargando(true);
        try {
            setResultado(await api.get<RespuestaHistorial>(`/mediciones/serie?${parametros(l, true)}`));
        } catch (err) {
            if (err instanceof ErrorCliente && Object.keys(err.campos).length) setErrores(err.campos);
            else setErrorGeneral(err instanceof ErrorCliente ? err.message : "No pudimos cargar el historial. Intenta de nuevo.");
        } finally {
            setCargando(false);
        }
    }

    /** Enlace de descarga con los filtros actuales (sin comparación). */
    const enlaceCsv = () => {
        const r = resultado();
        if (!r) return "";
        return `/api/v1/mediciones/exportar?${parametros({ desde: new Date(r.periodo.desde), hasta: new Date(r.periodo.hasta) }, false)}`;
    };

    const aplicarAtajo = (atajo: (typeof ATAJOS)[number]) => {
        const hasta = new Date();
        setRango({ tipo: "atajo", id: atajo.id, desde: new Date(hasta.getTime() - atajo.ms), hasta });
        void consultar();
    };

    // Regla de diseno.md §3: los datos se piden desde el navegador.
    onMount(async () => {
        try {
            const lista = (await api.get<Pagina<TerrenoDetalle>>("/terrenos?tamano=100")).items;
            setTerrenos(lista);
            if (lista.length === 0) return;
            setTerrenoId(lista[0].id);
            setTipo(tipos()[0]?.tipo ?? "");
            aplicarAtajo(ATAJOS[1]);
        } catch (err) {
            setErrorGeneral(err instanceof ErrorCliente ? err.message : "No pudimos cargar tus terrenos. Recarga la página.");
        }
    });

    const enviar: JSX.EventHandler<HTMLFormElement, SubmitEvent> = (e) => {
        e.preventDefault();
        void consultar();
    };

    /** Series para el gráfico: cada estación y, si hay comparación, su periodo comparado punteado y alineado. */
    const series = (): SerieGrafico[] => {
        const r = resultado();
        if (!r) return [];
        const inicio = new Date(r.periodo.desde).getTime();
        const lista: SerieGrafico[] = r.periodo.series.map((s, i) => ({
            nombre: s.numeroSerie,
            color: i,
            puntos: s.puntos.map((p) => ({ x: p.t, y: p.promedio, min: p.minimo, max: p.maximo })),
        }));
        r.comparacion?.series.forEach((s, i) =>
            lista.push({
                nombre: `${s.numeroSerie} · periodo comparado`,
                color: i,
                discontinua: true,
                // Alineado por desfase desde el inicio de su periodo (§8.3).
                puntos: s.puntos.map((p) => ({ x: inicio + p.desfase, y: p.promedio, min: p.minimo, max: p.maximo })),
            }),
        );
        return lista;
    };

    const sinDatos = () => {
        const r = resultado();
        return !!r && r.periodo.series.every((s) => s.puntos.length === 0) && (r.comparacion?.series.every((s) => s.puntos.length === 0) ?? true);
    };

    const textoIntervalo = () => {
        const r = resultado();
        if (!r) return "";
        if (r.intervalo) return `Promedios cada ${r.intervalo.etiqueta}. Toca un punto para ver el mínimo y el máximo.`;
        const minutos = r.intervaloMedicionMs ? Math.round(r.intervaloMedicionMs / 60_000) : 15;
        return `Mediciones cada ${minutos} minutos, sin agregar.`;
    };

    return (
        <section class="historial">
            <Title>Historial · LoRax</Title>
            <h1>Historial</h1>
            <Show when={errorGeneral()}>
                <p class="form-error" role="alert">{errorGeneral()}</p>
            </Show>

            <Show when={terrenos()} fallback={<p class="historial-nota">Cargando tus terrenos…</p>}>
                {(lista) => (
                    <Show
                        when={lista().length > 0}
                        fallback={
                            <EstadoVacio
                                icono={MapPinned}
                                titulo="Aún no tienes terrenos. Registra el primero."
                                texto="Cuando tus estaciones envíen mediciones, aquí podrás ver su historial."
                                accion={{ texto: "Registrar terreno", onClick: () => navigate("/ajustes?pestana=terrenos") }}
                            />
                        }
                    >
                        <Form.Form onSubmit={enviar} noValidate class="historial-filtros">
                            <div class="historial-fila">
                                <SelectorTerreno
                                    terrenos={lista()}
                                    valor={terrenoId()}
                                    alCambiar={(id) => {
                                        setTerrenoId(id);
                                        if (!tipos().some((v) => v.tipo === tipo())) setTipo(tipos()[0]?.tipo ?? "");
                                        void consultar();
                                    }}
                                />
                                <label class="selector-terreno">
                                    <span>Variable</span>
                                    <select
                                        value={tipo()}
                                        onChange={(e) => {
                                            setTipo(e.currentTarget.value);
                                            void consultar();
                                        }}
                                    >
                                        <For each={tipos()}>{(v) => <option value={v.tipo}>{v.etiqueta}</option>}</For>
                                    </select>
                                </label>
                            </div>

                            <div class="historial-atajos" role="group" aria-label="Periodos rápidos">
                                <For each={ATAJOS}>
                                    {(atajo) => (
                                        <button
                                            type="button"
                                            class="boton-secundario"
                                            aria-pressed={atajoActivo() === atajo.id}
                                            onClick={() => aplicarAtajo(atajo)}
                                        >
                                            {atajo.texto}
                                        </button>
                                    )}
                                </For>
                            </div>

                            <div class="historial-fila">
                                <Form.Fecha
                                    name="desde"
                                    label="Desde"
                                    value={diaDesde()}
                                    onInput={(e) => setRango({ tipo: "dias", desde: e.currentTarget.value, hasta: diaHasta() })}
                                    error={errores().desde}
                                />
                                <Form.Fecha
                                    name="hasta"
                                    label="Hasta"
                                    value={diaHasta()}
                                    onInput={(e) => setRango({ tipo: "dias", desde: diaDesde(), hasta: e.currentTarget.value })}
                                    error={errores().hasta}
                                />
                            </div>

                            <Form.Opciones
                                name="comparar"
                                leyenda="Comparar con"
                                valor={comparar()}
                                alCambiar={(v) => setComparar(v as "ninguna" | "semana" | "otro")}
                                opciones={[
                                    { valor: "ninguna", etiqueta: "Sin comparación" },
                                    { valor: "semana", etiqueta: "Semana anterior" },
                                    { valor: "otro", etiqueta: "Otro periodo" },
                                ]}
                            />
                            <Show when={comparar() === "otro"}>
                                <Form.Fecha
                                    name="compararDesde"
                                    label="El periodo a comparar empieza el"
                                    value={compararDia()}
                                    onInput={(e) => setCompararDia(e.currentTarget.value)}
                                    error={errores().comparar ?? errores().compararDesde}
                                />
                            </Show>

                            <Form.Submit name="Ver historial" class="historial-submit" guardando={cargando()} textoGuardando="Cargando…" />
                        </Form.Form>

                        <Show when={resultado()}>
                            {(r) => (
                                <section class="historial-resultado" aria-live="polite">
                                    <div class="historial-resumen">
                                        <div>
                                            <h2>
                                                {r().variable.etiqueta} · {r().terreno.nombre}
                                            </h2>
                                            <p class="historial-nota">
                                                {periodoTexto(new Date(r().periodo.desde), new Date(r().periodo.hasta))}. {textoIntervalo()}
                                            </p>
                                        </div>
                                        <a class="boton-secundario" href={enlaceCsv()} download="">
                                            <Download size={18} aria-hidden="true" /> Descargar CSV
                                        </a>
                                    </div>
                                    <Show
                                        when={!sinDatos()}
                                        fallback={<p class="historial-sin-datos">No hay mediciones en este periodo</p>}
                                    >
                                        <GraficoSerie
                                            series={series()}
                                            unidad={r().variable.unidad}
                                            etiqueta={`${r().variable.etiqueta} en ${r().terreno.nombre}, una línea por estación`}
                                            desde={new Date(r().periodo.desde).getTime()}
                                            hasta={new Date(r().periodo.hasta).getTime()}
                                        />
                                    </Show>
                                </section>
                            )}
                        </Show>
                    </Show>
                )}
            </Show>
        </section>
    );
}
