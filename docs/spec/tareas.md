# Plan de tareas

## Cómo trabajar (para Claude Code)

1. Toma la primera tarea sin marcar, en orden. No adelantes trabajo de tareas posteriores; en especial, nada de la Fase 6 antes de tiempo.
2. Lee sus referencias, propone un plan breve (archivos y pruebas) y espera aprobación.
3. Implementa, con las pruebas indicadas y su ID en el nombre.
4. Verifica: `npm run typecheck` y `npm test` (y `npm run test:e2e` cuando la tarea lo pida). Revisa cada criterio de aceptación.
5. Marca la casilla, resume en 3 a 5 líneas qué cambió y detente.

**Prioridad:** pantallas funcionales sobre la API y los datos reales. La etiqueta de cada fase indica a qué historia de usuario e iteración de la tesis corresponde.

---

## Fase 0 — Base

- [x] **T0.1 Limpieza del prototipo**
  - Solo npm (eliminar `pnpm-lock.yaml`); paquete `lorax`; README propio; `<html lang="es">`.
  - Barra lateral oculta en `/login` y en la 404; en menos de 768 px, barra superior con menú.
  - Registrar la 404 en `routes.ts`.
  - Rutas `/historial`, `/alertas`, `/ajustes` y `/admin`; quitar «Observaciones».
  - `src/styles/tokens.css` con el verde de los mockups como acento.
  - **Aceptación:** a 390×844 no hay scroll horizontal y el menú funciona; `/login` no muestra barra lateral; una URL inexistente muestra la 404.

- [x] **T0.2 Herramientas**
  - Vitest y Playwright (Chromium + celular 390×844).
  - Scripts `typecheck`, `test` y `test:e2e`.
  - GitHub Actions con install, typecheck y test.
  - `.env.example`.
  - **Aceptación:** una prueba trivial pasa en local y en CI.

- [x] **T0.3 Esquema SQLite con Drizzle** — `diseno.md` §4
  - Todas las tablas, restricciones, índices, trigger de inmutabilidad y claves foráneas activas.
  - Conexión única en `globalThis`, en modo WAL.
  - Scripts `db:migrar` y `db:reiniciar`.
  - **Pruebas:** el trigger rechaza UPDATE y DELETE; restricciones únicas (correo, número de serie, sensor+fecha, una alerta vigente por criterio); CHECK de valores.

- [x] **T0.4 Datos piloto y semilla** — `diseno.md` §5 y §10
  - `src/lib/variables.ts`, `scripts/datos-piloto.ts`, `db:semilla`.
  - **Aceptación:**
    - 1 administrador, 4 productores, 3 terrenos, 8 estaciones y 48 sensores;
    - unas 138 mil mediciones;
    - todas las situaciones preparadas de §10 presentes;
    - la semilla tarda menos de 1 minuto.

- [x] **T0.5 Base de la API**
  - Utilidades de respuesta y error, validación con Zod.
  - Cliente `src/core/api.ts`: un 401 redirige a `/login`.
  - `GET /api/salud` básico.
  - **Pruebas:** formato de error.

## Fase 1 — Acceso · HU01 (Iteración 3 de la tesis)

- [x] **T1.1 Autenticación en el servidor** — §8.4
  - Endpoints `login`, `logout` y `sesion`, con cookie y opción «recordar».
  - Rechazo de cuentas deshabilitadas.
  - Una cuenta pendiente de activación responde el mismo error genérico que unas credenciales inválidas (§8.4).
  - Guardas `requireSesion` y `requireRol`.
  - **Pruebas:** `[P-FUN-CU01]` (API), `[P-SEG-CONTRASENAS]`, `[P-SEG-SESION]`.

- [x] **T1.2 Middleware, contexto y menú**
  - El middleware valida la sesión de verdad y redirige según el rol.
  - `contexts/session.tsx` consulta `/auth/sesion`; ya no usa cookies legibles por JavaScript.
  - Menú por rol.
  - **Pruebas:** `[P-INT-API]`.

- [x] **T1.3 Pantalla de inicio de sesión**
  - Campo Email y casilla «Mantener sesión iniciada».
  - Errores en el mismo formulario, conservando el correo.
  - Mensaje de cuenta deshabilitada.
  - **Pruebas:** e2e `[P-FUN-CU01]`.

- [x] **T1.4 Recuperación de contraseña**
  - Envío del enlace, página `/restablecer`, correo en `data/correos/` y bandeja `/dev/correos` (solo en desarrollo).
  - **Aceptación:** flujo e2e completo, desde pedir el enlace hasta entrar con la contraseña nueva.

