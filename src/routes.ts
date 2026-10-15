import { lazy } from "solid-js";
import type { Component } from "solid-js";
import House from "lucide-solid/icons/house";
import Settings from "lucide-solid/icons/settings";
import History from "lucide-solid/icons/history";
import Bell from "lucide-solid/icons/bell";
import ShieldCheck from "lucide-solid/icons/shield-check";
import { type LucideProps } from "lucide-solid";
import { ROLES_POR_RUTA } from "~/lib/rutas";
import type { Rol } from "~/lib/sesion";

export interface AppRoute {
    id: string;
    route: string;
    title: string;
    component: Component;
    icon: Component<LucideProps>;
    description?: string;
    location: 'top' | 'middle' | 'bottom' | undefined;
    // "app" muestra la barra lateral; "simple" es una página a pantalla completa (login, 404).
    layout: 'app' | 'simple';
}

export const routes: AppRoute[] = [
    {
        id: "home",
        route: "/",
        component: lazy(() => import("~/routes/index")),
        icon: House,
        title: "Panel",
        location: 'top',
        layout: 'app'
    },
    {
        id: "historial",
        route: "/historial",
        component: lazy(() => import("~/routes/historial")),
        icon: History,
        title: "Historial",
        location: 'middle',
        layout: 'app'
    },
    {
        id: "alertas",
        route: "/alertas",
        component: lazy(() => import("~/routes/alertas")),
        icon: Bell,
        title: "Alertas",
        location: 'middle',
        layout: 'app'
    },
    {
        id: "ajustes",
        route: "/ajustes",
        component: lazy(() => import("~/routes/ajustes")),
        icon: Settings,
        title: "Ajustes",
        location: 'bottom',
        layout: 'app'
    },
    {
        id: "admin",
        route: "/admin",
        component: lazy(() => import("~/routes/admin")),
        icon: ShieldCheck,
        title: "Administración",
        location: 'top',
        layout: 'app'
    },
    {
        id: "login",
        route: "/login",
        component: lazy(() => import("~/routes/login")),
        icon: House,
        title: "Inicio sesión",
        location: undefined,
        layout: 'simple'
    },
    {
        id: "restablecer",
        route: "/restablecer",
        component: lazy(() => import("~/routes/restablecer")),
        icon: House,
        title: "Define tu contraseña",
        location: undefined,
        layout: 'simple'
    },
    // Bandeja de correos: solo existe en desarrollo (diseno.md D6).
    ...(import.meta.env.DEV
        ? [{
            id: "dev-correos",
            route: "/dev/correos",
            component: lazy(() => import("~/routes/dev/correos")),
            icon: House,
            title: "Correos enviados",
            location: undefined,
            layout: 'simple' as const
        }]
        : []),
    {
        // Debe ir al final: captura toda ruta no registrada.
        id: "no-encontrada",
        route: "*404",
        component: lazy(() => import("~/routes/[...404]")),
        icon: House,
        title: "Página no encontrada",
        location: undefined,
        layout: 'simple'
    },
];

export function layoutFor(pathname: string): AppRoute["layout"] {
    return routes.find((r) => r.route === pathname)?.layout ?? 'simple';
}

/** El menú muestra solo las páginas permitidas al rol (los permisos están en `~/lib/rutas`). */
export function visibleFor(route: AppRoute, rol: Rol | undefined): boolean {
    return !!rol && !!ROLES_POR_RUTA[route.route]?.includes(rol);
}
