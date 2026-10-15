import { describe, expect, test } from "vitest";
import {
    evaluarFilas,
    generarInforme,
    GRUPO_CONCURRENCIA,
    GRUPO_HISTORIAL,
    GRUPO_INGESTA,
    GRUPO_PANEL,
    hayFallas,
    idsDe,
    leerPlaywright,
    leerVitest,
    type Ejecucion,
    type InformeCarga,
    type ResultadoSuite,
} from "../../scripts/informe-evidencia";

// T6.6 (diseno.md §11 y §12): el informe de evidencia agrupa los resultados por fila de la tesis. No respalda
// una fila de la tesis; lleva el ID de la tarea.

const RAIZ = "/proyecto";

const prueba = (nombre: string, estado: Ejecucion["estado"] = "pasa", archivo = "tests/integracion/x.test.ts", proyecto?: string): Ejecucion => ({
    suite: proyecto ? "e2e" : "test",
    archivo,
    nombre,
    estado,
    ...(proyecto && { proyecto }),
});

const carga = (cambios: Partial<InformeCarga> = {}): InformeCarga => ({
    fecha: "2026-10-08T02:07:55.738Z",
    base: { archivo: "./data/carga/lorax.db", tamanoMB: 2364, mediciones: 6_865_848, sensores: 48, desde: "2022-09-09", hasta: "2026-10-08" },
    umbralP95Ms: 3000,
    resultados: [
        { grupo: GRUPO_PANEL, consultas: 30, errores: 0, p50Ms: 5, p95Ms: 9, maxMs: 24 },
        { grupo: GRUPO_HISTORIAL, consultas: 30, errores: 0, p50Ms: 131, p95Ms: 141, maxMs: 143 },
        { grupo: GRUPO_CONCURRENCIA, consultas: 400, errores: 0, p50Ms: 450, p95Ms: 787, maxMs: 2844 },
        { grupo: GRUPO_INGESTA, consultas: 768, errores: 0, p50Ms: 17, p95Ms: 41, maxMs: 56 },
    ],
    ingesta: { tramas: 768, lecturas: 4608, perdidas: 0, segundos: 1.6, lecturasPorSegundo: 2814 },
    planIndice: "SEARCH mediciones USING INDEX mediciones_sensor_fecha_unico (sensor_id=? AND fecha>? AND fecha<?)",
    ...cambios,
});

const suite = (cambios: Partial<ResultadoSuite> = {}): ResultadoSuite => ({
    suite: "test",
    comando: "npm run test",
    codigoSalida: 0,
    segundos: 12,
    archivosConError: [],
    conResultados: true,
    ...cambios,
});

const fila = (filas: ReturnType<typeof evaluarFilas>, id: string, texto?: string) =>
    filas.find((f) => f.fila.id === id && (!texto || f.fila.fila.includes(texto)))!;