- [x] **T1.5 Ajustes: Perfil y Seguridad**
  - Editar nombre, apellido y teléfono; el resto, solo lectura.
  - Cambio de contraseña.

## Fase 2 — Pantallas del productor · HU02, HU04, HU05, HU06 (Iteraciones 1, 2 y 4)

Todas trabajan con los datos de la semilla.

- [x] **T2.1 Terrenos y estaciones**
  - API de terrenos (§7).
  - Pestaña «Terrenos y estaciones» en Ajustes:
    - listado;
    - formulario de terreno + estación con los 6 sensores marcados por defecto; la ubicación de la estación es opcional y, si falta, el servidor usa la del terreno;
    - agregar estación;
    - error de número de serie repetido junto al campo;
    - estado vacío.
  - **Pruebas:** `[P-FUN-CU02]`, `[P-SEG-AISLAMIENTO]`.

- [x] **T2.2 Panel de estado** — §8.1
  - API `/terrenos/:id/estado`.
  - API `PATCH /alertas/:id` (`{leida: true}`), movida desde T2.4 porque el panel la necesita para marcar alertas como leídas.
  - Script `npm run db:al-dia` (§10), para que el panel muestre datos recientes sin reiniciar la base.
  - Pantalla con:
    - selector de terreno;
    - tarjetas de variable por estación, con estado y curva de 24 h;
    - estado de cada estación;
    - alertas recientes, con la opción de marcarlas como leídas;
    - actualización cada 60 s;
    - estado vacío para la productora sin terrenos.
  - **Pruebas:** `[P-FUN-CU04]`.

- [x] **T2.3 Historial** — §8.3
  - API de serie y exportación.
  - Pantalla con:
    - filtros y atajos (24 h, 7 días, 30 días, 1 año);
    - `GraficoSerie`;
    - comparación superpuesta;
    - indicador del intervalo de agregación;
    - «Descargar CSV».
  - **Pruebas:** `[P-FUN-CU05]`, e2e `[P-E2E-HISTORIAL]`.

- [x] **T2.4 Alertas**
  - API de criterios, alertas y lecturas recientes. (`PATCH /alertas/:id` ya se hizo en T2.2.)
  - **Configuración de criterios:**
    - terreno → sensor;
    - unidad y últimas 5 lecturas;
    - umbral y opción «Supera / Desciende bajo»;
    - canales, con aviso si no se marca ninguno.
  - Lista de criterios, con habilitar o deshabilitar y eliminar.
  - Lista de alertas con filtros.
  - Indicador de no leídas en el menú.
  - **Pruebas:** `[P-FUN-CU06]` (configuración).

## Fase 3 — Administración · HU07 (Iteración 3 de la tesis)

- [x] **T3.1 API de administración**
  - Crear productor (con empresa y validación de RUT) y enviar enlace de activación.
  - Listar, ver detalle y actualizar cuentas, con el indicador `pendienteActivacion`.
  - Reenviar el enlace de activación (`/admin/cuentas/:id/reenviar-activacion`), invalidando los anteriores.
  - Habilitar o deshabilitar cuentas, con revocación de sesiones.
  - Deshabilitar estaciones y eliminar criterios (al eliminar un criterio, su alerta vigente se resuelve; regla de §8.2, ya implementada en T2.4).
  - Eventos.
  - Motivo obligatorio y evento en la misma transacción.
  - **Pruebas:** `[P-FUN-CU07]` (API).

- [x] **T3.2 Pantalla de administración**
  - Listado con búsqueda y filtro por estado.
  - Estado «Pendiente de activación» en el listado y en el detalle, con la acción «Reenviar enlace de activación».
  - Creación de cuentas.
  - Detalle con pestañas: Datos, Terrenos y estaciones, Umbrales.
  - `DialogoConfirmacion` con motivo.
  - Vista de eventos.
  - Ninguna opción sobre mediciones.
  - **Pruebas:** e2e `[P-FUN-CU07]`.

## Fase 4 — Capturas para la tesis (punto de control)

