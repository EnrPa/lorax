import { describe, expect, test } from "vitest";
import { diaChile, fechaHoraChile, fechaRelativa, inicioDelDiaChile, rangoDeDias, sumarDias } from "~/lib/fechas";

// Límites de los días en America/Santiago, con horario de verano (diseno.md §8.3).
describe("días de Chile", () => {
    test("[P-FUN-CU05] un día normal empieza a las 00:00 de Chile", () => {
        // 26 de septiembre de 2026: horario de verano, UTC−3.
        expect(inicioDelDiaChile("2026-09-26").toISOString()).toBe("2026-09-26T03:00:00.000Z");
        // 15 de julio de 2026: horario de invierno, UTC−4.
        expect(inicioDelDiaChile("2026-07-15").toISOString()).toBe("2026-07-15T04:00:00.000Z");
    });

    test("[P-FUN-CU05] en todos los días de dos años, el inicio cae en ese día y el instante anterior en el día previo", () => {
        let dia = "2026-01-01";
        const duraciones = new Set<number>();
        for (let i = 0; i < 730; i++) {
            const inicio = inicioDelDiaChile(dia);
            expect(diaChile(inicio), dia).toBe(dia);
            expect(diaChile(inicio.getTime() - 1), dia).toBe(sumarDias(dia, -1));
            const siguiente = inicioDelDiaChile(sumarDias(dia, 1));
            duraciones.add((siguiente.getTime() - inicio.getTime()) / 3_600_000);
            dia = sumarDias(dia, 1);
        }
        // Los días de cambio de hora duran 23 o 25 horas: la zona horaria real se está usando.
        expect([...duraciones].sort()).toEqual([23, 24, 25]);
    });

    test("[P-FUN-CU05] el rango de días es semiabierto e incluye completo el día «Hasta»", () => {
        const r = rangoDeDias("2026-09-26", "2026-09-26");
        expect(r.desde.toISOString()).toBe("2026-09-26T03:00:00.000Z");
        expect(r.hasta.toISOString()).toBe("2026-09-27T03:00:00.000Z");
        expect(diaChile(r.hasta.getTime() - 1)).toBe("2026-09-26");
    });

    test("[P-FUN-CU05] fecha_hora del CSV en hora de Chile, con segundos", () => {
        expect(fechaHoraChile(new Date("2026-09-26T17:05:00Z"))).toBe("2026-09-26 14:05:00");
        expect(fechaHoraChile(new Date("2026-07-15T04:00:30Z"))).toBe("2026-07-15 00:00:30");
    });

    test("[P-FUN-CU05] las fechas relativas usan formato de 24 horas", () => {
        const ahora = new Date("2026-09-26T23:10:00Z");
        expect(fechaRelativa(new Date("2026-09-26T23:00:00Z"), ahora)).toBe("hace 10 min · 20:00");
    });
});
