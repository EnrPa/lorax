import { describe, expect, test } from "vitest";
import { z } from "zod";
import { desdeTexto, leerDecimal, MENSAJE_DECIMAL } from "~/lib/decimal";

describe("campo decimal (diseno.md §9)", () => {
    test.each([
        ["-38,95", -38.95],
        ["-38.95", -38.95],
        ["12", 12],
        [" 4,2 ", 4.2],
        ["+0,5", 0.5],
        ["−72,62", -72.62],
    ])("[T2.1] «%s» se lee como %d", (texto, valor) => {
        expect(leerDecimal(texto)).toEqual({ tipo: "numero", valor });
    });

    test.each(["1.234,5", "1,234.5", "1.234.567", "12,", ",5", "abc", "1 234", "--3", "3e5"])(
        "[T2.1] «%s» es ambiguo o inválido",
        (texto) => {
            expect(leerDecimal(texto)).toEqual({ tipo: "invalido" });
        },
    );

    test("[T2.1] vacío se lee como vacío", () => {
        expect(leerDecimal("   ")).toEqual({ tipo: "vacio" });
    });

    test("[T2.1] en un esquema de formulario convierte a número y aplica las reglas del número", () => {
        const latitud = desdeTexto(z.number({ error: "Escribe la latitud." }).min(-90, "Fuera de rango."));
        expect(latitud.parse("-38,95")).toBe(-38.95);
        expect(latitud.safeParse("1.234,5").error?.issues[0].message).toBe(MENSAJE_DECIMAL);
        expect(latitud.safeParse("").error?.issues[0].message).toBe("Escribe la latitud.");
        expect(latitud.safeParse("-95").error?.issues[0].message).toBe("Fuera de rango.");

        const opcional = desdeTexto(z.number().nullable());
        expect(opcional.parse("")).toBeNull();
    });
});
