# Resumen de evidencia para el capítulo 9

**Estado del plan.**

- Las ocho tareas de la Fase 6 (T6.1 a T6.8) están terminadas. T6.8 es la corrección de la incidencia 5.
- T4.1 (script de capturas) se hizo el 13-10-2026 y se revisó el 14-10-2026. Las 12 capturas de la tesis
  están en `evidencia/capturas/` (`npm run capturas`).
- Solo queda pendiente T4.2 (revisión con el equipo), pospuesta por decisión del usuario el 2026-09-26.

**Sobre esta ejecución.**

- Los comandos se ejecutaron con **npm**, el gestor de paquetes del proyecto (`diseno.md`, D8). pnpm no está
  instalado en el equipo.
- Los resultados de este resumen son los de la **ronda 3**, después de corregir la incidencia 6 y de cambiar
  las pestañas para pantallas angostas. Las rondas 1 y 2 se conservan en «Comandos ejecutados» porque en
  ellas ocurrieron incidencias.
- El código corresponde al commit `7ccd289` más cambios todavía sin commit:
  - el informe de evidencia (T6.6), el README (T6.7) y las capturas (T4.1);
  - las correcciones de las incidencias 3, 5 (T6.8) y 6;
  - las pestañas que pasan a una segunda línea a 390 px (`src/styles/Pestanas.css`, `diseno.md` §9).
- El detalle completo, prueba por prueba, está en [informe.md](informe.md), generado en la ronda 3.

## Ambiente

| Elemento | Valor |
|---|---|
| Fecha y hora | Hora de Chile (UTC−3). Ronda 1: 13-10-2026, de 22:54 a 23:03. Ronda 2: 13-10-2026, de 23:32 a 23:38. Ronda 3: 14-10-2026, de 00:20 a 01:07, con `npm run evidencia` de 01:03:56 a 01:06:48. |
| Sistema operativo | NixOS 26.05 (Yarara), kernel Linux 7.1.4 |
| CPU | Intel Core Ultra 7 155H, 22 hilos |
| Memoria | 15 GiB |
| Node.js | v24.18.0 |
| npm | 11.16.0 (pnpm: no instalado, no se usa) |
| Vitest | 5.0.2 |
| Playwright | 1.59.1, con Chromium 147.0.7727.15 y WebKit 26.4 |
| Base de datos | SQLite, archivo local. Semilla de demostración: 5 cuentas, 3 terrenos, 8 estaciones, 48 sensores y 138.168 mediciones, cargada en 2,0 s. |

Las pruebas de carga se midieron en el mismo equipo el **07-10-2026 a las 23:07**, sobre una base aparte de
4 años (ver P-CAR más abajo). No se repitieron en ninguna de las tres rondas.

## Comandos ejecutados

**Ronda 1** (13-10-2026, antes de la corrección de la incidencia 5):

| Orden | Comando | Resultado |
|---|---|---|
| 1 | `npm run db:reiniciar` | Correcto. Base recreada y semilla cargada en 2,0 s. |
| 2 | `npm run typecheck` | Correcto, sin errores de tipos. |
| 3 | `npm test` | 28 archivos, 291 de 291 pruebas pasan, en 22,2 s. |
| 4 | `npm run test:e2e` | **Falló:** 139 pasan, 5 fallan, 4 se omiten y 9 no corren, en 2,8 min. Las 5 fallas fueron en WebKit celular, por tiempo de espera (incidencia 4). |
| 5 | `npm run evidencia` | Correcto: Vitest 291 de 291, infraestructura 1 de 1 y Playwright 153 pasan con 4 omitidas. |
| 6 | `npm run test:e2e` (repetición) | Correcto: 153 pasan y 4 se omiten, en 2,0 min. |
| 7 | `npm run db:al-dia` | Correcto: agregó mediciones hasta la hora actual a 7 estaciones; EST-0003 se mantiene sin datos recientes, a propósito. |

**Ronda 2** (13-10-2026, después de la corrección de la incidencia 5):

| Orden | Comando | Resultado |
|---|---|---|
| 1 | `npm run typecheck` | Correcto, sin errores de tipos. |
| 2 | `npm test` | 28 archivos, 291 de 291 pruebas pasan, en 23,5 s. |
| 3 | `npm run test:e2e` | Correcto: 165 pasan y 4 se omiten, en 2,0 min. |
| 4 | `npm run evidencia` | Correcto: 26 de 26 filas aprobadas. Vitest 291 de 291, infraestructura 1 de 1 y Playwright 165 pasan con 4 omitidas. |

**Ronda 3** (14-10-2026, después del cambio de las pestañas y de la corrección de la incidencia 6):

