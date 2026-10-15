import { createContext, createResource, useContext, type JSX } from "solid-js";
import { getRequestEvent, isServer } from "solid-js/web";
import { api } from "~/core/api";
import type { CuentaSesion } from "~/lib/sesion";

// La sesión vive en una cookie HttpOnly que JavaScript no puede leer: el navegador pregunta a la API.
// Al renderizar en el servidor se usa la cuenta que validó el middleware, y Solid la envía al navegador.
async function consultarSesion(): Promise<CuentaSesion | null> {
    if (isServer) return getRequestEvent()?.locals.cuenta ?? null;
    try {
        return await api.get<CuentaSesion>("/auth/sesion");
    } catch {
        return null;
    }
}

function createSession() {
    const [cuenta, { mutate, refetch }] = createResource(consultarSesion);

    return {
        /** La cuenta de la sesión; `null` sin sesión y `undefined` mientras se consulta. */
        cuenta,
        /** Tras iniciar sesión, guarda la cuenta que devolvió la API. */
        establecer: (datos: CuentaSesion) => mutate(datos),
        recargar: () => refetch(),
        /** Revoca la sesión en el servidor (RF01.7) y lleva a /login. */
        cerrarSesion: async () => {
            try {
                await api.post("/auth/logout");
            } finally {
                mutate(null);
                window.location.assign("/login");
            }
        },
    };
}

const SessionContext = createContext<ReturnType<typeof createSession>>();

export function SessionProvider(props: { children: JSX.Element }) {
    return (
        <SessionContext.Provider value={createSession()}>
            {props.children}
        </SessionContext.Provider>
    );
}

export function useSession() {
    const session = useContext(SessionContext);
    if (!session) throw new Error("useSession requiere un SessionProvider");
    return session;
}
