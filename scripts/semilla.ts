// Carga los datos piloto (diseno.md §10) en una base recién migrada.
// Las alertas no se inventan: se obtienen aplicando las reglas de §8.2 a la historia generada,
// así que siempre coinciden con las mediciones.
import { eq, sql } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { esRutValido } from "~/lib/rut";
import { VARIABLES } from "~/lib/variables";
import { hashContrasena } from "~/server/auth/contrasenas";
import type { BaseDatos } from "~/server/db/cliente";
import {
    alertas,
    clientes,
    criterios,
    cuentas,
    empresas,
    estaciones,
    eventos,
    mediciones,
    notificaciones,
    sensores,
    terrenos,
} from "~/server/db/esquema";
import {
    ADMINISTRADOR,
    CONTRASENA_DEMO,
    CRITERIOS_PILOTO,
    INTERVALO_SEGUNDOS,
    MODELO_ESTACION,
    PRODUCTORES,
    SITUACIONES,
    TIPO_ESTACION,
    type EstacionPiloto,
    type TerrenoPiloto,
} from "./datos-piloto";
import {
    crearEvaluador,
    finDeHistoria,
    inicioDeHistoria,
    INTERVALO_MS,
    MS_DIA,
    MS_HORA,
    tramaDe,
    ventanasDeSequia,
    type CriterioEvaluable,
} from "./generacion";
import { ModeloEstacion } from "./modelo-valores";

export { finDeHistoria };

export interface ResumenSemilla {
    inicio: Date;
    fin: Date;
    cuentas: number;
    terrenos: number;
    estaciones: number;
    sensores: number;
    criterios: number;
    mediciones: number;
    alertas: number;
    notificaciones: number;
    eventos: number;
}

