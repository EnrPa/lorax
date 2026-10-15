import { createMiddleware } from "@solidjs/start/middleware";
import { accesoPagina, modoDesarrollo } from "~/lib/rutas";
import { prohibido } from "~/server/api/errores";
import { cookieBorrada, leerTokenDeSesion } from "~/server/auth/cookie";
import { detalleRechazo, encabezadosSeguridad, origenPermitido, requiereVerificarOrigen } from "~/server/auth/seguridad";
import { validarSesion } from "~/server/auth/sesiones";
import { appUrl } from "~/server/config";
import { obtenerBd } from "~/server/db/cliente";
import { eventos } from "~/server/db/esquema";
import { iniciarReintentos } from "~/server/notificaciones/reintentos";
import { iniciarRespaldos } from "~/server/respaldos/tarea";

const PAGINA_NO_ENCONTRADA = `<!doctype html><html lang="es"><meta charset="utf-8"><title>Página no encontrada · LoRax</title>
<body style="font-family:sans-serif;text-align:center;padding:4rem 1rem"><h1>No encontramos esta página</h1><p><a href="/">Volver al inicio</a></p></body></html>`;

// 1. Encabezados de seguridad en todas las respuestas (diseno.md §11).
// 2. Verificación de origen en las mutaciones de la API (CSRF, §11); la ingesta queda exenta.
// 3. Protección de las páginas (§8.4): valida la sesión de verdad y redirige según el rol. Las demás
//    peticiones a la API no pasan por aquí: cada endpoint verifica sesión y rol con sus guardas.
// Además, la primera petición inicia las tareas periódicas: reintentos de notificaciones (§8.5) y respaldo
// diario (§11). Un plugin de Nitro las iniciaría al arrancar, pero en ese contexto no se resuelve el alias
// «~/» del código del servidor.
export default createMiddleware({
    onRequest: async (event) => {
        iniciarReintentos();
        iniciarRespaldos();
        const seguridad = encabezadosSeguridad(appUrl(), modoDesarrollo());
        for (const [nombre, valor] of Object.entries(seguridad)) event.response.headers.set(nombre, valor);

        const { pathname } = new URL(event.request.url);
        if (requiereVerificarOrigen(event.request.method, pathname) && !origenPermitido(event.request, appUrl())) {
            try {
                obtenerBd().insert(eventos).values({ tipo: "ORIGEN_RECHAZADO", detalle: detalleRechazo(event.request), fecha: new Date() }).run();
            } catch (error) {
                console.error("[seguridad] No se pudo registrar el rechazo de origen:", error);
            }
            const error = prohibido("No pudimos verificar el origen de la solicitud. Recarga la página e intenta de nuevo.");
            return Response.json(error.cuerpo(), { status: error.estado, headers: seguridad });
        }

        const accepts = event.request.headers.get("accept") ?? "";
        if (!accepts.includes("text/html")) return;

        const token = leerTokenDeSesion(event.request);
        const sesion = token ? await validarSesion(obtenerBd(), token) : null;
        event.locals.cuenta = sesion?.cuenta ?? null;

        const acceso = accesoPagina(pathname, sesion?.cuenta ?? null);
        // Una cookie vencida, revocada o alterada se borra del navegador.
        const borrarCookie = token !== null && sesion === null;

        if (acceso.tipo === "no-encontrada") {
            return new Response(PAGINA_NO_ENCONTRADA, {
                status: 404,
                headers: { ...seguridad, "Content-Type": "text/html; charset=utf-8" },
            });
        }
        if (acceso.tipo === "redirigir") {
            const headers = new Headers({ ...seguridad, Location: acceso.destino });
            if (borrarCookie) headers.append("Set-Cookie", cookieBorrada());
            return new Response(null, { status: 302, headers });
        }
        if (borrarCookie) event.response.headers.append("Set-Cookie", cookieBorrada());
    },
});