describe("[T6.6] Lectura de resultados", () => {
    test("[T6.6] extrae los IDs de prueba y de tarea, sin repetir", () => {
        expect(idsDe("[P-FUN-CU03] Recepción › [P-FUN-CU03] sensor no registrado")).toEqual(["P-FUN-CU03"]);
        expect(idsDe("[T6.1] origen [P-SEG-SESION]")).toEqual(["T6.1", "P-SEG-SESION"]);
        expect(idsDe("rango [inválido] sin ID")).toEqual([]);
    });

    test("[T6.6] lee el JSON de Vitest con rutas relativas y detecta archivos que no ejecutaron sus pruebas", () => {
        const { ejecuciones, archivosConError } = leerVitest(
            {
                testResults: [
                    {
                        name: `${RAIZ}/tests/unit/rut.test.ts`,
                        status: "passed",
                        assertionResults: [
                            { ancestorTitles: ["RUT"], title: "[T0.4] válido", status: "passed" },
                            { ancestorTitles: ["RUT"], title: "[T0.4] pendiente", status: "skipped" },
                            { ancestorTitles: [], title: "[T0.4] roto", status: "failed" },
                        ],
                    },
                    { name: `${RAIZ}/tests/integracion/roto.test.ts`, status: "failed", message: "no carga", assertionResults: [] },
                ],
            },
            "test",
            RAIZ,
        );
        expect(ejecuciones).toEqual([
            { suite: "test", archivo: "tests/unit/rut.test.ts", nombre: "RUT › [T0.4] válido", estado: "pasa" },
            { suite: "test", archivo: "tests/unit/rut.test.ts", nombre: "RUT › [T0.4] pendiente", estado: "omitida" },
            { suite: "test", archivo: "tests/unit/rut.test.ts", nombre: "[T0.4] roto", estado: "falla" },
        ]);
        expect(archivosConError).toEqual(["tests/integracion/roto.test.ts"]);
    });

    test("[T6.6] lee el JSON de Playwright: una ejecución por proyecto, sin el título del archivo", () => {
        const ejecuciones = leerPlaywright(
            {
                config: { rootDir: `${RAIZ}/tests/e2e` },
                suites: [
                    {
                        title: "login.spec.ts",
                        file: "login.spec.ts",
                        suites: [
                            {
                                title: "inicio de sesión",
                                file: "login.spec.ts",
                                specs: [
                                    {
                                        title: "[P-FUN-CU01] credenciales válidas",
                                        file: "login.spec.ts",
                                        tests: [
                                            { projectName: "chromium", status: "expected" },
                                            { projectName: "webkit", status: "flaky" },
                                            { projectName: "celular", status: "unexpected" },
                                            { projectName: "webkit-celular", status: "skipped" },
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
            RAIZ,
        );
        expect(ejecuciones.map((e) => [e.archivo, e.nombre, e.proyecto, e.estado])).toEqual([
            ["tests/e2e/login.spec.ts", "inicio de sesión › [P-FUN-CU01] credenciales válidas", "chromium", "pasa"],
            ["tests/e2e/login.spec.ts", "inicio de sesión › [P-FUN-CU01] credenciales válidas", "webkit", "pasa"],
            ["tests/e2e/login.spec.ts", "inicio de sesión › [P-FUN-CU01] credenciales válidas", "celular", "falla"],
            ["tests/e2e/login.spec.ts", "inicio de sesión › [P-FUN-CU01] credenciales válidas", "webkit-celular", "omitida"],
        ]);
    });
});

describe("[T6.6] Evaluación por fila de la tesis", () => {
    test("[T6.6] Aprobado, No aprobado y Sin ejecutar según las pruebas de cada ID", () => {
        const filas = evaluarFilas(
            [prueba("[P-FUN-CU01] a"), prueba("[P-FUN-CU01] b", "omitida"), prueba("[P-FUN-CU02] a"), prueba("[P-FUN-CU02] b", "falla"), prueba("[P-FUN-CU04] a", "omitida")],
            carga(),
        );
        expect(fila(filas, "P-FUN-CU01")).toMatchObject({ resultado: "Aprobado", conteo: { total: 2, pasan: 1, fallan: 0, omitidas: 1 } });
        expect(fila(filas, "P-FUN-CU02").resultado).toBe("No aprobado");
        // Solo omitidas o ninguna prueba: no hay evidencia.
        expect(fila(filas, "P-FUN-CU04").resultado).toBe("Sin ejecutar");
        expect(fila(filas, "P-FUN-CU05").resultado).toBe("Sin ejecutar");
    });

    test("[T6.6] P-FUN-CU06 se separa en configuración (criterios) y evaluación (evaluacion.test.ts)", () => {
        const filas = evaluarFilas(
            [
                prueba("[P-FUN-CU06] umbral fuera de rango", "pasa", "tests/integracion/criterios.test.ts"),
                prueba("[P-FUN-CU06] trama atrasada", "falla", "tests/integracion/evaluacion.test.ts"),
            ],
            carga(),
        );
        const configuracion = fila(filas, "P-FUN-CU06", "configuración");
        const evaluacion = fila(filas, "P-FUN-CU06", "evaluación");
        expect(configuracion).toMatchObject({ resultado: "Aprobado", conteo: { total: 1 } });
        expect(evaluacion).toMatchObject({ resultado: "No aprobado", conteo: { total: 1 } });
    });

    test("[T6.6] las filas de carga se evalúan con carga.json: p95, errores, pérdidas e índice", () => {
        const aprobadas = evaluarFilas([], carga());
        for (const id of ["P-CAR-INGESTA", "P-CAR-HISTORICO", "P-CAR-CONCURRENCIA"]) expect(fila(aprobadas, id).resultado).toBe("Aprobado");
        expect(fila(aprobadas, "P-CAR-HISTORICO").criterios.join("\n")).toContain("p95 de 141 ms (umbral: menos de 3.000 ms). Cumple");

        const lenta = carga();
        lenta.resultados[1] = { ...lenta.resultados[1], p95Ms: 3000 };
        expect(fila(evaluarFilas([], lenta), "P-CAR-HISTORICO").resultado).toBe("No aprobado");

        const sinIndice = evaluarFilas([], carga({ planIndice: "SCAN mediciones" }));
        expect(fila(sinIndice, "P-CAR-HISTORICO").resultado).toBe("No aprobado");

        const conPerdidas = evaluarFilas([], carga({ ingesta: { tramas: 768, lecturas: 4608, perdidas: 3, segundos: 2, lecturasPorSegundo: 2304 } }));
        expect(fila(conPerdidas, "P-CAR-INGESTA").resultado).toBe("No aprobado");

        const conErrores = carga();
        conErrores.resultados[2] = { ...conErrores.resultados[2], errores: 1 };
        expect(fila(evaluarFilas([], conErrores), "P-CAR-CONCURRENCIA").resultado).toBe("No aprobado");

        const sinCarga = evaluarFilas([], null);
        expect(fila(sinCarga, "P-CAR-INGESTA").resultado).toBe("Sin ejecutar");
    });

    test("[T6.6] el comando falla si una suite termina con error, no dejó resultados o una fila no está aprobada", () => {
        expect(hayFallas([suite()], [prueba("[P-FUN-CU01] a")], carga())).toBe(false);
        expect(hayFallas([suite({ codigoSalida: 1 })], [prueba("[P-FUN-CU01] a")], carga())).toBe(true);
        expect(hayFallas([suite({ conResultados: false })], [], carga())).toBe(true);
        expect(hayFallas([suite()], [prueba("[P-FUN-CU01] a", "falla")], carga())).toBe(true);
        // Sin carga.json: esas filas quedan «Sin ejecutar», sin hacer fallar el comando.
        expect(hayFallas([suite()], [prueba("[P-FUN-CU01] a")], null)).toBe(false);
    });
});

describe("[T6.6] Informe en Markdown", () => {
    const informe = (ejecuciones: Ejecucion[], datosCarga: InformeCarga | null = carga()) =>
        generarInforme({
            contexto: { fecha: new Date("2026-10-13T15:00:00Z"), commit: "abc1234", cambiosSinCommit: true, equipo: "Equipo de prueba" },
            suites: [suite(), suite({ suite: "e2e", comando: "npm run test:e2e", segundos: 240 })],
            ejecuciones,
            carga: datosCarga,
        });

    test("[T6.6] trae el contexto, la tabla por fila de la tesis y el detalle de cada prueba", () => {
        const md = informe([
            prueba("[P-FUN-CU03] Recepción › [P-FUN-CU03] sensor no registrado", "pasa", "tests/integracion/ingesta.test.ts"),
            prueba("[P-E2E-HISTORIAL] serie y CSV", "pasa", "tests/e2e/historial.spec.ts", "chromium"),
            prueba("[P-E2E-HISTORIAL] serie y CSV", "falla", "tests/e2e/historial.spec.ts", "webkit"),
        ]);
        expect(md).toContain("commit `abc1234`, con cambios sin commit");
        expect(md).toContain("Equipo: Equipo de prueba.");
        expect(md).toMatch(/\| \[P-FUN-CU03\]\(#p-fun-cu03-funcionales-cu03\) \| Funcionales → CU03 \| .* \| 1 \(1 pasa\) \| \*\*Aprobado\*\* \|/);
        expect(md).toMatch(/\| \[P-E2E-HISTORIAL\]\(#[a-z0-9-]+\) \| .* \| 2 \(1 pasa, 1 falla\) \| \*\*No aprobado\*\* \|/);
        expect(md).toContain("- Pasa · `tests/integracion/ingesta.test.ts` · [P-FUN-CU03] Recepción › [P-FUN-CU03] sensor no registrado");
        // Las ejecuciones de una prueba en varios proyectos de Playwright van en una sola línea.
        expect(md).toContain("- Pasa en chromium; Falla en webkit · `tests/e2e/historial.spec.ts` · [P-E2E-HISTORIAL] serie y CSV");
        expect(md).toContain('### <a id="p-fun-cu03-funcionales-cu03"></a>P-FUN-CU03 · Funcionales → CU03');
    });

    test("[T6.6] la accesibilidad se redacta como «sin infracciones detectadas por axe-core», no como cumplimiento de WCAG", () => {
        const md = informe([prueba("[T6.5] Panel", "pasa", "tests/e2e/accesibilidad.spec.ts", "chromium")]);
        expect(md).toContain("sin infracciones detectadas por axe-core");
        expect(md).toContain("no equivale a certificar el cumplimiento de WCAG");
        expect(md).not.toMatch(/cumple (con )?WCAG/i);
    });

    test("[T6.6] la carga se informa desde carga.json, con su fecha, o como sin ejecutar", () => {
        expect(informe([])).toContain("Carga medida el");
        expect(informe([])).toContain("20 usuarios simultáneos: 400 consultas, 0 errores, p95 de 787 ms");
        const sinCarga = informe([], null);
        expect(sinCarga).toContain("Carga sin ejecutar: falta `evidencia/carga.json`");
        expect(sinCarga).toMatch(/\| \[P-CAR-INGESTA\]\(#[a-z0-9-]+\) \| .* \| — \| \*\*Sin ejecutar\*\* \|/);
    });

    test("[T6.6] el anexo lista las pruebas complementarias por ID de tarea y las que no tienen ID", () => {
        const md = informe([prueba("[T6.1] origen"), prueba("[T6.1] encabezados"), prueba("[T0.3] trigger", "falla"), prueba("conexión sin ID")]);
        const anexo = md.slice(md.indexOf("## Anexo"));
        expect(anexo).toContain("| T0.3 | 1 (0 pasan, 1 falla) | No aprobado |");
        expect(anexo).toContain("| T6.1 | 2 (2 pasan) | Aprobado |");
        expect(anexo.indexOf("| T0.3")).toBeLessThan(anexo.indexOf("| T6.1"));
        // T6.5 es una fila de la tesis, no una complementaria.
        expect(anexo).not.toContain("| T6.5 |");
        expect(anexo).toContain("Pruebas sin ID en el nombre: 1");
    });
});
