import { Title } from "@solidjs/meta";
import { useNavigate, useSearchParams } from "@solidjs/router";
import Layers from "lucide-solid/icons/layers";
import { createSignal, JSX, Show } from "solid-js";
import { api, ErrorCliente } from "~/core/api";
import createForm from "~/core/form";
import { useSession } from "~/contexts/session";
import type { CamposError } from "~/lib/errores-api";
import { AVISO_CONTRASENA_ACTUALIZADA, esquemaLogin, esquemaRecuperar } from "~/lib/esquemas/auth";
import { inicioDe } from "~/lib/rutas";
import type { CuentaSesion } from "~/lib/sesion";
import { camposDeZod } from "~/lib/validacion";
import "../styles/Login.css";

// Inicio de sesión y solicitud del enlace de recuperación (RF01).
export default function LogIn() {
    const Form = createForm("login");
    const Recover = createForm("recover");
    const [recovering, setRecovering] = createSignal(false);
    const { establecer } = useSession();
    const navigate = useNavigate();
    const [params] = useSearchParams<{ aviso?: string }>();
    // Después de restablecer o activar (diseno.md §8.4).
    const aviso = () => (params.aviso === "contrasena-actualizada" ? AVISO_CONTRASENA_ACTUALIZADA : "");

    const [correoRecuperar, setCorreoRecuperar] = createSignal("");
    const [errorRecuperar, setErrorRecuperar] = createSignal("");
    const [mensajeRecuperar, setMensajeRecuperar] = createSignal("");
    const [enviando, setEnviando] = createSignal(false);

    const recuperar: JSX.EventHandler<HTMLFormElement, SubmitEvent> = async (e) => {
        e.preventDefault();
        setMensajeRecuperar("");
        const validado = esquemaRecuperar.safeParse({ correo: correoRecuperar() });
        if (!validado.success) {
            setErrorRecuperar(camposDeZod(validado.error).correo ?? "");
            return;
        }
        setErrorRecuperar("");
        setEnviando(true);
        try {
            const { mensaje } = await api.post<{ mensaje: string }>("/auth/recuperar", validado.data);
            setMensajeRecuperar(mensaje);
        } catch (err) {
            setErrorRecuperar(err instanceof ErrorCliente ? err.message : "No pudimos enviar el enlace. Intenta de nuevo.");
        } finally {
            setEnviando(false);
        }
    };

    const [correo, setCorreo] = createSignal("");
    const [contrasena, setContrasena] = createSignal("");
    const [recordar, setRecordar] = createSignal(false);
    const [errores, setErrores] = createSignal<CamposError>({});
    const [errorGeneral, setErrorGeneral] = createSignal("");
    const [guardando, setGuardando] = createSignal(false);

    const submit: JSX.EventHandler<HTMLFormElement, SubmitEvent> = async (e) => {
        e.preventDefault();
        setErrorGeneral("");

        // RF01.2: campos vacíos o correo inválido se marcan sin enviar la solicitud.
        const validado = esquemaLogin.safeParse({ correo: correo(), contrasena: contrasena(), recordar: recordar() });
        if (!validado.success) {
            setErrores(camposDeZod(validado.error));
            return;
        }
        setErrores({});

        setGuardando(true);
        try {
            const { cuenta } = await api.post<{ cuenta: CuentaSesion }>("/auth/login", validado.data);
            establecer(cuenta);
            navigate(inicioDe(cuenta.rol), { replace: true });
        } catch (err) {
            // RF01.3 y RF01.4: el mensaje viene del servidor; se conserva el correo y se vacía la contraseña.
            if (err instanceof ErrorCliente && Object.keys(err.campos).length > 0) setErrores(err.campos);
            else setErrorGeneral(err instanceof ErrorCliente ? err.message : "No pudimos iniciar sesión. Intenta de nuevo.");
            setContrasena("");
        } finally {
            setGuardando(false);
        }
    };

    return (
        <div class="login">
            <Title>Iniciar sesión · LoRax</Title>
            <div class="login-brand">
                <Layers size={26} aria-hidden="true" />
                <span>LoRax</span>
            </div>

            <h1 class="login-title">Sistema de Monitoreo</h1>

            <div class="login-card">
                <Form.Form title="Iniciar sesión" onSubmit={submit} noValidate>
                    <Show when={!errorGeneral()}>
                        <Form.Confirmacion mensaje={aviso()} />
                    </Show>
                    <Form.ErrorGeneral mensaje={errorGeneral()} />
                    <Form.Email
                        name="correo"
                        label="Correo"
                        placeholder="nombre@correo.cl"
                        value={correo()}
                        onInput={(e) => setCorreo(e.currentTarget.value)}
                        error={errores().correo}
                    />
                    <Form.Password
                        name="contrasena"
                        label="Contraseña"
                        placeholder="Tu contraseña"
                        autocomplete="current-password"
                        value={contrasena()}
                        onInput={(e) => setContrasena(e.currentTarget.value)}
                        error={errores().contrasena}
                    />
                    <Form.Checkbox
                        name="recordar"
                        description="Mantener sesión iniciada"
                        checked={recordar()}
                        onChange={(e) => setRecordar(e.currentTarget.checked)}
                    />
                    <Form.Submit
                        name="Iniciar sesión"
                        class="login-submit"
                        guardando={guardando()}
                        textoGuardando="Ingresando…"
                    />
                </Form.Form>

                <Form.Link name="¿Olvidaste tu contraseña?" onClick={() => setRecovering(!recovering())} />

                <Show when={recovering()}>
                    <Recover.Form title="Recuperar contraseña" onSubmit={recuperar} noValidate>
                        <p class="login-ayuda">Escribe el correo de tu cuenta y te enviaremos un enlace para crear una nueva contraseña.</p>
                        <Recover.Confirmacion mensaje={mensajeRecuperar()} />
                        <Recover.Email
                            name="correo"
                            label="Correo"
                            placeholder="nombre@correo.cl"
                            value={correoRecuperar()}
                            onInput={(e) => setCorreoRecuperar(e.currentTarget.value)}
                            error={errorRecuperar()}
                        />
                        <Recover.Submit
                            name="Enviar enlace"
                            class="login-submit"
                            guardando={enviando()}
                            textoGuardando="Enviando…"
                        />
                    </Recover.Form>
                </Show>
            </div>
        </div>
    );
}
