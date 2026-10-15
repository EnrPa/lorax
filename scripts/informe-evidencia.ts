// Informe de evidencia (diseno.md §11 y §12): convierte los resultados de las suites y de la carga en
// `evidencia/informe.md`, con una fila por cada prueba del capítulo 9 de la tesis. Sin efectos: lo usa
// `npm run evidencia` (scripts/evidencia.ts) y lo prueba tests/unit/informe-evidencia.test.ts.

export type EstadoPrueba = "pasa" | "falla" | "omitida";
export type NombreSuite = "test" | "infra" | "e2e";

export interface Ejecucion {
    suite: NombreSuite;
    /** Relativo a la raíz del proyecto, por ejemplo `tests/integracion/ingesta.test.ts`. */
    archivo: string;
    /** Bloques y título, separados por « › ». */
    nombre: string;
    /** Proyecto de Playwright (navegador y tamaño); solo en e2e. */
    proyecto?: string;
    estado: EstadoPrueba;
}

export interface ResultadoSuite {
    suite: NombreSuite;
    comando: string;
    codigoSalida: number;
    segundos: number;
    /** Archivos que no llegaron a ejecutar sus pruebas (error al cargar o en un `beforeAll`). */
    archivosConError: string[];
    /** Falso si la suite no dejó su JSON de resultados. */
    conResultados: boolean;
}

/** `evidencia/carga.json`, escrito por `npm run test:carga` (tests/carga/carga.test.ts). */
export interface InformeCarga {
    fecha: string;
    base: { archivo: string; tamanoMB: number; mediciones: number; sensores: number; desde: string; hasta: string };
    umbralP95Ms: number;
    resultados: { grupo: string; consultas: number; errores: number; p50Ms: number; p95Ms: number; maxMs: number }[];
    ingesta: { tramas: number; lecturas: number; perdidas: number; segundos: number; lecturasPorSegundo: number } | null;
    planIndice: string;
}

export interface Contexto {
    fecha: Date;
    commit: string | null;
    cambiosSinCommit: boolean;
    equipo: string;
}

type Fuente =
    | { tipo: "pruebas"; id: string; archivo?: (archivo: string) => boolean }
    | { tipo: "carga"; grupos: string[]; sinPerdidas?: boolean; conIndice?: boolean };

export interface FilaTesis {
    id: string;
    fila: string;
    verifica: string;
    fuente: Fuente;
    nota?: string;
}

const EVALUACION_CU06 = (archivo: string) => archivo.endsWith("evaluacion.test.ts");

export const GRUPO_PANEL = "Panel de estado";
export const GRUPO_HISTORIAL = "Historial de 1 año";
export const GRUPO_CONCURRENCIA = "20 usuarios simultáneos";
export const GRUPO_INGESTA = "Ingesta (por trama)";

/**
 * Filas de diseno.md §12, en el mismo orden. P-FUN-CU06 tiene dos filas en la tesis: la configuración
 * (tests/integracion/criterios.test.ts) y la evaluación (tests/integracion/evaluacion.test.ts). Las de carga
 * e infraestructura van en una fila por ID.
 */
