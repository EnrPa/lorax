import { createSignal, For, JSX, onMount, Show } from "solid-js";
import { api, ErrorCliente } from "~/core/api";
import createForm from "~/core/form";
import type { CamposError } from "~/lib/errores-api";
import { esquemaCrearProductor, type CuentaAdmin } from "~/lib/esquemas/admin";
import { formatearRut } from "~/lib/rut";
import { camposDeZod } from "~/lib/validacion";
import "../../styles/Admin.css";

/** Registro de un productor con empresa nueva o existente (RF07.3). */
export default function NuevaCuenta(props: { alCrear: (c: CuentaAdmin) => void; alCancelar: () => void }) {
    const F = createForm("nueva-cuenta");
    const [datos, setDatos] = createSignal({ nombre: "", apellido: "", correo: "", telefono: "", cargo: "" });
    const [tipoEmpresa, setTipoEmpresa] = createSignal<"existente" | "nueva">("existente");
    const [empresas, setEmpresas] = createSignal<Array<{ id: number; nombre: string; rut: string }>>([]);
    const [empresaId, setEmpresaId] = createSignal("");
    const [empresaNueva, setEmpresaNueva] = createSignal({ nombre: "", rut: "" });
    const [errores, setErrores] = createSignal<CamposError>({});
    const [errorGeneral, setErrorGeneral] = createSignal("");
    const [guardando, setGuardando] = createSignal(false);
    const cambiar = (c: Partial<ReturnType<typeof datos>>) => setDatos({ ...datos(), ...c });

    onMount(async () => {
        try {
            const lista = (await api.get<{ items: Array<{ id: number; nombre: string; rut: string }> }>("/admin/empresas")).items;
            setEmpresas(lista);
            if (lista.length === 0) setTipoEmpresa("nueva");
        } catch (err) {
            setErrorGeneral(err instanceof ErrorCliente ? err.message : "No pudimos cargar las empresas.");
        }
    });

    const enviar: JSX.EventHandler<HTMLFormElement, SubmitEvent> = async (e) => {
        e.preventDefault();
        setErrorGeneral("");
        const empresa = tipoEmpresa() === "existente" ? (empresaId() ? { id: Number(empresaId()) } : {}) : empresaNueva();
        const validado = esquemaCrearProductor.safeParse({ ...datos(), telefono: datos().telefono, empresa });
        if (!validado.success) {
            const campos = camposDeZod(validado.error);
            if (tipoEmpresa() === "existente" && (campos.empresa || campos["empresa.nombre"] || campos["empresa.rut"])) {
                campos.empresaId = "Elige la empresa de la lista.";
            }
            setErrores(campos);
            return;
        }
        setErrores({});
        setGuardando(true);
        try {
            props.alCrear(await api.post<CuentaAdmin>("/admin/cuentas", validado.data));
        } catch (err) {
            if (err instanceof ErrorCliente && Object.keys(err.campos).length) setErrores(err.campos);
            else setErrorGeneral(err instanceof ErrorCliente ? err.message : "No pudimos registrar la cuenta. Intenta de nuevo.");
        } finally {
            setGuardando(false);
        }
    };

    return (
        <F.Form title="Registrar productor" onSubmit={enviar} noValidate class="admin-form">
            <p class="admin-nota">
                Al registrar la cuenta enviaremos al productor un enlace para que defina su contraseña. Tú nunca la conocerás.
            </p>
            <F.ErrorGeneral mensaje={errorGeneral()} />
            <div class="admin-fila">
                <F.Text name="nombre" label="Nombre" placeholder="Ej.: Ana" value={datos().nombre} onInput={(e) => cambiar({ nombre: e.currentTarget.value })} error={errores().nombre} />
                <F.Text name="apellido" label="Apellido" placeholder="Ej.: Soto" value={datos().apellido} onInput={(e) => cambiar({ apellido: e.currentTarget.value })} error={errores().apellido} />
            </div>
            <F.Email name="correo" label="Correo" placeholder="nombre@correo.cl" value={datos().correo} onInput={(e) => cambiar({ correo: e.currentTarget.value })} error={errores().correo} />
            <div class="admin-fila">
                <F.Text name="telefono" label="Teléfono (opcional)" placeholder="+56912345678" inputmode="tel" value={datos().telefono} onInput={(e) => cambiar({ telefono: e.currentTarget.value })} error={errores().telefono} />
                <F.Text name="cargo" label="Cargo (opcional)" placeholder="Ej.: Dueña" value={datos().cargo} onInput={(e) => cambiar({ cargo: e.currentTarget.value })} error={errores().cargo} />
            </div>

            <F.Opciones
                name="tipoEmpresa"
                leyenda="Empresa"
                valor={tipoEmpresa()}
                alCambiar={(v) => setTipoEmpresa(v as "existente" | "nueva")}
                opciones={[
                    { valor: "existente", etiqueta: "Empresa existente" },
                    { valor: "nueva", etiqueta: "Empresa nueva" },
                ]}
            />
            <Show
                when={tipoEmpresa() === "existente"}
                fallback={
                    <div class="admin-fila">
                        <F.Text
                            name="empresaNombre"
                            label="Nombre de la empresa"
                            placeholder="Ej.: Viñedos Soto EIRL"
                            value={empresaNueva().nombre}
                            onInput={(e) => setEmpresaNueva({ ...empresaNueva(), nombre: e.currentTarget.value })}
                            error={errores()["empresa.nombre"]}
                        />
                        <F.Text
                            name="empresaRut"
                            label="RUT de la empresa"
                            placeholder="Ej.: 76.345.678-1"
                            value={empresaNueva().rut}
                            onInput={(e) => setEmpresaNueva({ ...empresaNueva(), rut: e.currentTarget.value })}
                            error={errores()["empresa.rut"]}
                        />
                    </div>
                }
            >
                <div class="form-field" classList={{ "has-error": !!errores().empresaId }}>
                    <label class="selector-terreno">
                        <span>Elige la empresa</span>
                        <select value={empresaId()} onChange={(e) => setEmpresaId(e.currentTarget.value)} aria-invalid={errores().empresaId ? true : undefined}>
                            <option value="">— Elige una empresa —</option>
                            <For each={empresas()}>{(e) => <option value={e.id}>{e.nombre} · RUT {formatearRut(e.rut)}</option>}</For>
                        </select>
                    </label>
                    <Show when={errores().empresaId}>
                        <p class="field-error">{errores().empresaId}</p>
                    </Show>
                </div>
            </Show>

            <div class="admin-acciones">
                <F.Submit name="Registrar productor" class="admin-submit" guardando={guardando()} textoGuardando="Registrando…" />
                <button type="button" class="boton-secundario" onClick={() => props.alCancelar()}>
                    Cancelar
                </button>
            </div>
        </F.Form>
    );
}