| Orden | Comando | Resultado |
|---|---|---|
| 1 | `npm run typecheck` y `npm test` | Correcto: sin errores de tipos; 291 de 291 pruebas pasan. |
| 2 | `npm run test:e2e` (00:20) | **Falló:** 152 pasan, 4 fallan, 4 se omiten y 9 no corren, en 1,8 min. Las 4 fallas fueron `[P-E2E-HISTORIAL]`, en los 4 proyectos (incidencia 6). Las 60 de accesibilidad `[T6.5]` pasaron con las pestañas nuevas. |
| 3 | `npx playwright test tests/e2e/historial.spec.ts` en los 4 proyectos de lectura (00:59), con la prueba corregida | **Falló** por tiempo de espera, con el servidor recién iniciado: cada prueba tardó de 26 a 33 s (incidencia 4). |
| 4 | La misma prueba, solo en Chromium y luego en los 4 proyectos (01:00 y 01:02) | Correcto: pasa en los 4 proyectos, en 3 a 5 s cada uno. Se ejecutó dentro de la franja de 00:00 a 03:00 en que antes fallaba. |
| 5 | `npm run evidencia` (01:03 a 01:06) | Correcto: **26 de 26 filas aprobadas**. Vitest 291 de 291, infraestructura 1 de 1 y Playwright **165 pasan con 4 omitidas**. Genera [informe.md](informe.md). |

## Resultados por prueba de la tesis

- **Casos:** pruebas distintas. En Playwright, una misma prueba corre en varios proyectos (Chromium y WebKit,
  en escritorio y celular); entre paréntesis va el número de ejecuciones.
- **Duración:** tiempo acumulado de los casos en la ejecución de `npm run evidencia` de la ronda 3. Las
  pruebas corren en paralelo, así que la suma no equivale al tiempo de reloj.

| ID | Fila de la tesis | Archivos | Casos | Resultado | Duración | Métrica |
|---|---|---|---|---|---|---|
| P-FUN-CU01 | Funcionales → CU01 | `integracion/auth-api`, `integracion/intentos`, `integracion/recuperacion`, `e2e/login`, `e2e/seguridad`, `e2e/recuperacion` | 39 (63 ejecuciones) | Aprobado | 129,6 s | — |
| P-FUN-CU02 | Funcionales → CU02 | `integracion/terrenos`, `e2e/terrenos` | 9 | Aprobado | 1,9 s | — |
| P-FUN-CU03 | Funcionales → CU03 | `integracion/ingesta` | 2 | Aprobado | 0,3 s | — |
| P-FUN-CU04 | Funcionales → CU04 | `integracion/estado` | 11 | Aprobado | 0,4 s | — |
| P-FUN-CU05 | Funcionales → CU05 | `integracion/historial`, `unit/fechas` | 16 | Aprobado | 0,9 s | — |
| P-FUN-CU06 | Funcionales → CU06 (configuración) | `integracion/criterios` | 9 | Aprobado | 0,1 s | — |
| P-FUN-CU06 | Funcionales → CU06 (evaluación) | `integracion/evaluacion` | 6 | Aprobado | 0,5 s | — |
| P-FUN-CU07 | Funcionales → CU07 (fila por agregar) | `integracion/admin`, `e2e/admin` | 17 | Aprobado | 7,5 s | — |
| P-INT-INGESTA | Integraciones → Ingesta de tramas | `integracion/ingesta` | 20 | Aprobado | < 0,1 s | — |
| P-INT-NOTIFICACION | Integraciones → Notificación de alertas | `integracion/evaluacion` | 7 | Aprobado | 0,2 s | — |
| P-INT-API | Integraciones → Consumo de la API REST | `integracion/acceso-paginas`, `integracion/solo-desarrollo`, `e2e/sesion` | 16 (34 ejecuciones) | Aprobado | 63,1 s | — |
| P-E2E-INGESTA-PANEL | Integrales → Ingesta a visualización | `e2e/flujos` | 1 | Aprobado | 2,5 s | — |
| P-E2E-DATO-ALERTA | Integrales → Dato a alerta | `e2e/flujos` | 1 | Aprobado | 3,7 s | — |
| P-E2E-HISTORIAL | Integrales → Historial | `e2e/historial` | 1 (4 ejecuciones) | Aprobado | 14,0 s | CSV de un día completo (anteayer): 384 filas (96 por estación, 4 estaciones), calculadas según la duración del día en Chile |
| P-SEG-CONTRASENAS | Seguridad → Contraseñas | `integracion/contrasenas`, `e2e/sin-javascript` | 7 (16 ejecuciones) | Aprobado | 31,2 s | Sin JavaScript, 0 URL y 0 peticiones con la contraseña en las 3 pantallas, en los 4 proyectos |
| P-SEG-SESION | Seguridad → Validez de la sesión | `integracion/sesion` | 8 | Aprobado | 0,6 s | — |
| P-SEG-AISLAMIENTO | Complementaria (RNF02) | `integracion/admin`, `criterios`, `estado`, `historial`, `sesion`, `terrenos`; `e2e/admin` | 13 | Aprobado | 1,1 s | — |
| P-SEG-CIFRADO | Seguridad → Cifrado | `integracion/exposicion-cifrado` | 2 | Aprobado (no aplica en local; ver abajo) | < 0,1 s | — |
| P-SEG-EXPOSICION-BD | Seguridad → Exposición de la BD | `integracion/exposicion-cifrado` | 3 | Aprobado | 0,1 s | — |
| P-CAR-INGESTA | Carga → Ingesta | `carga/carga` | 768 tramas, de a 10 en paralelo | Aprobado | 1,6 s (2.814 lecturas/s) | p95 de 41 ms; 0 errores; 0 de 4.608 lecturas perdidas |
| P-CAR-HISTORICO | Carga → Histórico | `carga/carga` | 60 consultas (30 de panel y 30 de historial de 1 año) | Aprobado | — | p95: panel 9 ms, historial 141 ms (umbral: 3.000 ms). Base de 2.364 MB con 6.865.848 mediciones. Usa el índice `(sensor_id, fecha)`. |
| P-CAR-CONCURRENCIA | Carga → Concurrencia | `carga/carga` | 400 consultas de 20 sesiones simultáneas | Aprobado | — | p95 de 787 ms, máximo de 2.844 ms, 0 errores |
| P-INF-DESPLIEGUE | Infraestructura → Despliegue | `infra/despliegue` | 1 | Aprobado | 16,5 s | — |
| P-INF-RESPALDO | Infraestructura → Respaldo | `integracion/respaldo` | 4 | Aprobado | 0,9 s | — |
| P-INF-MONITOREO | Infraestructura → Monitoreo | `integracion/respaldo` | 2 | Aprobado | 0,2 s | — |