export const FILAS_TESIS: FilaTesis[] = [
    { id: "P-FUN-CU01", fila: "Funcionales → CU01", verifica: "Login válido e inválido, cuenta deshabilitada, recuperación.", fuente: { tipo: "pruebas", id: "P-FUN-CU01" } },
    { id: "P-FUN-CU02", fila: "Funcionales → CU02", verifica: "Número de serie disponible y repetido, sin escrituras parciales.", fuente: { tipo: "pruebas", id: "P-FUN-CU02" } },
    { id: "P-FUN-CU04", fila: "Funcionales → CU04", verifica: "Los cinco estados de variable y los tres de estación.", fuente: { tipo: "pruebas", id: "P-FUN-CU04" } },
    { id: "P-FUN-CU05", fila: "Funcionales → CU05", verifica: "Rango válido, invertido y vacío; agregación; CSV.", fuente: { tipo: "pruebas", id: "P-FUN-CU05" } },
    {
        id: "P-FUN-CU06",
        fila: "Funcionales → CU06 (configuración)",
        verifica: "Validación del umbral contra el rango; eliminación lógica.",
        fuente: { tipo: "pruebas", id: "P-FUN-CU06", archivo: (a) => !EVALUACION_CU06(a) },
    },
    { id: "P-FUN-CU07", fila: "Funcionales → CU07 (fila por agregar a la tesis)", verifica: "Operaciones con motivo y evento; productor sin acceso a admin.", fuente: { tipo: "pruebas", id: "P-FUN-CU07" } },
    { id: "P-FUN-CU03", fila: "Funcionales → CU03", verifica: "Sensor registrado y no registrado.", fuente: { tipo: "pruebas", id: "P-FUN-CU03" } },
    {
        id: "P-FUN-CU06",
        fila: "Funcionales → CU06 (evaluación)",
        verifica: "Fuera y dentro de rango, sin duplicados, resolución.",
        fuente: { tipo: "pruebas", id: "P-FUN-CU06", archivo: EVALUACION_CU06 },
    },
    { id: "P-INT-INGESTA", fila: "Integraciones → Ingesta de tramas", verifica: "Trama válida se persiste; credencial o estructura inválida no.", fuente: { tipo: "pruebas", id: "P-INT-INGESTA" } },
    { id: "P-INT-NOTIFICACION", fila: "Integraciones → Notificación de alertas", verifica: "Fuera de rango notifica; dentro no.", fuente: { tipo: "pruebas", id: "P-INT-NOTIFICACION" } },
    { id: "P-INT-API", fila: "Integraciones → Consumo de la API REST", verifica: "Sin token o con token vencido: 401 y la interfaz pide iniciar sesión.", fuente: { tipo: "pruebas", id: "P-INT-API" } },
    { id: "P-E2E-INGESTA-PANEL", fila: "Integrales → Ingesta a visualización", verifica: "El emulador envía una trama y el panel la muestra con su estado.", fuente: { tipo: "pruebas", id: "P-E2E-INGESTA-PANEL" } },
    { id: "P-E2E-DATO-ALERTA", fila: "Integrales → Dato a alerta", verifica: "Escenario `sequia`: alerta, correo en `/dev/correos` y panel.", fuente: { tipo: "pruebas", id: "P-E2E-DATO-ALERTA" } },
    { id: "P-E2E-HISTORIAL", fila: "Integrales → Historial", verifica: "Serie, comparación y descarga del CSV.", fuente: { tipo: "pruebas", id: "P-E2E-HISTORIAL" } },
    { id: "P-SEG-CONTRASENAS", fila: "Seguridad → Contraseñas", verifica: "Formato scrypt; no contiene la contraseña.", fuente: { tipo: "pruebas", id: "P-SEG-CONTRASENAS" } },
    { id: "P-SEG-SESION", fila: "Seguridad → Validez de la sesión", verifica: "Token válido, vencido, ausente, alterado y revocado.", fuente: { tipo: "pruebas", id: "P-SEG-SESION" } },
    { id: "P-SEG-AISLAMIENTO", fila: "(complementaria, RNF02)", verifica: "Recurso ajeno responde 404; admin responde 403 a un productor.", fuente: { tipo: "pruebas", id: "P-SEG-AISLAMIENTO" } },
    {
        id: "T6.5",
        fila: "Accesibilidad (complementaria, RNF03 y RNF05)",
        verifica:
            "Todas las pantallas, en Chromium y WebKit, escritorio y celular: sin infracciones detectadas por axe-core (WCAG 2.1 A y AA) y comprobaciones propias.",
        fuente: { tipo: "pruebas", id: "T6.5" },
        nota:
            "«Aprobado» significa que axe-core no detectó infracciones (WCAG 2.1 A y AA, ninguna regla desactivada) y que pasaron las " +
            "comprobaciones propias (áreas táctiles de 44 px, texto base de 18 px y ninguno bajo 16 px, estados con ícono y texto, foco " +
            "visible, sin scroll horizontal a 360 px y `prefers-reduced-motion`). Una herramienta automática no detecta todos los problemas: " +
            "no equivale a certificar el cumplimiento de WCAG. Observación no cubierta por las herramientas: el texto de los ejes y la " +
            "leyenda de los gráficos (canvas) es de unos 12 px.",
    },
    {
        id: "P-SEG-CIFRADO",
        fila: "Seguridad → Cifrado",
        verifica: "Documental: no aplica en local (HTTP en localhost).",
        fuente: { tipo: "pruebas", id: "P-SEG-CIFRADO" },
        nota:
            "El prototipo se ejecuta en localhost por HTTP. Las pruebas verifican que en local la cookie va sin `Secure` y sin HSTS, " +
            "y que con `APP_URL` en https la cookie lleva `Secure` y la respuesta trae HSTS.",
    },
    { id: "P-SEG-EXPOSICION-BD", fila: "Seguridad → Exposición de la BD", verifica: "SQLite es un archivo local sin puerto de red.", fuente: { tipo: "pruebas", id: "P-SEG-EXPOSICION-BD" } },
    {
        id: "P-CAR-INGESTA",
        fila: "Carga → Ingesta",
        verifica: "768 tramas (un día de las 8 estaciones), de a 10 en paralelo: cero errores y cero lecturas perdidas.",
        fuente: { tipo: "carga", grupos: [GRUPO_INGESTA], sinPerdidas: true },
    },
    {
        id: "P-CAR-HISTORICO",
        fila: "Carga → Histórico",
        verifica: "Panel e historial de 1 año con 4 años de datos: p95 < 3 s; las consultas usan el índice (sensor_id, fecha).",
        fuente: { tipo: "carga", grupos: [GRUPO_PANEL, GRUPO_HISTORIAL], conIndice: true },
    },
    {
        id: "P-CAR-CONCURRENCIA",
        fila: "Carga → Concurrencia",
        verifica: "20 sesiones simultáneas: cero errores y p95 < 3 s.",
        fuente: { tipo: "carga", grupos: [GRUPO_CONCURRENCIA] },
    },
    { id: "P-INF-DESPLIEGUE", fila: "Infraestructura → Despliegue", verifica: "`build` + `start` y consulta a `/api/salud`.", fuente: { tipo: "pruebas", id: "P-INF-DESPLIEGUE" } },
    { id: "P-INF-RESPALDO", fila: "Infraestructura → Respaldo", verifica: "Respaldo diario y restauración con verificación de conteos.", fuente: { tipo: "pruebas", id: "P-INF-RESPALDO" } },
    { id: "P-INF-MONITOREO", fila: "Infraestructura → Monitoreo", verifica: "`/api/salud` ante una falla.", fuente: { tipo: "pruebas", id: "P-INF-MONITOREO" } },
];

