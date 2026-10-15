import { Title } from "@solidjs/meta";
import { createSignal, JSX, onMount, Show } from "solid-js";
import PestanaTerrenos from "~/components/terrenos/PestanaTerrenos";
import Pestanas from "~/components/ui/Pestanas";
import { useSession } from "~/contexts/session";
import { api, ErrorCliente } from "~/core/api";
import createForm from "~/core/form";
import type { CamposError } from "~/lib/errores-api";
import { esquemaFormularioCambioContrasena, esquemaPerfil, type Perfil } from "~/lib/esquemas/cuenta";
import { formatearRut } from "~/lib/rut";
import { camposDeZod } from "~/lib/validacion";
import "../styles/Ajustes.css";

/** Estado común de un formulario de Ajustes: errores por campo, error general, confirmación y envío. */
function crearEstadoFormulario() {
    const [errores, setErrores] = createSignal<CamposError>({});
    const [errorGeneral, setErrorGeneral] = createSignal("");
    const [confirmacion, setConfirmacion] = createSignal("");
    const [guardando, setGuardando] = createSignal(false);

    /** Envía y reparte el resultado: errores junto a cada campo, o un mensaje general. */
    async function enviar(accion: () => Promise<void>, mensajeOk: string) {
        setErrorGeneral("");
        setConfirmacion("");
        setGuardando(true);
        try {
            await accion();
            setErrores({});
            setConfirmacion(mensajeOk);
        } catch (err) {
            if (err instanceof ErrorCliente && Object.keys(err.campos).length > 0) setErrores(err.campos);
            else setErrorGeneral(err instanceof ErrorCliente ? err.message : "No pudimos guardar. Intenta de nuevo.");
        } finally {
            setGuardando(false);
        }
    }

    return { errores, setErrores, errorGeneral, confirmacion, setConfirmacion, guardando, enviar };
}

function PestanaPerfil() {
    const Form = createForm("perfil");
    const { recargar } = useSession();
    const estado = crearEstadoFormulario();
    const [perfil, setPerfil] = createSignal<Perfil>();
    const [errorCarga, setErrorCarga] = createSignal("");
    const [nombre, setNombre] = createSignal("");
    const [apellido, setApellido] = createSignal("");
    const [telefono, setTelefono] = createSignal("");

    const mostrar = (datos: Perfil) => {
        setPerfil(datos);
        setNombre(datos.nombre);
        setApellido(datos.apellido);
        setTelefono(datos.telefono ?? "");
    };

    // Regla de diseno.md §3: los datos se piden desde el navegador.
    onMount(async () => {
        try {
            mostrar(await api.get<Perfil>("/cuenta"));
        } catch (err) {
            setErrorCarga(err instanceof ErrorCliente ? err.message : "No pudimos cargar tus datos. Recarga la página.");
        }
    });

    const guardar: JSX.EventHandler<HTMLFormElement, SubmitEvent> = async (e) => {
        e.preventDefault();
        estado.setConfirmacion("");
        const validado = esquemaPerfil.safeParse({ nombre: nombre(), apellido: apellido(), telefono: telefono() });
        if (!validado.success) {
            estado.setErrores(camposDeZod(validado.error));
            return;
        }
        await estado.enviar(async () => {
            mostrar(await api.patch<Perfil>("/cuenta", validado.data));
            recargar(); // el saludo del menú usa el nombre
        }, "Tus datos se guardaron.");
    };

    return (
        <Show
            when={perfil()}
            fallback={<p class="ajustes-cargando">{errorCarga() || "Cargando tus datos…"}</p>}
        >
            {(datos) => (
                <Form.Form title="Perfil" onSubmit={guardar} noValidate class="ajustes-form">
                    <Form.Confirmacion mensaje={estado.confirmacion()} />
                    <Form.ErrorGeneral mensaje={estado.errorGeneral()} />
                    <Form.Text
                        name="nombre"
                        label="Nombre"
                        placeholder="Tu nombre"
                        autocomplete="given-name"
                        value={nombre()}
                        onInput={(e) => setNombre(e.currentTarget.value)}
                        error={estado.errores().nombre}
                    />
                    <Form.Text
                        name="apellido"
                        label="Apellido"
                        placeholder="Tu apellido"
                        autocomplete="family-name"
                        value={apellido()}
                        onInput={(e) => setApellido(e.currentTarget.value)}
                        error={estado.errores().apellido}
                    />
                    <Form.Text
                        name="telefono"
                        label="Teléfono (opcional)"
                        placeholder="+56912345678"
                        autocomplete="tel"
                        inputmode="tel"
                        value={telefono()}
                        onInput={(e) => setTelefono(e.currentTarget.value)}
                        error={estado.errores().telefono}
                    />

                    <dl class="ajustes-solo-lectura">
                        <div>
                            <dt>Correo</dt>
                            <dd>{datos().correo}</dd>
                        </div>
                        <Show when={datos().empresa}>
                            {(empresa) => (
                                <div>
                                    <dt>Empresa</dt>
                                    <dd>
                                        {empresa().nombre} · RUT {formatearRut(empresa().rut)}
                                    </dd>
                                </div>
                            )}
                        </Show>
                        <Show when={datos().cargo}>
                            <div>
                                <dt>Cargo</dt>
                                <dd>{datos().cargo}</dd>
                            </div>
                        </Show>
                    </dl>
                    <p class="ajustes-nota">Para cambiar tu correo, empresa o cargo, comunícate con el administrador de la plataforma.</p>

                    <Form.Submit name="Guardar cambios" class="ajustes-submit" guardando={estado.guardando()} />
                </Form.Form>
            )}
        </Show>
    );
}

