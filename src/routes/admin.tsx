import { Title } from "@solidjs/meta";
import { useSearchParams } from "@solidjs/router";
import { createSignal, Show } from "solid-js";
import DetalleCuenta from "~/components/admin/DetalleCuenta";
import Eventos from "~/components/admin/Eventos";
import ListaCuentas from "~/components/admin/ListaCuentas";
import NuevaCuenta from "~/components/admin/NuevaCuenta";
import Pestanas from "~/components/ui/Pestanas";

// Administración (RF07): cuentas de productores y registro de eventos. Ninguna opción sobre mediciones.
// El estado va en la URL (?vista, ?cuenta, ?nueva) para que «Atrás» y los enlaces funcionen.
export default function Admin() {
    const [params, setParams] = useSearchParams<{ cuenta?: string; nueva?: string }>();
    const [mensaje, setMensaje] = createSignal("");
    const cuentaId = () => {
        const id = Number(params.cuenta);
        return Number.isInteger(id) && id > 0 ? id : null;
    };

    const verCuenta = (id: number, aviso = "") => {
        setMensaje(aviso);
        setParams({ cuenta: String(id), nueva: undefined, pestana: undefined });
    };
    const volver = () => setParams({ cuenta: undefined, nueva: undefined, pestana: undefined });

    const cuentas = () => (
        <Show
            when={cuentaId()}
            keyed
            fallback={
                <Show
                    when={params.nueva === "1"}
                    fallback={<ListaCuentas alVer={(id) => verCuenta(id)} alRegistrar={() => setParams({ nueva: "1" })} />}
                >
                    <NuevaCuenta
                        alCrear={(c) => verCuenta(c.id, `Se creó la cuenta y se envió el enlace de activación a ${c.correo}.`)}
                        alCancelar={volver}
                    />
                </Show>
            }
        >
            {(id) => <DetalleCuenta cuentaId={id} alVolver={volver} mensajeInicial={mensaje()} />}
        </Show>
    );

    return (
        <section class="admin">
            <Title>Administración · LoRax</Title>
            <h1>Administración</h1>
            <Pestanas
                id="admin"
                parametro="vista"
                etiqueta="Secciones de administración"
                pestanas={[
                    { id: "cuentas", titulo: "Cuentas", contenido: cuentas },
                    { id: "eventos", titulo: "Eventos", contenido: () => <Eventos /> },
                ]}
            />
        </section>
    );
}
