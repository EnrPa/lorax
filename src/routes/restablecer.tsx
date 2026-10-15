import { Title } from "@solidjs/meta";
import { A, useNavigate, useSearchParams } from "@solidjs/router";
import Layers from "lucide-solid/icons/layers";
import { createSignal, JSX, Show } from "solid-js";
import { api, ErrorCliente } from "~/core/api";
import createForm from "~/core/form";
import type { CamposError } from "~/lib/errores-api";
import { esquemaFormularioContrasena } from "~/lib/esquemas/auth";
import { camposDeZod } from "~/lib/validacion";
import "../styles/Login.css";

// Restablecer la contraseña o definir la primera (RF01.5). Al terminar, lleva a /login con un aviso.
export default function Restablecer() {
    const Form = createForm("restablecer");
    const [params] = useSearchParams<{ token?: string }>();
    const navigate = useNavigate();
    const token = () => (typeof params.token === "string" ? params.token : "");

    const [contrasena, setContrasena] = createSignal("");
    const [confirmacion, setConfirmacion] = createSignal("");
    const [errores, setErrores] = createSignal<CamposError>({});
    const [errorGeneral, setErrorGeneral] = createSignal("");
    const [guardando, setGuardando] = createSignal(false);

    const submit: JSX.EventHandler<HTMLFormElement, SubmitEvent> = async (e) => {
        e.preventDefault();
        setErrorGeneral("");
        const validado = esquemaFormularioContrasena.safeParse({ contrasena: contrasena(), confirmacion: confirmacion() });
        if (!validado.success) {
            setErrores(camposDeZod(validado.error));
            return;
        }
        setErrores({});

        setGuardando(true);
        try {
            await api.post("/auth/restablecer", { token: token(), contrasena: validado.data.contrasena });
            navigate("/login?aviso=contrasena-actualizada", { replace: true });
        } catch (err) {
            if (err instanceof ErrorCliente && err.campos.contrasena) setErrores({ contrasena: err.campos.contrasena });
            else setErrorGeneral(err instanceof ErrorCliente ? err.message : "No pudimos guardar la contraseña. Intenta de nuevo.");
        } finally {
            setGuardando(false);
        }
    };

    return (
        <div class="login">
            <Title>Define tu contraseña · LoRax</Title>
            <div class="login-brand">
                <Layers size={26} aria-hidden="true" />
                <span>LoRax</span>
            </div>

            <h1 class="login-title">Define tu contraseña</h1>

            <div class="login-card">
                <Show
                    when={token()}
                    fallback={
                        <>
                            <Form.ErrorGeneral mensaje="El enlace está incompleto. Ábrelo tal como llegó a tu correo, o pide uno nuevo." />
                            <A href="/login" class="form-link">Ir a iniciar sesión</A>
                        </>
                    }
                >
                    <Form.Form onSubmit={submit} noValidate>
                        <p class="login-ayuda">Usa al menos 12 caracteres. Puede ser una frase fácil de recordar.</p>
                        <Form.ErrorGeneral mensaje={errorGeneral()} />
                        <Form.Password
                            name="contrasena"
                            label="Nueva contraseña"
                            placeholder="Al menos 12 caracteres"
                            autocomplete="new-password"
                            value={contrasena()}
                            onInput={(e) => setContrasena(e.currentTarget.value)}
                            error={errores().contrasena}
                        />
                        <Form.Password
                            name="confirmacion"
                            label="Repite la contraseña"
                            placeholder="Escríbela otra vez"
                            autocomplete="new-password"
                            value={confirmacion()}
                            onInput={(e) => setConfirmacion(e.currentTarget.value)}
                            error={errores().confirmacion}
                        />
                        <Form.Submit
                            name="Guardar contraseña"
                            class="login-submit"
                            guardando={guardando()}
                            textoGuardando="Guardando…"
                        />
                    </Form.Form>
                </Show>
            </div>
        </div>
    );
}