const PATRON_ID = /\[((?:P-[A-Z0-9-]+)|(?:T\d+(?:\.\d+)*))\]/g;

/** IDs entre corchetes del nombre de una prueba, por ejemplo `[P-FUN-CU03]` o `[T6.1]`. */
export function idsDe(nombre: string): string[] {
    return [...new Set([...nombre.matchAll(PATRON_ID)].map((m) => m[1]))];
}

// --- Lectura de los reporteros JSON de Vitest y Playwright ---

interface JsonVitest {
    testResults: {
        name: string;
        status: string;
        message?: string;
        assertionResults: { ancestorTitles: string[]; title: string; status: string }[];
    }[];
}

const ESTADO_VITEST: Record<string, EstadoPrueba> = { passed: "pasa", failed: "falla" };

function relativo(archivo: string, raiz: string): string {
    const base = raiz.endsWith("/") ? raiz : `${raiz}/`;
    return archivo.startsWith(base) ? archivo.slice(base.length) : archivo;
}

export function leerVitest(json: JsonVitest, suite: NombreSuite, raiz: string): { ejecuciones: Ejecucion[]; archivosConError: string[] } {
    const ejecuciones: Ejecucion[] = [];
    const archivosConError: string[] = [];
    for (const archivo of json.testResults) {
        const ruta = relativo(archivo.name, raiz);
        if (archivo.status === "failed" && !archivo.assertionResults.some((a) => a.status === "failed")) archivosConError.push(ruta);
        for (const a of archivo.assertionResults) {
            ejecuciones.push({
                suite,
                archivo: ruta,
                nombre: [...a.ancestorTitles, a.title].join(" › "),
                // skipped, pending y todo: no se ejecutaron.
                estado: ESTADO_VITEST[a.status] ?? "omitida",
            });
        }
    }
    return { ejecuciones, archivosConError };
}

