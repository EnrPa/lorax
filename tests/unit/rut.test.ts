import { describe, expect, test } from "vitest";
import { calcularDigitoVerificador, esRutValido, formatearRut } from "~/lib/rut";

describe("RUT (módulo 11)", () => {
    test.each([
        ["76.123.456-0", true],
        ["77234567-4", true],
        ["12.345.678-5", true],
        ["10.000.013-k", true],
        ["76.123.456-1", false],
        ["12.345.678-K", false],
        ["ABC", false],
        ["", false],
    ])("[T0.4] %s es válido: %s", (rut, esperado) => {
        expect(esRutValido(rut)).toBe(esperado);
    });

    test("[T0.4] el dígito verificador 11 es 0 y el 10 es K", () => {
        expect(calcularDigitoVerificador("76123456")).toBe("0");
        expect(calcularDigitoVerificador("10000013")).toBe("K");
    });

    test("[T0.4] formatea con puntos y guion", () => {
        expect(formatearRut("761234560")).toBe("76.123.456-0");
    });
});
