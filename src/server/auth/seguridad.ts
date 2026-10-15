// Protección CSRF por origen y encabezados de seguridad (diseno.md §11). Solo servidor; los usa el middleware.

const MUTACIONES = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Exenta: el servidor de red se autentica con API key, no con la cookie de sesión. */
export const RUTA_INGESTA = "/api/v1/ingesta";

/** Mutaciones de la API que el navegador hace con la cookie de sesión: las que se verifican. */
export function requiereVerificarOrigen(metodo: string, ruta: string): boolean {
    return MUTACIONES.has(metodo.toUpperCase()) && ruta.startsWith("/api/") && ruta !== RUTA_INGESTA;
}

/**
 * Con `Origin`, debe ser el de `APP_URL` o el de la propia solicitud. Sin `Origin`, se rechaza solo si
 * `Sec-Fetch-Site` dice `cross-site`: los navegadores envían esos encabezados, y un cliente que no es
 * navegador no puede hacer CSRF.
 */
export function origenPermitido(request: Request, appUrl: string): boolean {
    const origen = request.headers.get("origin");
    if (origen === null) return request.headers.get("sec-fetch-site") !== "cross-site";
    const permitidos = new Set([new URL(request.url).origin]);
    try {
        permitidos.add(new URL(appUrl).origin);
    } catch {
        // APP_URL inválida: solo se acepta el origen de la propia solicitud.
    }
    return permitidos.has(origen);
}

/** Lo único que se guarda del rechazo: origen, ruta y método, truncados. Nunca cuerpo, cookies ni tokens. */
export function detalleRechazo(request: Request) {
    const truncar = (v: string) => v.slice(0, 200);
    return {
        origen: truncar(request.headers.get("origin") ?? `(sin Origin; Sec-Fetch-Site: ${request.headers.get("sec-fetch-site") ?? "?"})`),
        ruta: truncar(new URL(request.url).pathname),
        metodo: truncar(request.method),
    };
}

/**
 * CSP restrictiva salvo `'unsafe-inline'` en scripts y estilos: SolidStart inserta un script en línea
 * que activa la página, y los componentes usan estilos en línea (limitación documentada en §11).
 */
function csp(appUrl: string, desarrollo: boolean): string {
    // En desarrollo, la recarga en caliente de Vite abre un websocket en otro puerto del mismo host.
    let conexiones = "connect-src 'self'";
    if (desarrollo) {
        try {
            conexiones += ` ws://${new URL(appUrl).hostname}:*`;
        } catch {
            conexiones += " ws://localhost:*";
        }
    }
    return [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        conexiones,
        "object-src 'none'",
        "base-uri 'self'",
        "frame-ancestors 'none'",
        "form-action 'self'",
    ].join("; ");
}

export function encabezadosSeguridad(appUrl: string, desarrollo: boolean): Record<string, string> {
    const encabezados: Record<string, string> = {
        "Content-Security-Policy": csp(appUrl, desarrollo),
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "same-origin",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
        "Cross-Origin-Opener-Policy": "same-origin",
    };
    // HSTS solo tiene sentido (y efecto) sobre https.
    if (appUrl.startsWith("https://")) encabezados["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
    return encabezados;
}