interface SuitePlaywright {
    title: string;
    file: string;
    specs?: { title: string; file: string; tests: { projectName: string; status: string }[] }[];
    suites?: SuitePlaywright[];
}

interface JsonPlaywright {
    config: { rootDir: string };
    suites: SuitePlaywright[];
    errors?: unknown[];
}

// flaky: falló y pasó al reintentar (en el CI); cuenta como aprobada.
const ESTADO_PLAYWRIGHT: Record<string, EstadoPrueba> = { expected: "pasa", flaky: "pasa", unexpected: "falla" };

export function leerPlaywright(json: JsonPlaywright, raiz: string): Ejecucion[] {
    const carpeta = relativo(json.config.rootDir, raiz);
    const ejecuciones: Ejecucion[] = [];
    const recorrer = (suite: SuitePlaywright, titulos: string[]) => {
        for (const spec of suite.specs ?? []) {
            for (const t of spec.tests) {
                ejecuciones.push({
                    suite: "e2e",
                    archivo: `${carpeta}/${spec.file}`,
                    nombre: [...titulos, spec.title].join(" › "),
                    proyecto: t.projectName,
                    estado: ESTADO_PLAYWRIGHT[t.status] ?? "omitida",
                });
            }
        }
        for (const hija of suite.suites ?? []) recorrer(hija, [...titulos, hija.title]);
    };
    // El primer nivel es el archivo; su título no forma parte del nombre de la prueba.
    for (const archivo of json.suites) recorrer(archivo, []);
    return ejecuciones;
}

// --- Evaluación de las filas ---

export type Resultado = "Aprobado" | "No aprobado" | "Sin ejecutar";

export interface Conteo {
    total: number;
    pasan: number;
    fallan: number;
    omitidas: number;
}

export interface FilaEvaluada {
    fila: FilaTesis;
    resultado: Resultado;
    conteo: Conteo | null;
    ejecuciones: Ejecucion[];
    /** Para las filas de carga: una línea por criterio verificado. */
    criterios: string[];
}

export function contar(ejecuciones: Ejecucion[]): Conteo {
    const n = (estado: EstadoPrueba) => ejecuciones.filter((e) => e.estado === estado).length;
    return { total: ejecuciones.length, pasan: n("pasa"), fallan: n("falla"), omitidas: n("omitida") };
}

const milisegundos = (n: number) => `${n.toLocaleString("es-CL")} ms`;

