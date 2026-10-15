// Fechas para la interfaz (diseno.md D7 y §9): relativas y absolutas, en hora de Chile.

const ZONA = "America/Santiago";
const hora = new Intl.DateTimeFormat("es-CL", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: ZONA });
const diaHora = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: ZONA });
const dia = new Intl.DateTimeFormat("es-CL", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: ZONA });

/** «hace un momento», «hace 12 min», «hace 3 h», «hace 2 días». */
export function haceCuanto(fecha: Date, ahora: Date): string {
    const minutos = Math.max(0, Math.floor((ahora.getTime() - fecha.getTime()) / 60_000));
    if (minutos < 1) return "hace un momento";
    if (minutos < 60) return `hace ${minutos} min`;
    const horas = Math.floor(minutos / 60);
    if (horas < 24) return `hace ${horas} h`;
    const dias = Math.floor(horas / 24);
    return dias === 1 ? "hace 1 día" : `hace ${dias} días`;
}

/** Hora absoluta: solo la hora si es del mismo día; si no, también la fecha. */
export function horaAbsoluta(fecha: Date, ahora: Date): string {
    return dia.format(fecha) === dia.format(ahora) ? hora.format(fecha) : diaHora.format(fecha);
}

/** «hace 12 min · 14:05» (diseno.md §9). */
export function fechaRelativa(fecha: Date | string, ahora: Date): string {
    const f = typeof fecha === "string" ? new Date(fecha) : fecha;
    return `${haceCuanto(f, ahora)} · ${horaAbsoluta(f, ahora)}`;
}

/** Hora corta para los ejes de los gráficos («14:00»). */
export const horaEje = (ms: number) => hora.format(new Date(ms));

const horaLocal = new Intl.DateTimeFormat("es-CL", { hour: "numeric", hourCycle: "h23", timeZone: ZONA });

/** Marcas del eje de tiempo: horas enteras (en hora de Chile) múltiplos de `cadaHoras`, dentro del rango. */
export function marcasHorarias(desde: number, hasta: number, cadaHoras: number): number[] {
    const HORA = 3_600_000;
    const marcas: number[] = [];
    for (let t = Math.ceil(desde / HORA) * HORA; t <= hasta; t += HORA) {
        if (Number(horaLocal.format(new Date(t))) % cadaHoras === 0) marcas.push(t);
    }
    return marcas;
}

// ——— Días de Chile ↔ instantes (diseno.md §8.3). Sin librerías: se usa la zona horaria real de Intl. ———

const partesChile = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONA,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
});

function partes(ms: number) {
    const p = Object.fromEntries(partesChile.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
    return { dia: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}:${p.second}`, p };
}

/** Diferencia entre la hora de Chile y UTC en ese instante (−3 o −4 h), en ms. */
function desfaseChile(ms: number): number {
    const { p } = partes(ms);
    const comoUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
    return comoUtc - Math.floor(ms / 1000) * 1000;
}

/** «2026-09-26» del instante, en hora de Chile. */
export function diaChile(fecha: Date | number): string {
    return partes(typeof fecha === "number" ? fecha : fecha.getTime()).dia;
}

/** «2026-09-26 14:05:00» en hora de Chile (columna fecha_hora del CSV). */
export function fechaHoraChile(fecha: Date | number): string {
    const { dia: d, hora: h } = partes(typeof fecha === "number" ? fecha : fecha.getTime());
    return `${d} ${h}`;
}

/** Suma días a una fecha «AAAA-MM-DD» (aritmética de calendario, sin zona horaria). */
export function sumarDias(dia: string, dias: number): string {
    const [a, m, d] = dia.split("-").map(Number);
    return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

/**
 * Primer instante del día en Chile. Normalmente son las 00:00, pero el día en que empieza el
 * horario de verano los relojes saltan de 23:59 a 01:00, y entonces el día empieza a la 01:00.
 */
export function inicioDelDiaChile(dia: string): Date {
    const [a, m, d] = dia.split("-").map(Number);
    const ingenuo = Date.UTC(a, m - 1, d);
    // Candidatos con los desfases vigentes alrededor de ese día; gana el más temprano que cae en él.
    const candidatos = [ingenuo - 86_400_000, ingenuo, ingenuo + 86_400_000]
        .map((ref) => ingenuo - desfaseChile(ref))
        .filter((t) => diaChile(t) === dia);
    return new Date(Math.min(...candidatos));
}

/** Rango semiabierto de los campos de día: [00:00 de «Desde», 00:00 del día siguiente a «Hasta»). */
export function rangoDeDias(desde: string, hasta: string): { desde: Date; hasta: Date } {
    return { desde: inicioDelDiaChile(desde), hasta: inicioDelDiaChile(sumarDias(hasta, 1)) };
}

const diaCorto = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", timeZone: ZONA });

/** «25 sept» para los ejes de rangos largos. */
export const fechaEje = (ms: number) => diaCorto.format(new Date(ms));

/** «25 sept, 14:00» para el detalle de un punto. */
export const fechaHoraEje = (ms: number) => diaHora.format(new Date(ms));

/** Marcas del eje en el inicio de los días de Chile, a lo más `maximo`, repartidas de forma pareja. */
export function marcasDiarias(desde: number, hasta: number, maximo: number): number[] {
    const dias: number[] = [];
    for (let dia = diaChile(desde); ; dia = sumarDias(dia, 1)) {
        const inicio = inicioDelDiaChile(dia).getTime();
        if (inicio > hasta) break;
        if (inicio >= desde) dias.push(inicio);
    }
    const paso = Math.max(1, Math.ceil(dias.length / maximo));
    return dias.filter((_, i) => i % paso === 0);
}

const diaHoraAnio = new Intl.DateTimeFormat("es-CL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: ZONA,
});

/** «Del 26 sept, 20:25 al 27 sept, 20:25»; con el año si los extremos caen en años distintos. */
export function periodoTexto(desde: Date | number, hasta: Date | number): string {
    const [d, h] = [new Date(desde), new Date(hasta)];
    const mismoAnio = diaChile(d).slice(0, 4) === diaChile(h).slice(0, 4);
    const f = mismoAnio ? diaHora : diaHoraAnio;
    return `Del ${f.format(d)} al ${f.format(h)}`;
}
