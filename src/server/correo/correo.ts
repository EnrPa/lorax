// Correo escrito a archivos (diseno.md D6): un JSON por mensaje en data/correos/, visible en /dev/correos.
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { carpetaCorreos, REMITENTE_CORREO } from "~/server/config";

export interface Correo {
    id: string;
    fecha: string;
    de: string;
    para: string;
    asunto: string;
    texto: string;
}

export async function enviarCorreo(datos: { para: string; asunto: string; texto: string }, ahora = new Date()): Promise<Correo> {
    const correo: Correo = { id: randomUUID(), fecha: ahora.toISOString(), de: REMITENTE_CORREO, ...datos };
    const carpeta = carpetaCorreos();
    await mkdir(carpeta, { recursive: true });
    // El nombre empieza con la fecha para que el orden alfabético sea el cronológico.
    const nombre = `${correo.fecha.replace(/[:.]/g, "-")}_${correo.id}.json`;
    await writeFile(join(carpeta, nombre), JSON.stringify(correo, null, 2), "utf8");
    // Nunca se registra el contenido: puede llevar enlaces de un solo uso.
    console.log(`[correo] Enviado a ${correo.para}: «${correo.asunto}» (ver /dev/correos)`);
    return correo;
}

/** Correos guardados, del más nuevo al más antiguo. */
export async function listarCorreos(): Promise<Correo[]> {
    const carpeta = carpetaCorreos();
    let archivos: string[];
    try {
        archivos = (await readdir(carpeta)).filter((a) => a.endsWith(".json"));
    } catch {
        return [];
    }
    archivos.sort().reverse();
    return Promise.all(archivos.map(async (a) => JSON.parse(await readFile(join(carpeta, a), "utf8")) as Correo));
}
