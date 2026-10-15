import { createSignal, For, JSX, onMount, Show, splitProps } from "solid-js";
import CircleAlert from "lucide-solid/icons/circle-alert";
import CircleCheck from "lucide-solid/icons/circle-check";
import { FormItem, FormProps } from "~/interfaces/forms.types";
import "../styles/Forms.css";

type InputAttrs = Omit<JSX.InputHTMLAttributes<HTMLInputElement>, "name" | "type" | "children" | "placeholder">;

type FormForm = Omit<FormItem, "name" | "error"> & {
    title?: string;
    onSubmit?: JSX.EventHandler<HTMLFormElement, SubmitEvent>;
    noValidate?: boolean;
    class?: string;
};
type FormText = FormItem & InputAttrs & { label?: string; placeholder: string };
type FormPassword = FormText;
type FormEmail = FormItem & InputAttrs & { label?: string; placeholder?: string };
type FormDecimal = FormItem & Omit<InputAttrs, "value"> & { label?: string; placeholder?: string; value: string; ayuda?: string };
type FormFecha = FormItem & Omit<InputAttrs, "value"> & { label: string; value: string };
type FormOpciones = FormItem & {
    leyenda: string;
    opciones: Array<{ valor: string; etiqueta: string }>;
    valor: string;
    alCambiar: (valor: string) => void;
};
type FormTextarea = FormItem & {
    label?: string;
    placeholder?: string;
    value?: string;
    rows?: number;
    onInput?: JSX.EventHandler<HTMLTextAreaElement, InputEvent>;
};
type FormRange = FormItem & { label?: string };
type FormNumber = FormItem & { label?: string };
type FormSubmit = FormItem & {
    onClick?: () => void;
    class?: string;
    /** Mientras es verdadero, el botón se deshabilita y muestra `textoGuardando`. */
    guardando?: boolean;
    textoGuardando?: string;
};
type FormLink = FormItem & { onClick?: () => void };
type FormCheckbox = FormItem & {
    checked?: boolean;
    description: string;
    onChange?: JSX.EventHandler<HTMLInputElement, Event>;
};
type FormSelect = FormItem & {
    label?: string;
    options: Array<string | { value: string; label: string }>;
};

/** Mensaje de error con ícono y texto: el estado nunca se comunica solo con color. */
function MensajeError(props: { id?: string; children: JSX.Element; class: string; role?: "alert" }) {
    return (
        <p id={props.id} class={props.class} role={props.role}>
            <CircleAlert size={18} aria-hidden="true" />
            <span>{props.children}</span>
        </p>
    );
}

function Item(props: { children: JSX.Element; name: string; error?: string; errorId?: string }) {
    return (
        <div class="form-field" classList={{ "has-error": !!props.error }}>
            <label>
                <span>{props.name}</span>
                {props.children}
            </label>
            <Show when={props.error}>
                <MensajeError id={props.errorId} class="field-error">{props.error}</MensajeError>
            </Show>
        </div>
    );
}

