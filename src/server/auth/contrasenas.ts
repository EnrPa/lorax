// Hash de contraseñas con scrypt (diseno.md D4 y §8.4). Solo servidor.
// Formato guardado: scrypt$N$r$p$sal$hash (sal y hash en base64).
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

// Parámetros mínimos recomendados por OWASP para scrypt.
const N = 2 ** 17;
const R = 8;
const P = 1;
const LARGO_CLAVE = 64;
const LARGO_SAL = 16;

function derivar(contrasena: string, sal: Buffer, opciones: ScryptOptions, largo: number): Promise<Buffer> {
    // scrypt necesita 128 · N · r bytes; se deja holgura sobre el límite por defecto (32 MB).
    const maxmem = 256 * (opciones.N ?? N) * (opciones.r ?? R) + 1024 * 1024;
    return new Promise((resolver, rechazar) => {
        scrypt(contrasena, sal, largo, { ...opciones, maxmem }, (error, clave) =>
            error ? rechazar(error) : resolver(clave),
        );
    });
}

export async function hashContrasena(contrasena: string): Promise<string> {
    const sal = randomBytes(LARGO_SAL);
    const clave = await derivar(contrasena, sal, { N, r: R, p: P }, LARGO_CLAVE);
    return ["scrypt", N, R, P, sal.toString("base64"), clave.toString("base64")].join("$");
}

// Sal fija para el cálculo de relleno: su resultado nunca se compara con nada real.
const SAL_RELLENO = Buffer.alloc(LARGO_SAL);

/**
 * Compara en tiempo constante. Si no hay hash (cuenta inexistente o pendiente de activación)
 * igual calcula un scrypt de relleno, para que el tiempo de respuesta no revele si la cuenta existe.
 */
export async function verificarContrasena(contrasena: string, hash: string | null | undefined): Promise<boolean> {
    const partes = hash?.split("$");
    if (!partes || partes.length !== 6 || partes[0] !== "scrypt") {
        await derivar(contrasena, SAL_RELLENO, { N, r: R, p: P }, LARGO_CLAVE);
        return false;
    }

    const [, n, r, p, salBase64, claveBase64] = partes;
    const opciones = { N: Number(n), r: Number(r), p: Number(p) };
    const esperada = Buffer.from(claveBase64, "base64");
    const obtenida = await derivar(contrasena, Buffer.from(salBase64, "base64"), opciones, esperada.length);
    return timingSafeEqual(obtenida, esperada);
}
