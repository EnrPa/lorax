# Pruebas de carga

Generado por `npm run test:carga` (07-10-2026, 11:07:55 p. m.).

## Base de datos

- Archivo: `./data/carga/lorax.db` (2.364 MB).
- 6.865.848 mediciones de 48 sensores, del 2022-09-09 al 2026-10-08.
- Plan de consulta por sensor y rango: `SEARCH mediciones USING INDEX mediciones_sensor_fecha_unico (sensor_id=? AND fecha>? AND fecha<?)`.

## Tiempos de respuesta (versión de producción)

Umbral de RNF01: p95 menor que 3.000 ms.

| Grupo | Consultas | Errores | p50 | p95 | Máximo |
|---|---|---|---|---|---|
| Panel de estado | 30 | 0 | 5 ms | 9 ms | 24 ms |
| Historial de 1 año | 30 | 0 | 131 ms | 141 ms | 143 ms |
| 20 usuarios simultáneos | 400 | 0 | 450 ms | 787 ms | 2.844 ms |
| Ingesta (por trama) | 768 | 0 | 17 ms | 41 ms | 56 ms |

## Ingesta

- 768 tramas (4.608 lecturas) de a 10 en paralelo, en 1,6 s (2.814 lecturas por segundo). Lecturas perdidas: 0.

## Equipo

- Intel(R) Core(TM) Ultra 7 155H, 22 núcleos, 15 GB de memoria; linux 7.1.4; Node.js v24.18.0.