const forms = (props: FormProps) => {
    const id = (name: string) => `${props.name}-${name}`;
    const errorId = (name: string) => `${id(name)}-error`;
    /** Atributos de accesibilidad de un campo con error. */
    const aria = (name: string, error?: string) => ({
        "aria-invalid": error ? true : undefined,
        "aria-describedby": error ? errorId(name) : undefined,
    });

    return {
        Form: (i: FormForm) => {
            const [local, rest] = splitProps(i, ["children", "title"]);
            // diseno.md §8.4: si el navegador llegara a hacer el envío nativo (sin JavaScript o antes de
            // hidratar), por POST los datos no quedan en la URL. Submit impide además ese envío.
            return (
                <form {...rest} method="post">
                    {local.title && <h2 class="form-title">{local.title}</h2>}
                    {local.children}
                </form>
            );
        },

        /** Error general del formulario (por ejemplo, credenciales inválidas). Se anuncia a lectores de pantalla. */
        ErrorGeneral: (i: { mensaje?: string }) => (
            <Show when={i.mensaje}>
                <MensajeError class="form-error" role="alert">{i.mensaje}</MensajeError>
            </Show>
        ),

        /** Mensaje de confirmación del formulario (por ejemplo, «te enviamos un enlace»). */
        Confirmacion: (i: { mensaje?: string }) => (
            <Show when={i.mensaje}>
                <p class="form-ok" role="status">
                    <CircleCheck size={18} aria-hidden="true" />
                    <span>{i.mensaje}</span>
                </p>
            </Show>
        ),

        Text: (i: FormText) => {
            const [local, rest] = splitProps(i, ["name", "label", "placeholder", "children", "error"]);
            return (
                <Item name={local.label ?? local.placeholder} error={local.error} errorId={errorId(local.name)}>
                    <input
                        {...rest}
                        {...aria(local.name, local.error)}
                        id={id(local.name)}
                        name={local.name}
                        type="text"
                        placeholder={local.placeholder}
                    />
                </Item>
            );
        },

        Email: (i: FormEmail) => {
            const [local, rest] = splitProps(i, ["name", "label", "placeholder", "children", "error"]);
            return (
                <Item name={local.label ?? local.placeholder ?? "Correo"} error={local.error} errorId={errorId(local.name)}>
                    <input
                        autocomplete="email"
                        inputmode="email"
                        {...rest}
                        {...aria(local.name, local.error)}
                        id={id(local.name)}
                        name={local.name}
                        type="email"
                        placeholder={local.placeholder}
                    />
                </Item>
            );
        },

        /**
         * Número con decimales (diseno.md §9): acepta coma o punto y no acepta separador de miles.
         * El valor es el texto tal como se escribe; el formulario lo convierte con `leerDecimal`
         * (o `desdeTexto` en su esquema) antes de enviar, así que la API recibe números.
         */
        Decimal: (i: FormDecimal) => {
            const [local, rest] = splitProps(i, ["name", "label", "placeholder", "children", "error", "ayuda"]);
            const ayudaId = () => (local.ayuda ? `${id(local.name)}-ayuda` : undefined);
            return (
                <Item name={local.label ?? local.placeholder ?? local.name} error={local.error} errorId={errorId(local.name)}>
                    <Show when={local.ayuda}>
                        <span id={ayudaId()} class="field-help">{local.ayuda}</span>
                    </Show>
                    <input
                        autocomplete="off"
                        {...rest}
                        aria-invalid={local.error ? true : undefined}
                        aria-describedby={[local.error ? errorId(local.name) : "", ayudaId() ?? ""].join(" ").trim() || undefined}
                        id={id(local.name)}
                        name={local.name}
                        type="text"
                        inputmode="decimal"
                        placeholder={local.placeholder}
                    />
                </Item>
            );
        },

        /** Día (AAAA-MM-DD). El formulario decide qué instante representa (p. ej. `rangoDeDias`). */
        Fecha: (i: FormFecha) => {
            const [local, rest] = splitProps(i, ["name", "label", "children", "error"]);
            return (
                <Item name={local.label} error={local.error} errorId={errorId(local.name)}>
                    <input {...rest} {...aria(local.name, local.error)} id={id(local.name)} name={local.name} type="date" />
                </Item>
            );
        },

        /** Grupo de opciones excluyentes (radio), p. ej. «Supera / Desciende bajo». */
        Opciones: (i: FormOpciones) => (
            <fieldset class="form-opciones" aria-describedby={i.error ? errorId(i.name) : undefined}>
                <legend>{i.leyenda}</legend>
                <For each={i.opciones}>
                    {(opcion) => (
                        <label class="form-opcion">
                            <input
                                type="radio"
                                name={id(i.name)}
                                value={opcion.valor}
                                checked={i.valor === opcion.valor}
                                onChange={() => i.alCambiar(opcion.valor)}
                            />
                            <span>{opcion.etiqueta}</span>
                        </label>
                    )}
                </For>
                <Show when={i.error}>
                    <MensajeError id={errorId(i.name)} class="field-error">{i.error}</MensajeError>
                </Show>
            </fieldset>
        ),

        Password: (i: FormPassword) => {
            const [local, rest] = splitProps(i, ["name", "label", "placeholder", "children", "error"]);
            return (
                <Item name={local.label ?? local.placeholder} error={local.error} errorId={errorId(local.name)}>
                    <input
                        {...rest}
                        {...aria(local.name, local.error)}
                        id={id(local.name)}
                        name={local.name}
                        type="password"
                        placeholder={local.placeholder}
                    />
                </Item>
            );
        },

        Textarea: (i: FormTextarea) => {
            const [local, rest] = splitProps(i, ["name", "label", "placeholder", "children", "error"]);
            return (
                <Item name={local.label ?? local.placeholder ?? local.name} error={local.error} errorId={errorId(local.name)}>
                    <textarea
                        {...rest}
                        {...aria(local.name, local.error)}
                        id={id(local.name)}
                        name={local.name}
                        placeholder={local.placeholder}
                    />
                </Item>
            );
        },

        Number: (i: FormNumber) => {
            const [local, rest] = splitProps(i, ["name", "label", "children"]);
            return (
                <Item name={local.label ?? local.name}>
                    <input
                        {...rest}
                        id={id(local.name)}
                        name={local.name}
                        type="number"
                    />
                </Item>
            );
        },

        Range: (i: FormRange) => {
            const [local, rest] = splitProps(i, ["name", "label", "children"]);
            return (
                <Item name={local.label ?? local.name}>
                    <input
                        {...rest}
                        id={id(local.name)}
                        name={local.name}
                        type="range"
                    />
                </Item>
            );
        },

        Select: (i: FormSelect) => {
            const [local, rest] = splitProps(i, ["name", "label", "options", "children"]);
            return (
                <Item name={local.label ?? local.name}>
                    <select {...rest} id={id(local.name)} name={local.name}>
                        <For each={local.options}>
                            {(opt) => {
                                const value = typeof opt === "string" ? opt : opt.value;
                                const label = typeof opt === "string" ? opt : opt.label;
                                return <option value={value}>{label}</option>;
                            }}
                        </For>
                    </select>
                </Item>
            );
        },

        Checkbox: (i: FormCheckbox) => {
            const [local, rest] = splitProps(i, ["name", "checked", "description", "children"]);
            return (
                <label>
                    <input
                        {...rest}
                        id={id(local.name)}
                        name={local.name}
                        type="checkbox"
                        checked={local.checked}
                    />
                    <span>{local.description}</span>
                </label>
            );
        },

        Button: (i: FormItem) => {
            const [local, rest] = splitProps(i, ["name", "children"]);
            return (
                <input
                    {...rest}
                    id={id(local.name)}
                    name={local.name}
                    type="button"
                    value={local.name}
                />
            );
        },

        Submit: (i: FormSubmit) => {
            const [local, rest] = splitProps(i, ["name", "onClick", "children", "error", "guardando", "textoGuardando"]);
            // diseno.md §8.4 y §9: hasta que la página hidrata, el botón queda deshabilitado con «Cargando…».
            // onMount solo corre en el navegador; sin JavaScript el formulario no se envía (con el botón de
            // envío deshabilitado, Enter tampoco lo envía).
            const [hidratado, setHidratado] = createSignal(false);
            onMount(() => setHidratado(true));
            const ocupado = () => !hidratado() || !!local.guardando;
            return (
                <button
                    {...rest}
                    type="submit"
                    onClick={local.onClick}
                    disabled={ocupado()}
                    aria-busy={ocupado() ? true : undefined}
                >
                    {!hidratado() ? "Cargando…" : local.guardando ? (local.textoGuardando ?? "Guardando…") : local.name}
                </button>
            );
        },

        Link: (i: FormLink) => {
            const [local, rest] = splitProps(i, ["name", "onClick", "children"]);
            return (
                <button {...rest} type="button" class="form-link" onClick={local.onClick}>
                    {local.name}
                </button>
            );
        },

        Reset: (i: FormItem) => {
            const [local, rest] = splitProps(i, ["name", "children"]);
            return (
                <input
                    {...rest}
                    id={id(local.name)}
                    name={local.name}
                    type="reset"
                    value={local.name}
                />
            );
        },
    };
};

export default forms;