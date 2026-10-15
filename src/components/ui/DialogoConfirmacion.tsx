import { createEffect, createSignal, JSX, onCleanup } from "solid-js";
import createForm from "~/core/form";
import { ErrorCliente } from "~/core/api";
import "../../styles/DialogoConfirmacion.css";

/**
 * Diálogo de confirmación para operaciones sensibles (diseno.md §9, RF07.8). Usa el <dialog> nativo con
 * showModal(): mantiene el foco dentro, se cierra con Escape y devuelve el foco al botón que lo abrió.
 * Pide un motivo (obligatorio u opcional) y muestra dentro los errores del servidor.
 */
export default function DialogoConfirmacion(props: {
    abierto: boolean;
    titulo: string;
    /** Qué pasará si se confirma, en palabras simples. */
    descripcion: JSX.Element;
    /** Texto del botón de acción, p. ej. «Deshabilitar cuenta». */
    accion: string;
    motivoObligatorio: boolean;
    /** Acción destructiva: el botón usa el color crítico. */
    peligro?: boolean;
    alConfirmar: (motivo: string) => Promise<void>;
    alCerrar: () => void;
}) {
    const F = createForm("confirmacion");
    let dialogo!: HTMLDialogElement;
    const [motivo, setMotivo] = createSignal("");
    const [error, setError] = createSignal("");
    const [errorGeneral, setErrorGeneral] = createSignal("");
    const [enviando, setEnviando] = createSignal(false);
    // El botón que abrió el diálogo recupera el foco al cerrarlo, aunque el diálogo se desmonte.
    let quienAbrio: HTMLElement | null = null;
    const devolverFoco = () => {
        // Si la acción reemplazó ese botón (p. ej. «Deshabilitar» → «Habilitar»), la pantalla decide el foco.
        if (quienAbrio?.isConnected) quienAbrio.focus();
        quienAbrio = null;
    };
    onCleanup(devolverFoco);

    createEffect(() => {
        if (props.abierto && !dialogo.open) {
            quienAbrio = document.activeElement as HTMLElement | null;
            setMotivo("");
            setError("");
            setErrorGeneral("");
            dialogo.showModal();
        } else if (!props.abierto && dialogo.open) {
            dialogo.close();
            devolverFoco();
        }
    });

    const confirmar: JSX.EventHandler<HTMLFormElement, SubmitEvent> = async (e) => {
        e.preventDefault();
        const texto = motivo().trim();
        if (props.motivoObligatorio && !texto) {
            setError("Escribe el motivo de esta acción.");
            return;
        }
        setError("");
        setErrorGeneral("");
        setEnviando(true);
        try {
            await props.alConfirmar(texto);
            props.alCerrar();
        } catch (err) {
            if (err instanceof ErrorCliente && err.campos.motivo) setError(err.campos.motivo);
            else setErrorGeneral(err instanceof ErrorCliente ? err.message : "No pudimos completar la acción. Intenta de nuevo.");
        } finally {
            setEnviando(false);
        }
    };

    return (
        <dialog ref={dialogo} class="dialogo" aria-labelledby="dialogo-titulo" onClose={() => props.alCerrar()}>
            <F.Form onSubmit={confirmar} noValidate>
                <h2 id="dialogo-titulo" class="dialogo-titulo">{props.titulo}</h2>
                <div class="dialogo-descripcion">{props.descripcion}</div>
                <F.ErrorGeneral mensaje={errorGeneral()} />
                <F.Textarea
                    name="motivo"
                    label={props.motivoObligatorio ? "Motivo (obligatorio)" : "Motivo (opcional)"}
                    placeholder="Explica brevemente por qué"
                    rows={3}
                    value={motivo()}
                    onInput={(e) => setMotivo(e.currentTarget.value)}
                    error={error()}
                />
                <div class="dialogo-acciones">
                    <button type="button" class="boton-secundario" onClick={() => props.alCerrar()}>
                        Cancelar
                    </button>
                    <F.Submit
                        name={props.accion}
                        class={props.peligro ? "boton-peligro" : "dialogo-confirmar"}
                        guardando={enviando()}
                        textoGuardando="Guardando…"
                    />
                </div>
            </F.Form>
        </dialog>
    );
}
