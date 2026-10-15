import { MetaProvider, Title } from "@solidjs/meta";
import { Router, useLocation, useNavigate } from "@solidjs/router";
import { createEffect, JSX, Show, Suspense } from "solid-js";
import "./app.css";
import Sidebar from "./components/Sidebar";
import { SessionProvider, useSession } from "./contexts/session";
import { redireccionPara } from "./lib/rutas";
import { layoutFor, routes } from "./routes";

function Layout(props: { children: JSX.Element }) {
  const { cuenta } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const withSidebar = () => layoutFor(location.pathname) === "app";

  // El middleware protege cada carga de página. Esto cubre la navegación dentro de la aplicación
  // (sin recargar) y la sesión que se pierde mientras la página está abierta.
  createEffect(() => {
    if (cuenta.loading) return;
    const destino = redireccionPara(location.pathname, cuenta() ?? null);
    if (destino) navigate(destino, { replace: true });
  });

  return (
    <Suspense>
      <div class="app-shell" classList={{ "with-sidebar": withSidebar() }}>
        <Show when={withSidebar()}>
          <Sidebar />
        </Show>
        <Title>LoRax</Title>
        <main>
          <Suspense>{props.children}</Suspense>
        </main>
      </div>
    </Suspense>
  );
}

export default function App() {
  return (
    <Router
      root={(props) => (
        <MetaProvider>
          <SessionProvider>
            <Layout>{props.children}</Layout>
          </SessionProvider>
        </MetaProvider>
      )}
    >
      {routes.map((r) => ({ path: r.route, component: r.component }))}
    </Router>
  );
}
