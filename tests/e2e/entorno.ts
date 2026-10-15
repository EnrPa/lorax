// Entorno de las pruebas e2e, compartido por playwright.config.ts y las pruebas: base, bandeja de
// correos y servidor propios (data/e2e/, puerto 3100). Valores solo para pruebas, como en vitest.config.ts.
export const PUERTO = 3100;
export const URL_BASE = `http://localhost:${PUERTO}`;
export const CARPETA = "./data/e2e";

export const ENTORNO: Record<string, string> = {
    DB_ARCHIVO: `${CARPETA}/lorax.db`,
    CORREOS_DIR: `${CARPETA}/correos`,
    MENSAJES_DIR: `${CARPETA}/mensajes`,
    RESPALDOS_DIR: `${CARPETA}/respaldos`,
    APP_URL: URL_BASE,
    JWT_SECRET: "secreto-solo-para-pruebas-e2e-0123456789abcdef",
    INGESTA_API_KEY: "clave-de-ingesta-solo-para-pruebas-e2e-0123456789",
};