Rutas relativas a `tests/`, sin la extensión `.test.ts` o `.spec.ts`.

- **Carga:** los datos salen de [carga.md](carga.md) y `carga.json` (07-10-2026). El tiempo total de la suite
  de carga no quedó registrado.
- **Accesibilidad:** la prueba complementaria `[T6.5]` (RNF03 y RNF05) revisa 15 pantallas en Chromium y
  WebKit, en escritorio y celular: 60 ejecuciones, todas aprobadas en la ronda 3. Incluye el botón
  «Cargando…» de la incidencia 5 y las pestañas que pasan a una segunda línea a 390 px.
  - axe-core no detectó infracciones de WCAG 2.1 A y AA, y pasaron las comprobaciones propias.
  - Una herramienta automática no detecta todos los problemas: esto no equivale a certificar el cumplimiento
    de WCAG.

## Pruebas que no aplican en local

El prototipo se ejecuta en un solo equipo, por HTTP en `localhost` y con SQLite. El despliegue en la nube que
contempla el diseño queda fuera del alcance (`requisitos.md` §2). Por eso estas pruebas verifican el
equivalente local y no la infraestructura de producción:

| ID | Por qué no aplica tal cual | Qué se verifica en local |
|---|---|---|
| P-SEG-CIFRADO | No hay TLS: la aplicación responde por HTTP en `localhost`. | Sin https, la cookie va sin `Secure` y no hay HSTS. Con `APP_URL` en https, la cookie lleva `Secure` y la respuesta trae HSTS. |
| P-SEG-EXPOSICION-BD | El diseño objetivo es PostgreSQL, un servidor con puerto de red. SQLite es un archivo sin puerto. | La base se abre como un archivo local, sin host ni puerto; no hay clientes de bases de datos de red entre las dependencias; la base, los correos y los respaldos quedan fuera del repositorio. |
| P-INF-DESPLIEGUE | No hay despliegue en la nube. | Compilación (`build`) e inicio (`start`) de la versión de producción, con su consulta a `/api/salud` y su respaldo. |
| P-INF-RESPALDO | No hay servicio de respaldo de la nube. | Respaldo diario con `VACUUM INTO`, retención de 30 días y restauración con verificación de conteos. |
| P-INF-MONITOREO | No hay servicio de monitoreo de la nube. | `/api/salud` informa base, notificaciones y último respaldo, y responde 503 si la base falla. |
| P-CAR-* | Se miden en el equipo de desarrollo, con SQLite y un solo proceso. | Tiempos y pérdidas con 4 años de datos en ese equipo. No se extrapolan a la infraestructura de producción. |