export async function sembrar(bd: BaseDatos, ahora = new Date()): Promise<ResumenSemilla> {
    const existentes = bd.select({ total: sql<number>`count(*)` }).from(cuentas).get()?.total ?? 0;
    if (existentes > 0) {
        throw new Error("La base ya tiene datos. Usa `npm run db:reiniciar` para recrearla desde cero.");
    }
    for (const { empresa } of PRODUCTORES) {
        if (!esRutValido(empresa.rut)) throw new Error(`RUT inválido en los datos piloto: ${empresa.rut}`);
    }

    // scrypt es lento a propósito: se calcula antes de abrir la transacción, uno a la vez.
    const hashAdministrador = await hashContrasena(CONTRASENA_DEMO);
    const hashesProductores: string[] = [];
    for (const _ of PRODUCTORES) hashesProductores.push(await hashContrasena(CONTRASENA_DEMO));

    const fin = finDeHistoria(ahora);
    const inicio = inicioDeHistoria(fin);
    const alta = new Date(inicio.getTime() - MS_DIA);
    const haceDias = (dias: number) => new Date(fin.getTime() - dias * MS_DIA);

    bd.transaction((tx) => {
        const administrador = tx
            .insert(cuentas)
            .values({ ...ADMINISTRADOR, contrasenaHash: hashAdministrador, rol: "ADMINISTRADOR" })
            .returning()
            .get();

        const sensoresPorEstacion = new Map<string, Map<string, number>>();
        const terrenoDeEstacion = new Map<string, TerrenoPiloto>();
        const estacionesSembradas: Array<{ estacion: EstacionPiloto; terreno: TerrenoPiloto }> = [];
        const cuentaPorCorreo = new Map<string, number>();

        PRODUCTORES.forEach((productor, i) => {
            const empresa = tx.insert(empresas).values(productor.empresa).returning().get();
            const cuenta = tx
                .insert(cuentas)
                .values({
                    correo: productor.correo,
                    nombre: productor.nombre,
                    apellido: productor.apellido,
                    telefono: productor.telefono,
                    contrasenaHash: hashesProductores[i],
                    rol: "PRODUCTOR",
                    habilitada: productor.habilitada,
                })
                .returning()
                .get();
            cuentaPorCorreo.set(productor.correo, cuenta.id);
            const cliente = tx
                .insert(clientes)
                .values({ cargo: productor.cargo, empresaId: empresa.id, cuentaId: cuenta.id })
                .returning()
                .get();

            tx.insert(eventos)
                .values({
                    cuentaId: administrador.id,
                    tipo: "OPERACION_ADMINISTRATIVA",
                    entidad: "cuentas",
                    entidadId: cuenta.id,
                    detalle: { accion: "CREAR_CUENTA", correo: productor.correo },
                    fecha: new Date(alta.getTime() - (PRODUCTORES.length - i) * MS_HORA),
                })
                .run();

            for (const terreno of productor.terrenos) {
                const terrenoFila = tx
                    .insert(terrenos)
                    .values({
                        clienteId: cliente.id,
                        nombre: terreno.nombre,
                        latitud: terreno.latitud,
                        longitud: terreno.longitud,
                        superficie: terreno.superficie,
                        tipoCultivo: terreno.tipoCultivo,
                        fechaUltimaActualizacion: alta,
                    })
                    .returning()
                    .get();

                for (const estacion of terreno.estaciones) {
                    const estacionFila = tx
                        .insert(estaciones)
                        .values({
                            terrenoId: terrenoFila.id,
                            tipo: TIPO_ESTACION,
                            modelo: MODELO_ESTACION,
                            numeroSerie: estacion.numeroSerie,
                            latitud: estacion.latitud,
                            longitud: estacion.longitud,
                            fechaCreacion: alta,
                            fechaUltimaActualizacion: alta,
                        })
                        .returning()
                        .get();

                    const porCodigo = new Map<string, number>();
                    for (const variable of VARIABLES) {
                        const sensor = tx
                            .insert(sensores)
                            .values({
                                estacionId: estacionFila.id,
                                codigo: variable.codigo,
                                tipo: variable.tipo,
                                unidad: variable.unidad,
                                rangoMinimo: variable.rangoMinimo,
                                rangoMaximo: variable.rangoMaximo,
                                intervaloMedicion: INTERVALO_SEGUNDOS,
                                fechaCreacion: alta,
                            })
                            .returning()
                            .get();
                        porCodigo.set(variable.codigo, sensor.id);
                    }
                    sensoresPorEstacion.set(estacion.numeroSerie, porCodigo);
                    terrenoDeEstacion.set(estacion.numeroSerie, terreno);
                    estacionesSembradas.push({ estacion, terreno });
                }
            }
        });

        // Criterios de ejemplo.
        const criteriosPorSensor = new Map<number, CriterioEvaluable[]>();
        for (const definicion of CRITERIOS_PILOTO) {
            const sensorId = sensoresPorEstacion.get(definicion.numeroSerie)?.get(definicion.codigo);
            if (sensorId === undefined) throw new Error(`Criterio sobre un sensor inexistente: ${definicion.numeroSerie}/${definicion.codigo}`);
            const fila = tx
                .insert(criterios)
                .values({
                    sensorId,
                    severidad: definicion.severidad,
                    umbral: definicion.umbral,
                    condicion: definicion.condicion,
                    canales: definicion.canales.join(","),
                    fechaCreacion: alta,
                })
                .returning()
                .get();
            const activos = criteriosPorSensor.get(sensorId) ?? [];
            activos.push({
                id: fila.id,
                condicion: definicion.condicion,
                umbral: definicion.umbral,
                severidad: definicion.severidad,
                canales: definicion.canales,
                terreno: terrenoDeEstacion.get(definicion.numeroSerie)!.nombre,
                numeroSerie: definicion.numeroSerie,
                vigente: null,
            });
            criteriosPorSensor.set(sensorId, activos);
        }

        // Mediciones: SQL preparado, porque son ~138 mil filas.
        const sqlite = bd.$client;
        const insertarMedicion = sqlite.prepare(
            "INSERT INTO mediciones (sensor_id, valor, fecha, payload) VALUES (?, ?, ?, ?)",
        );
        // Historia simulada: las notificaciones quedan ENVIADA sin enviarse (§10).
        const evaluar = crearEvaluador(tx, { notificaciones: "ENVIADA" });

        const { estacionSilenciosa, sequias } = SITUACIONES;
        const finSilencio = fin.getTime() - estacionSilenciosa.horasSinReportar * MS_HORA;

        for (const { estacion, terreno } of estacionesSembradas) {
            const modelo = new ModeloEstacion(estacion, terreno.clima, ventanasDeSequia(estacion.numeroSerie, fin));
            const porCodigo = sensoresPorEstacion.get(estacion.numeroSerie)!;
            const ultimaFecha = estacion.numeroSerie === estacionSilenciosa.numeroSerie ? finSilencio : fin.getTime();

            for (let ms = inicio.getTime(); ms <= ultimaFecha; ms += INTERVALO_MS) {
                const fecha = new Date(ms);
                // Primero las lecturas y luego la meta: el orden importa para que el generador sea reproducible.
                const { lecturas, payload } = tramaDe(estacion.numeroSerie, fecha, modelo.lecturas(fecha), modelo.meta());

                for (const { codigo, valor } of lecturas) {
                    const sensorId = porCodigo.get(codigo)!;
                    const medicionId = Number(insertarMedicion.run(sensorId, valor, ms, payload).lastInsertRowid);
                    // Evaluación de criterios (diseno.md §8.2).
                    for (const criterio of criteriosPorSensor.get(sensorId) ?? []) evaluar(criterio, codigo, valor, medicionId, ms);
                }
            }
        }

        // Fecha de la última lectura de cada sensor.
        sqlite.exec(
            "UPDATE sensores SET fecha_ultima_lectura = (SELECT max(fecha) FROM mediciones WHERE sensor_id = sensores.id)",
        );

        // La alerta resuelta más antigua de la sequía queda leída; las demás, sin leer.
        const sensorSequia = sensoresPorEstacion.get(sequias.numeroSerie)!.get("hum_suelo")!;
        const criterioSequia = criteriosPorSensor.get(sensorSequia)![0];
        const primeraResuelta = tx
            .select({ id: alertas.id })
            .from(alertas)
            .where(sql`${alertas.criterioId} = ${criterioSequia.id} AND ${alertas.estado} = 'RESUELTA'`)
            .orderBy(alertas.fecha)
            .limit(1)
            .get();
        if (primeraResuelta) tx.update(alertas).set({ leida: true }).where(eq(alertas.id, primeraResuelta.id)).run();

        // Eventos de ejemplo para la vista de administración.
        const deshabilitada = PRODUCTORES.find((p) => !p.habilitada)!;
        const habilitada = PRODUCTORES[0];
        tx.insert(eventos)
            .values([
                {
                    cuentaId: administrador.id,
                    tipo: "OPERACION_ADMINISTRATIVA",
                    entidad: "cuentas",
                    entidadId: cuentaPorCorreo.get(deshabilitada.correo),
                    motivo: "El productor dejó de trabajar con la plataforma.",
                    detalle: { accion: "DESHABILITAR_CUENTA" },
                    fecha: haceDias(12),
                },
                {
                    tipo: "ACCESO_FALLIDO",
                    detalle: { correo: habilitada.correo, causa: "CREDENCIALES_INVALIDAS" },
                    fecha: haceDias(8),
                },
                {
                    tipo: "ACCESO_FALLIDO",
                    detalle: { correo: deshabilitada.correo, causa: "CUENTA_DESHABILITADA" },
                    fecha: haceDias(5),
                },
                {
                    tipo: "TRAMA_RECHAZADA",
                    detalle: { causa: "CREDENCIAL_INVALIDA" },
                    fecha: haceDias(15),
                },
                {
                    tipo: "TRAMA_RECHAZADA",
                    detalle: {
                        causa: "ESTACION_DESCONOCIDA",
                        trama: { numero_serie: "EST-9999", fecha: haceDias(7).toISOString(), lecturas: [{ codigo: "temp_aire", valor: 12.4 }] },
                    },
                    fecha: haceDias(7),
                },
                {
                    tipo: "TRAMA_RECHAZADA",
                    detalle: {
                        causa: "VALOR_FUERA_DE_RANGO",
                        trama: { numero_serie: "EST-0002", fecha: haceDias(3).toISOString(), lecturas: [{ codigo: "hum_aire", valor: 140 }] },
                    },
                    fecha: haceDias(3),
                },
            ])
            .run();
    });

    const contar = (tabla: SQLiteTable) => bd.select({ total: sql<number>`count(*)` }).from(tabla).get()!.total;

    return {
        inicio,
        fin,
        cuentas: contar(cuentas),
        terrenos: contar(terrenos),
        estaciones: contar(estaciones),
        sensores: contar(sensores),
        criterios: contar(criterios),
        mediciones: contar(mediciones),
        alertas: contar(alertas),
        notificaciones: contar(notificaciones),
        eventos: contar(eventos),
    };
}
