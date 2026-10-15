import { Title } from "@solidjs/meta";
import { createSignal, For, onMount, Show } from "solid-js";
import { api } from "~/core/api";
import "../../styles/Correos.css";

// Bandeja de correos escritos a archivo (diseno.md D6). Solo en desarrollo: sirve para demostrar la
// recuperación de contraseña y la activación de cuentas sin un servidor de correo.
interface Correo {
    id: string;
    fecha: string;
    para: string;
    asunto: string;
    texto: string;
}

const fechaHora = new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Santiago",
});

/** Muestra el texto del correo con los enlaces clicables. */
function TextoConEnlaces(props: { texto: string }) {
    const partes = () => props.texto.split(/(https?:\/\/\S+)/g);
    return (
        <pre class="correo-texto">
            <For each={partes()}>
                {(parte) => (/^https?:\/\//.test(parte) ? <a href={parte}>{parte}</a> : parte)}
            </For>
        </pre>
    );
}

export default function Correos() {
    // Se consulta desde el navegador: al renderizar en el servidor no hay una URL base para la API.
    const [correos, setCorreos] = createSignal<Correo[]>([]);
    const [cargando, setCargando] = createSignal(true);
    const refetch = async () => {
        setCargando(true);
        try {
            setCorreos((await api.get<{ items: Correo[] }>("/dev/correos")).items);
        } finally {
            setCargando(false);
        }
    };
    onMount(refetch);

    return (
        <section class="correos">
            <Title>Correos enviados · LoRax</Title>
            <div class="correos-encabezado">
                <h1>Correos enviados</h1>
                <button type="button" onClick={() => refetch()}>Actualizar</button>
            </div>
            <p class="correos-nota">
                Solo en desarrollo. Así se ven los correos que la plataforma enviaría a los usuarios.
            </p>

            <Show
                when={correos().length > 0}
                fallback={<p>{cargando() ? "Cargando correos…" : "Aún no se ha enviado ningún correo."}</p>}
            >
                <ol class="correos-lista">
                    <For each={correos()}>
                        {(correo) => (
                            <li class="correo">
                                <h2>{correo.asunto}</h2>
                                <p class="correo-meta">
                                    Para <strong>{correo.para}</strong> · {fechaHora.format(new Date(correo.fecha))}
                                </p>
                                <TextoConEnlaces texto={correo.texto} />
                            </li>
                        )}
                    </For>
                </ol>
            </Show>
        </section>
    );
}