- [x] **T4.1 Script de capturas** *(pospuesta el 2026-09-26; retomada y hecha el 2026-10-13)*
  - `npm run capturas` (§10) sobre una base recién sembrada.
  - **Aceptación:** 12 imágenes, 6 pantallas en escritorio y celular, sin datos vacíos salvo donde se muestra a propósito el estado vacío.
  - `scripts/capturas.ts`: base propia en `data/capturas/` (sembrada y puesta al día justo antes de capturar), servidor en el puerto 3200, Chromium en es-CL, America/Santiago y escala 2. Las reglas de cada pantalla están en §10.
  - Las capturas se versionan en `evidencia/capturas/` (decisión del usuario del 2026-10-13).
  - Revisión del 2026-10-14: alertas en la pestaña «Umbrales» (figura del CU06); el panel se recorta para mostrar EST-0001 completa, con la tarjeta fuera de rango; las pestañas que no caben a 390 px pasan a una segunda línea (§9).

- [ ] **T4.2 Revisión con el equipo:** detenerse y esperar comentarios antes de la Fase 5. *(pospuesta el 2026-09-26: el usuario indicó continuar con la Fase 5)*

## Fase 5 — Ingesta y alertas en vivo · HU03, HU06 (Iteraciones 1 y 4)

- [x] **T5.1 Endpoint de ingesta** — §6
  - Deja el punto de enganche de la evaluación (`EvaluadorLecturas` en `src/server/ingesta/ingesta.ts`). El criterio de RF03.4 «se evalúan los criterios» se cierra en T5.2.
  - **Pruebas:** `[P-FUN-CU03]`, `[P-INT-INGESTA]`.

- [x] **T5.2 Evaluación de criterios y notificaciones** — §8.2 y §8.5
  - Conectar la evaluación en el punto de enganche de la ingesta (cierra RF03.4).
  - Mover el evaluador de `scripts/generacion.ts` (`crearEvaluador`) a `src/server/`; la semilla y `db:al-dia` lo importan desde ahí, sin duplicar la lógica.
  - Canales plataforma, correo (archivo), SMS y WhatsApp simulados.
  - Un reintento simple: el siguiente despacho reintenta las fallas pasajeras, hasta 5 intentos; las permanentes (sin teléfono) no se reintentan (§8.5).
  - Aviso en Alertas al marcar SMS o WhatsApp sin teléfono en la cuenta.
  - **Pruebas:** `[P-FUN-CU06]` (evaluación, incluida una trama atrasada que no crea ni resuelve alertas), `[P-INT-NOTIFICACION]`.

- [x] **T5.3 Emulador** — §10
  - **Aceptación:** cada escenario produce la respuesta y el efecto esperados en la interfaz.
  - **Pruebas:** `[T5.3]` en `tests/integracion/emulador.test.ts`.

- [x] **T5.4 Flujos de extremo a extremo**
  - **Pruebas:** e2e `[P-E2E-INGESTA-PANEL]`, `[P-E2E-DATO-ALERTA]` en `tests/e2e/flujos.spec.ts`, con el emulador real contra el servidor de las pruebas.
  - `[P-E2E-DATO-ALERTA]` verifica el correo enviado por el despachador real en `/dev/correos`, nunca notificaciones sembradas (§10).
  - Con la semilla recién cargada, EST-0001 ya tiene una alerta vigente: el flujo corre `normal` y después `sequia` para crear una alerta nueva.

## Fase 6 — Endurecimiento y evidencia — §11

- [x] **T6.1 Seguridad adicional:** límite de intentos, verificación de `Origin` y encabezados (§8.4 y §11).
  - Código de error nuevo `DEMASIADOS_INTENTOS` (429) y tipo de evento `ORIGEN_RECHAZADO` (§4 y §7).
  - Limitaciones documentadas en §11 y en el README: `'unsafe-inline'` en la CSP y el bloqueo por correo.
  - **Pruebas:** `[P-FUN-CU01]` (límite de intentos, integración y e2e) y `[T6.1]` (origen y encabezados).
- [x] **T6.2 Notificaciones:** reintentos con espera creciente y `NOTIF_SIMULAR_FALLO` (§8.5).
  - 5 intentos en total, con esperas de 1, 2, 4 y 8 min (decisión del usuario del 2026-10-07; §11 decía también 16 min).
  - La tarea de 60 s se inicia con la primera petición, desde el middleware: un plugin de Nitro no resuelve el alias `~/`.
  - **Pruebas:** `[P-INT-NOTIFICACION]` (espera creciente, tope, recuperación y tarea periódica).
- [x] **T6.3 Respaldo, restauración y salud completa.** (§7, §10 y §11)
  - Respaldo diario `lorax-<día de Chile>.db` con retención de 30 días; `npm run restaurar <archivo>` con verificación de conteos; `/api/salud` con notificaciones y último respaldo.
  - Script nuevo `npm run test:infra` para `[P-INF-DESPLIEGUE]` (compila e inicia producción), también en el CI.
  - **Pruebas:** `[P-INF-RESPALDO]`, `[P-INF-MONITOREO]`, `[P-INF-DESPLIEGUE]`, `[P-SEG-EXPOSICION-BD]`, `[P-SEG-CIFRADO]`.
