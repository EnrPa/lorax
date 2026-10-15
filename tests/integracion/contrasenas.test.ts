import { describe, expect, test } from "vitest";
import { hashContrasena, verificarContrasena } from "~/server/auth/contrasenas";

const CONTRASENA = "MiContrasenaSegura2026";

describe("almacenamiento de contraseñas", () => {
    test("[P-SEG-CONTRASENAS] el hash tiene formato scrypt$N$r$p$sal$hash y no contiene la contraseña", async () => {
        const hash = await hashContrasena(CONTRASENA);
        expect(hash).toMatch(/^scrypt\$131072\$8\$1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
        expect(hash).not.toContain(CONTRASENA);
        expect(hash).not.toContain(Buffer.from(CONTRASENA).toString("base64"));
    });

    test("[P-SEG-CONTRASENAS] la misma contraseña produce hashes distintos (sal aleatoria)", async () => {
        const [a, b] = [await hashContrasena(CONTRASENA), await hashContrasena(CONTRASENA)];
        expect(a).not.toBe(b);
    });

    test("[P-SEG-CONTRASENAS] la verificación acepta la contraseña correcta y rechaza otras", async () => {
        const hash = await hashContrasena(CONTRASENA);
        expect(await verificarContrasena(CONTRASENA, hash)).toBe(true);
        expect(await verificarContrasena(CONTRASENA + "x", hash)).toBe(false);
        expect(await verificarContrasena(CONTRASENA.toLowerCase(), hash)).toBe(false);
    });

    test("[P-SEG-CONTRASENAS] sin hash (cuenta pendiente o inexistente) nunca verifica", async () => {
        expect(await verificarContrasena(CONTRASENA, null)).toBe(false);
        expect(await verificarContrasena(CONTRASENA, undefined)).toBe(false);
        expect(await verificarContrasena(CONTRASENA, "texto-plano")).toBe(false);
    });
});