## Incidencias

Las incidencias 1 y 2 se reconstruyeron con el diff de su commit y con las notas de `docs/spec/tareas.md`,
porque los mensajes de los commits no describen los cambios («v1», «v4», «sadf»). Las incidencias 3 a 6
ocurrieron el 13 y el 14-10-2026 y se registraron al momento. Solo se listan las que tienen respaldo en esas
fuentes; pudo haber otras durante el desarrollo que no quedaron registradas.

1. **Ajustes: el mensaje de confirmación del perfil desaparecía** (commit `009343d`, 07-10-2026).
   - **Cómo se detectó:** con las pruebas e2e de Ajustes. El mismo commit modifica
     `tests/e2e/ajustes.spec.ts`; el historial no registra más detalle.
   - **Causa:** al guardar el perfil se recargaba la sesión, la lista de pestañas se recreaba y la pestaña
     abierta se volvía a montar, perdiendo su mensaje.
   - **Corrección:** las pestañas se crean una sola vez (`src/routes/ajustes.tsx`).
   - **En el mismo commit, para estabilizar la suite e2e:**
     - las pruebas hacían clic antes de que SolidStart hidratara la página; ahora `page.goto` espera a que la
       red quede inactiva (`tests/e2e/base.ts`);
     - las pruebas compartían la base de desarrollo; ahora usan su propia base y su propio servidor
       (`data/e2e/`, puerto 3100).
2. **Accesibilidad** (commit `7ccd289`, T6.5).
   - **Cómo se detectó:** las comprobaciones propias de `tests/e2e/accesibilidad.spec.ts`.
   - **Hallazgos y correcciones:**
     - había transiciones sin respetar `prefers-reduced-motion`: ahora hay una regla global;
     - `text-sm` medía 15,75 px: ahora mide 16 px;
     - el logo tenía un área táctil de 32 px de alto: ahora tiene 44 px;
     - el campo de fecha no mostraba el foco: ahora lo muestra (`src/styles/`).
3. **Pruebas de integración intermitentes por la carpeta de correos** (sin commit todavía, 13-10-2026).
   - **Cómo se detectó:** una ejecución de `npm run evidencia` en la que falló una prueba de
     `admin.test.ts`.
   - **Causa:** `admin.test.ts` y `recuperacion.test.ts` corren en paralelo y vaciaban la misma carpeta de
     correos.
   - **Corrección:** cada archivo usa su propia carpeta. Solo cambiaron las pruebas, no la aplicación.
4. **Fallas por tiempo de espera en WebKit celular y con el servidor recién iniciado** (rondas 1 y 3, sin
   corregir).
   - **Qué pasó:**
     - En la primera ejecución de `npm run test:e2e` de la ronda 1, 5 pruebas de WebKit celular fallaron por
       tiempo de espera: el inicio de sesión no redirigió dentro de 10 s, o la página no cargó dentro de
       30 s. Por depender de esos proyectos, 9 pruebas que modifican datos no corrieron.
     - En la ronda 3, una ejecución aislada de `historial.spec.ts` en los 4 proyectos, con el servidor
       recién iniciado, falló por tiempo de espera: cada prueba tardó de 26 a 33 s.
   - **Resultado al repetir:** todas las repeticiones pasaron. Las ejecuciones completas de la suite pasaron
     cuatro veces (dos en la ronda 1 y dos en la ronda 2) y una vez en la ronda 3; la prueba aislada pasó en
     3 a 5 s.
   - **Causa probable:** `playwright.config.ts` ya advierte que el modo desarrollo es lento en la primera
     carga, sobre todo en WebKit. No es una falla de la aplicación.
   - **Pendiente:** si se quiere eliminar, hay que ajustar los tiempos de espera o el paralelismo, o calentar
     el servidor antes de las pruebas.