function evaluarCarga(fila: FilaTesis, fuente: Extract<Fuente, { tipo: "carga" }>, carga: InformeCarga | null): FilaEvaluada {
    if (!carga) return { fila, resultado: "Sin ejecutar", conteo: null, ejecuciones: [], criterios: [] };
    const criterios: string[] = [];
    let cumple = true;
    for (const nombre of fuente.grupos) {
        const g = carga.resultados.find((r) => r.grupo === nombre);
        if (!g) {
            cumple = false;
            criterios.push(`${nombre}: sin resultados en carga.json. No cumple.`);
            continue;
        }
        const ok = g.errores === 0 && g.p95Ms < carga.umbralP95Ms;
        cumple &&= ok;
        criterios.push(
            `${nombre}: ${g.consultas.toLocaleString("es-CL")} consultas, ${g.errores} errores, p95 de ${milisegundos(g.p95Ms)} ` +
                `(umbral: menos de ${milisegundos(carga.umbralP95Ms)}). ${ok ? "Cumple" : "No cumple"}.`,
        );
    }
    if (fuente.sinPerdidas) {
        const ok = carga.ingesta !== null && carga.ingesta.perdidas === 0;
        cumple &&= ok;
        criterios.push(
            carga.ingesta
                ? `Lecturas perdidas: ${carga.ingesta.perdidas} de ${carga.ingesta.lecturas.toLocaleString("es-CL")}. ${ok ? "Cumple" : "No cumple"}.`
                : "Ingesta sin ejecutar. No cumple.",
        );
    }
    if (fuente.conIndice) {
        const ok = carga.planIndice.includes("USING INDEX mediciones_sensor_fecha_unico");
        cumple &&= ok;
        criterios.push(`Plan de consulta (RNF06): \`${carga.planIndice}\`. ${ok ? "Cumple" : "No cumple"}.`);
    }
    return { fila, resultado: cumple ? "Aprobado" : "No aprobado", conteo: null, ejecuciones: [], criterios };
}

export function evaluarFilas(ejecuciones: Ejecucion[], carga: InformeCarga | null): FilaEvaluada[] {
    return FILAS_TESIS.map((fila) => {
        const { fuente } = fila;
        if (fuente.tipo === "carga") return evaluarCarga(fila, fuente, carga);
        const propias = ejecuciones.filter((e) => idsDe(e.nombre).includes(fuente.id) && (!fuente.archivo || fuente.archivo(e.archivo)));
        const conteo = contar(propias);
        const resultado: Resultado = conteo.fallan > 0 ? "No aprobado" : conteo.pasan > 0 ? "Aprobado" : "Sin ejecutar";
        return { fila, resultado, conteo, ejecuciones: propias, criterios: [] };
    });
}

// --- Markdown ---

const NOMBRE_SUITE: Record<NombreSuite, string> = {
    test: "Unitarias e integración (Vitest)",
    infra: "Infraestructura (Vitest)",
    e2e: "Extremo a extremo (Playwright)",
};

const ESTADO_TEXTO: Record<EstadoPrueba, string> = { pasa: "Pasa", falla: "Falla", omitida: "Omitida" };