- [x] **T6.4 Carga:** script `historico` y pruebas `[P-CAR-*]` (§11).
  - **Aceptación:** reportar tiempos p95 y tamaño de la base.
  - `npm run historico -- --anios 4` (base aparte, `data/carga/lorax.db`) y `npm run test:carga` (fuera del CI). Resultados en `evidencia/carga.md`.
- [x] **T6.5 Revisión de accesibilidad y responsive** en todas las pantallas.
  - `tests/e2e/accesibilidad.spec.ts` (`[T6.5]`): 15 pantallas en Chromium y WebKit, escritorio y celular. axe-core (WCAG 2.1 A y AA) sin infracciones detectadas; las comprobaciones propias encontraron y se corrigieron: transiciones con movimiento reducido (regla global), `text-sm` en 15,75 px (ahora 16 px), el logo con 32 px de alto (ahora 44 px) y el campo de fecha sin foco visible.
  - Proyectos WebKit en la suite e2e (evidencia de RNF05) y en el CI; 6 procesos en paralelo como máximo.
  - Observación no cubierta por las herramientas: el texto de los ejes y la leyenda de los gráficos (canvas) es de unos 12 px.
- [x] **T6.6 Informe de evidencia:** `npm run evidencia` genera `evidencia/informe.md`.
  - La accesibilidad se redacta como «sin infracciones detectadas por axe-core», no como cumplimiento de WCAG.
  - Ejecuta `test`, `test:infra` y `test:e2e`; la carga se toma de `evidencia/carga.json` sin volver a ejecutarla. P-FUN-CU06 se separa por archivo: `criterios.test.ts` (configuración) y `evaluacion.test.ts` (evaluación).
  - Se versionan `informe.md` y `carga.*`; los JSON crudos (`evidencia/resultados/`) quedan fuera del repositorio (decisión del usuario del 2026-10-13).
  - **Pruebas:** `[T6.6]` en `tests/unit/informe-evidencia.test.ts`.
- [x] **T6.7 README final:** instalación, credenciales de demostración y cómo demostrar cada caso de uso.
  - Instalación con `.env` (qué pasa si falta `JWT_SECRET` o `INGESTA_API_KEY`), los pasos del CU01 al CU07 y las tres formas de mantener los datos al día (`db:al-dia`, el emulador continuo y `db:reiniciar`).
  - Los pasos se verificaron contra la aplicación en marcha, con una base aparte: escenarios del emulador, correos, SMS simulado, eventos y límite de intentos.
- [x] **T6.8 Corrección: formularios antes de hidratar** (§8.4 y §9; incidencia 5 de `evidencia/resumen-tesis.md`)
  - Defecto reportado el 2026-10-13 en una re-ejecución independiente: sin JavaScript (o antes de hidratar), el navegador enviaba los formularios por GET y la contraseña quedaba en la URL.
  - `Form` usa `method="post"` por defecto y `Submit` queda deshabilitado, con «Cargando…» y `aria-busy`, hasta que la página hidrata. Sin cambios en la API.
  - **Pruebas:** e2e `[P-SEG-CONTRASENAS]` con JavaScript desactivado (inicio de sesión, restablecimiento y cambio de contraseña); las de accesibilidad `[T6.5]` siguen pasando.

---

## Pendientes de la tesis (para el equipo; Claude Code NO los ejecuta)

- [ ] **Interfaz del CU07 (7.5):** reemplazar `La /*@fig-ui-cu07*/ presenta` por la captura de administración (T4.1).
- [ ] **Figuras de 7.5:** reemplazar los mockups por las capturas reales (T4.1).
- [ ] **Capítulo 9:** reemplazar los «Aprobado» por los resultados de `evidencia/informe.md` (T6.6). Agregar la fila de prueba del CU07.
- [ ] **Arquitectura:** cambiar Next.js por SolidStart (una sola aplicación) en los capítulos 4, 5, 7 y 8.
- [ ] **Base de datos, en 12.4 Limitaciones:** el prototipo implementa el modelo de datos sobre SQLite. PostgreSQL con PostGIS y JSONB queda como diseño objetivo para producción.
- [ ] **RF01:** mencionar «Mantener sesión iniciada».
- [ ] **Observaciones:** definirla o quitarla de los mockups.