5. **La contraseña quedaba en la URL si el formulario se enviaba antes de hidratar** (sin commit todavía,
   13-10-2026; T6.8).
   - **Cómo se detectó:** en una re-ejecución independiente de las pruebas en otro equipo. Se reprodujo con
     JavaScript desactivado en Playwright: al enviar el inicio de sesión, la página quedaba en
     `/login?correo=…&contrasena=…`. Lo mismo ocurría en el restablecimiento y en el cambio de contraseña
     de Ajustes.
   - **Causa:** el componente `Form` (`src/components/Forms.tsx`) no definía `method`, así que un envío
     nativo del navegador usaba GET y ponía los campos en la URL. Además, el botón de envío quedaba
     habilitado antes de que la página hidratara, cuando el formulario todavía no tiene su manejador. Afectaba
     a todos los formularios, porque todos usan ese componente.
   - **Corrección:**
     - `Form` usa siempre `method="post"`.
     - El botón de envío queda deshabilitado hasta hidratar, con el texto «Cargando…» y `aria-busy="true"`, y
       vuelve a su texto al hidratar.
     - Sin JavaScript no se envía nada, ni con el botón ni con Enter.
     - Sin cambios en la API. Registrado en `diseno.md` §8.4 y §9.
   - **Prueba nueva:** `tests/e2e/sin-javascript.spec.ts` `[P-SEG-CONTRASENAS]`.
     - Con JavaScript desactivado, intenta enviar con Enter y con clic en las tres pantallas, y verifica que
       ni la URL ni ninguna petición contienen la contraseña, tampoco codificada.
     - Antes de la corrección fallaba en las tres pantallas (ejecutada en Chromium); después pasa en los
       cuatro proyectos de lectura de Playwright.
6. **La prueba del historial dependía de la hora en que se ejecutaba** (sin commit todavía, 14-10-2026).
   - **Cómo se detectó:** la ejecución de `npm run test:e2e` de las 00:20 del 14-10-2026 falló en
     `[P-E2E-HISTORIAL]` en los 4 proyectos. El CSV de «ayer» tuvo 374 filas en vez de 384. No es un defecto
     de la aplicación.
   - **Causa:**
     - La prueba descargaba el CSV de «ayer» y esperaba 96 lecturas por estación.
     - EST-0003 deja de reportar 3 horas antes del fin de la semilla, una situación preparada para mostrar
       «sin datos recientes».
     - Entre las 00:00 y las 03:00, ese silencio cae en el día de ayer y faltan sus lecturas (10 a esa hora).
     - Además, la prueba suponía días de 24 horas: el día en que empieza o termina el horario de verano dura
       23 o 25 horas, y en el primero el día empieza a la 01:00.
   - **Corrección** (`tests/e2e/historial.spec.ts`):
     - La prueba usa **anteayer**, que siempre es un día completo, lejos del silencio de EST-0003.
     - Las filas esperadas se calculan con la duración real de ese día en Chile, y la primera fila con su
       primer instante. Para eso usa las mismas funciones de fechas de la aplicación (`src/lib/fechas.ts`),
       que tienen sus propias pruebas de horario de verano.
     - La corrección se comprobó a la 01:00, dentro de la franja en que antes fallaba.
   - **Revisión de las demás pruebas:** se buscaron las que dependen del silencio de EST-0003, del cambio de
     día o del horario de verano. No se encontró otra.
     - Las de integración del historial, de la semilla y de `db:al-dia` usan fechas fijas.
     - La del emulador recorre un día completo desde la hora actual, y el escenario `normal` acota sus
       valores lejos de los umbrales, así que no depende de la hora ni de la estación del año.
     - Las e2e del panel miden el silencio de EST-0003 justo después de sembrar la base, así que siempre lo
       encuentran.
     - Los atajos del historial usan instantes exactos.

## Totales

Resultados de la ronda 3 (`npm run evidencia`):

| Herramienta | Archivos | Pruebas | Resultado |
|---|---|---|---|
| Vitest (`npm test`) | 28 | 291 | 291 pasan |
| Vitest (`npm run test:infra`) | 1 | 1 | 1 pasa |
| Playwright (`npm run test:e2e`) | 12 | 169 ejecuciones en 6 proyectos | 165 pasan y 4 se omiten |

- **Omitidas:** las 4 son a propósito y dependen del tamaño de pantalla. La prueba de celular de
  `distribucion.spec.ts` no corre en los proyectos de escritorio, y la de escritorio no corre en los de
  celular.
- **Ejecuciones completas de Playwright:**
  - 13-10-2026: 5. Una falló por tiempos de espera (incidencia 4) y 4 pasaron.
  - 14-10-2026: 2. Una falló por la dependencia de la hora (incidencia 6) y una pasó, la de la ronda 3.
  - Hubo además ejecuciones parciales para verificar las correcciones de las incidencias 5 y 6.

**GitHub Actions:** no hay enlace a la última ejecución. El repositorio local no tiene un remoto configurado
(`git remote -v` está vacío), así que no se puede consultar el CI. El flujo está definido en
`.github/workflows/ci.yml`: install, typecheck, `npm test`, `npm run test:infra` y la suite e2e en Chromium y
WebKit.