function fechaChile(fecha: Date | string): string {
    return new Date(fecha).toLocaleString("es-CL", {
        timeZone: "America/Santiago",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

/** Celda de tabla: sin saltos de línea ni barras verticales sin escapar. */
const celda = (texto: string) => texto.replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ");

const plural = (n: number, uno: string, varios: string) => `${n.toLocaleString("es-CL")} ${n === 1 ? uno : varios}`;

function textoConteo(c: Conteo): string {
    if (c.total === 0) return "0";
    const partes = [plural(c.pasan, "pasa", "pasan")];
    if (c.fallan) partes.push(plural(c.fallan, "falla", "fallan"));
    if (c.omitidas) partes.push(plural(c.omitidas, "omitida", "omitidas"));
    return `${c.total} (${partes.join(", ")})`;
}

const ancla = (f: FilaTesis) =>
    `${f.id}-${f.fila}`
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

/** Agrupa las ejecuciones de una misma prueba en los distintos proyectos de Playwright. */
function lineasDetalle(ejecuciones: Ejecucion[]): string[] {
    const grupos = new Map<string, Ejecucion[]>();
    for (const e of ejecuciones) {
        const clave = `${e.archivo}\u0000${e.nombre}`;
        grupos.set(clave, [...(grupos.get(clave) ?? []), e]);
    }
    return [...grupos.values()].map((grupo) => {
        const { archivo, nombre } = grupo[0];
        if (!grupo[0].proyecto) return `- ${ESTADO_TEXTO[grupo[0].estado]} · \`${archivo}\` · ${nombre}`;
        const porEstado = (["pasa", "falla", "omitida"] as const)
            .map((estado) => {
                const proyectos = grupo.filter((e) => e.estado === estado).map((e) => e.proyecto);
                return proyectos.length ? `${ESTADO_TEXTO[estado]} en ${proyectos.join(", ")}` : null;
            })
            .filter(Boolean);
        return `- ${porEstado.join("; ")} · \`${archivo}\` · ${nombre}`;
    });
}

export interface DatosInforme {
    contexto: Contexto;
    suites: ResultadoSuite[];
    ejecuciones: Ejecucion[];
    carga: InformeCarga | null;
}

export function generarInforme({ contexto, suites, ejecuciones, carga }: DatosInforme): string {
    const filas = evaluarFilas(ejecuciones, carga);
    const cuenta = (r: Resultado) => filas.filter((f) => f.resultado === r).length;
    const total = contar(ejecuciones);
    const commit = contexto.commit
        ? `commit \`${contexto.commit}\`${contexto.cambiosSinCommit ? ", con cambios sin commit" : ""}`
        : "fuera de un repositorio git";

    const md: string[] = [
        "# Informe de evidencia",
        "",
        `Generado por \`npm run evidencia\` el ${fechaChile(contexto.fecha)} (hora de Chile), sobre el ${commit}.`,
        `Equipo: ${contexto.equipo}.`,
        "",
        "Cada fila corresponde a una prueba del capítulo 9 de la tesis (`docs/spec/diseno.md` §12). Una fila está",
        "«Aprobado» si tiene al menos una prueba y ninguna falla; «No aprobado» si alguna falla; «Sin ejecutar» si no",
        "hay resultados. Las pruebas de extremo a extremo se cuentan una vez por proyecto de Playwright (Chromium y",
        "WebKit, en escritorio y celular). Las filas de carga salen de `evidencia/carga.json` (`npm run test:carga`),",
        "que este comando no vuelve a ejecutar.",
        "",
        "## Resumen",
        "",
        `- **${cuenta("Aprobado")} de ${filas.length} filas aprobadas**; ${plural(cuenta("No aprobado"), "no aprobada", "no aprobadas")}; ${cuenta("Sin ejecutar")} sin ejecutar.`,
        `- ${total.total.toLocaleString("es-CL")} ejecuciones de prueba: ${plural(total.pasan, "pasa", "pasan")}, ` +
            `${plural(total.fallan, "falla", "fallan")} y ${plural(total.omitidas, "se omitió", "se omitieron")}.`,
    ];
    if (carga) md.push(`- Carga medida el ${fechaChile(carga.fecha)}, con ${carga.base.mediciones.toLocaleString("es-CL")} mediciones (${carga.base.tamanoMB.toLocaleString("es-CL")} MB).`);
    else md.push("- Carga sin ejecutar: falta `evidencia/carga.json` (`npm run historico -- --anios 4` y `npm run test:carga`).");

    md.push("", "## Resultados por fila de la tesis", "", "| ID | Fila de la tesis | Qué verifica | Pruebas | Resultado |", "|---|---|---|---|---|");
    for (const f of filas) {
        const pruebas = f.conteo ? textoConteo(f.conteo) : carga ? `carga.json (${fechaChile(carga.fecha)})` : "—";
        md.push(`| [${f.fila.id}](#${ancla(f.fila)}) | ${celda(f.fila.fila)} | ${celda(f.fila.verifica)} | ${pruebas} | **${f.resultado}** |`);
    }

    md.push("", "## Suites ejecutadas", "", "| Suite | Comando | Pruebas | Duración | Resultado |", "|---|---|---|---|---|");
    for (const s of suites) {
        const propias = contar(ejecuciones.filter((e) => e.suite === s.suite));
        const resultado = !s.conResultados ? "Sin resultados" : s.codigoSalida === 0 ? "Termina sin errores" : `Termina con error (código ${s.codigoSalida})`;
        md.push(`| ${NOMBRE_SUITE[s.suite]} | \`${s.comando}\` | ${textoConteo(propias)} | ${Math.round(s.segundos).toLocaleString("es-CL")} s | ${resultado} |`);
    }
    md.push(`| Carga | \`npm run test:carga\` | — | — | ${carga ? `No se ejecuta aquí; resultados del ${fechaChile(carga.fecha)}` : "Sin ejecutar"} |`);
    const conError = suites.flatMap((s) => s.archivosConError);
    if (conError.length) md.push("", `Archivos que no llegaron a ejecutar sus pruebas: ${conError.map((a) => `\`${a}\``).join(", ")}.`);

    md.push("", "## Detalle por fila");
    for (const f of filas) {
        md.push("", `### <a id="${ancla(f.fila)}"></a>${f.fila.id} · ${f.fila.fila}`, "", `**${f.resultado}.** ${f.fila.verifica}`);
        if (f.fila.nota) md.push("", f.fila.nota);
        md.push("");
        if (f.criterios.length) md.push(...f.criterios.map((c) => `- ${c}`));
        else if (f.ejecuciones.length) md.push(...lineasDetalle(f.ejecuciones));
        else md.push(f.fila.fuente.tipo === "carga" ? "- Falta `evidencia/carga.json`." : "- No se encontraron pruebas con este ID.");
    }

    // Anexo: pruebas con un ID que no es una fila de la tesis (IDs de tarea, por ejemplo `[T6.1]`).
    const idsTesis = new Set(FILAS_TESIS.flatMap((f) => (f.fuente.tipo === "pruebas" ? [f.fuente.id] : [])));
    const complementarias = new Map<string, Ejecucion[]>();
    const sinId: Ejecucion[] = [];
    for (const e of ejecuciones) {
        const ids = idsDe(e.nombre);
        if (ids.length === 0) sinId.push(e);
        for (const id of ids.filter((i) => !idsTesis.has(i))) complementarias.set(id, [...(complementarias.get(id) ?? []), e]);
    }
    const ordenNatural = (a: string, b: string) => a.localeCompare(b, "es", { numeric: true });
    md.push(
        "",
        "## Anexo: pruebas complementarias",
        "",
        "Pruebas que llevan el ID de su tarea en `docs/spec/tareas.md`, porque no respaldan una fila de la tesis.",
        "",
        "| ID | Pruebas | Resultado |",
        "|---|---|---|",
    );
    for (const id of [...complementarias.keys()].sort(ordenNatural)) {
        const c = contar(complementarias.get(id)!);
        md.push(`| ${id} | ${textoConteo(c)} | ${c.fallan ? "No aprobado" : c.pasan ? "Aprobado" : "Sin ejecutar"} |`);
    }
    if (sinId.length) {
        md.push("", `Pruebas sin ID en el nombre: ${sinId.length} (${textoConteo(contar(sinId))}).`, "", ...lineasDetalle(sinId));
    }

    return md.join("\n") + "\n";
}

/** El comando falla si una suite terminó con error o alguna fila no está aprobada. */
export function hayFallas(suites: ResultadoSuite[], ejecuciones: Ejecucion[], carga: InformeCarga | null): boolean {
    return suites.some((s) => s.codigoSalida !== 0 || !s.conResultados) || evaluarFilas(ejecuciones, carga).some((f) => f.resultado === "No aprobado");
}