function PestanaSeguridad() {
    const Form = createForm("seguridad");
    const estado = crearEstadoFormulario();
    const [actual, setActual] = createSignal("");
    const [nueva, setNueva] = createSignal("");
    const [confirmacion, setConfirmacion] = createSignal("");

    const cambiar: JSX.EventHandler<HTMLFormElement, SubmitEvent> = async (e) => {
        e.preventDefault();
        estado.setConfirmacion("");
        const validado = esquemaFormularioCambioContrasena.safeParse({
            actual: actual(),
            nueva: nueva(),
            confirmacion: confirmacion(),
        });
        if (!validado.success) {
            estado.setErrores(camposDeZod(validado.error));
            return;
        }
        await estado.enviar(async () => {
            await api.post("/cuenta/contrasena", { actual: validado.data.actual, nueva: validado.data.nueva });
            setActual("");
            setNueva("");
            setConfirmacion("");
        }, "Tu contraseña se cambió. Úsala la próxima vez que inicies sesión.");
    };

    return (
        <Form.Form title="Cambiar contraseña" onSubmit={cambiar} noValidate class="ajustes-form">
            <Form.Confirmacion mensaje={estado.confirmacion()} />
            <Form.ErrorGeneral mensaje={estado.errorGeneral()} />
            <Form.Password
                name="actual"
                label="Contraseña actual"
                placeholder="Tu contraseña de hoy"
                autocomplete="current-password"
                value={actual()}
                onInput={(e) => setActual(e.currentTarget.value)}
                error={estado.errores().actual}
            />
            <Form.Password
                name="nueva"
                label="Nueva contraseña"
                placeholder="Al menos 12 caracteres"
                autocomplete="new-password"
                value={nueva()}
                onInput={(e) => setNueva(e.currentTarget.value)}
                error={estado.errores().nueva}
            />
            <Form.Password
                name="confirmacion"
                label="Repite la nueva contraseña"
                placeholder="Escríbela otra vez"
                autocomplete="new-password"
                value={confirmacion()}
                onInput={(e) => setConfirmacion(e.currentTarget.value)}
                error={estado.errores().confirmacion}
            />
            <Form.Submit name="Cambiar contraseña" class="ajustes-submit" guardando={estado.guardando()} />
        </Form.Form>
    );
}

export default function Ajustes() {
    const { cuenta } = useSession();
    // Las pestañas se crean una vez: si la lista trajera objetos nuevos cada vez que se recarga la
    // sesión (por ejemplo, al guardar el perfil), la pestaña abierta se volvería a montar y perdería
    // su mensaje de confirmación.
    const perfil = { id: "perfil", titulo: "Perfil", contenido: () => <PestanaPerfil /> };
    const seguridad = { id: "seguridad", titulo: "Seguridad", contenido: () => <PestanaSeguridad /> };
    const terrenos = { id: "terrenos", titulo: "Terrenos y estaciones", contenido: () => <PestanaTerrenos /> };
    // «Terrenos y estaciones» solo existe para el productor (pantalla Ajustes, requisitos.md §6).
    const pestanas = () => (cuenta()?.rol === "PRODUCTOR" ? [perfil, seguridad, terrenos] : [perfil, seguridad]);

    return (
        <section class="ajustes">
            <Title>Ajustes · LoRax</Title>
            <h1>Ajustes</h1>
            <Pestanas id="ajustes" etiqueta="Secciones de ajustes" pestanas={pestanas()} />
        </section>
    );
}
