# Informe de evidencia

Generado por `npm run evidencia` el 14-10-2026, 01:06 a. m. (hora de Chile), sobre el commit `7ccd289`, con cambios sin commit.
Equipo: Intel(R) Core(TM) Ultra 7 155H, 22 núcleos, 15 GB de memoria; linux 7.1.4; Node.js v24.18.0.

Cada fila corresponde a una prueba del capítulo 9 de la tesis (`docs/spec/diseno.md` §12). Una fila está
«Aprobado» si tiene al menos una prueba y ninguna falla; «No aprobado» si alguna falla; «Sin ejecutar» si no
hay resultados. Las pruebas de extremo a extremo se cuentan una vez por proyecto de Playwright (Chromium y
WebKit, en escritorio y celular). Las filas de carga salen de `evidencia/carga.json` (`npm run test:carga`),
que este comando no vuelve a ejecutar.

## Resumen

- **26 de 26 filas aprobadas**; 0 no aprobadas; 0 sin ejecutar.
- 461 ejecuciones de prueba: 457 pasan, 0 fallan y 4 se omitieron.
- Carga medida el 07-10-2026, 11:07 p. m., con 6.865.848 mediciones (2.364 MB).

## Resultados por fila de la tesis

| ID | Fila de la tesis | Qué verifica | Pruebas | Resultado |
|---|---|---|---|---|
| [P-FUN-CU01](#p-fun-cu01-funcionales-cu01) | Funcionales → CU01 | Login válido e inválido, cuenta deshabilitada, recuperación. | 63 (63 pasan) | **Aprobado** |
| [P-FUN-CU02](#p-fun-cu02-funcionales-cu02) | Funcionales → CU02 | Número de serie disponible y repetido, sin escrituras parciales. | 9 (9 pasan) | **Aprobado** |
| [P-FUN-CU04](#p-fun-cu04-funcionales-cu04) | Funcionales → CU04 | Los cinco estados de variable y los tres de estación. | 11 (11 pasan) | **Aprobado** |
| [P-FUN-CU05](#p-fun-cu05-funcionales-cu05) | Funcionales → CU05 | Rango válido, invertido y vacío; agregación; CSV. | 16 (16 pasan) | **Aprobado** |
| [P-FUN-CU06](#p-fun-cu06-funcionales-cu06-configuracion) | Funcionales → CU06 (configuración) | Validación del umbral contra el rango; eliminación lógica. | 9 (9 pasan) | **Aprobado** |
| [P-FUN-CU07](#p-fun-cu07-funcionales-cu07-fila-por-agregar-a-la-tesis) | Funcionales → CU07 (fila por agregar a la tesis) | Operaciones con motivo y evento; productor sin acceso a admin. | 17 (17 pasan) | **Aprobado** |
| [P-FUN-CU03](#p-fun-cu03-funcionales-cu03) | Funcionales → CU03 | Sensor registrado y no registrado. | 2 (2 pasan) | **Aprobado** |
| [P-FUN-CU06](#p-fun-cu06-funcionales-cu06-evaluacion) | Funcionales → CU06 (evaluación) | Fuera y dentro de rango, sin duplicados, resolución. | 6 (6 pasan) | **Aprobado** |
| [P-INT-INGESTA](#p-int-ingesta-integraciones-ingesta-de-tramas) | Integraciones → Ingesta de tramas | Trama válida se persiste; credencial o estructura inválida no. | 20 (20 pasan) | **Aprobado** |
| [P-INT-NOTIFICACION](#p-int-notificacion-integraciones-notificacion-de-alertas) | Integraciones → Notificación de alertas | Fuera de rango notifica; dentro no. | 7 (7 pasan) | **Aprobado** |
| [P-INT-API](#p-int-api-integraciones-consumo-de-la-api-rest) | Integraciones → Consumo de la API REST | Sin token o con token vencido: 401 y la interfaz pide iniciar sesión. | 34 (34 pasan) | **Aprobado** |
| [P-E2E-INGESTA-PANEL](#p-e2e-ingesta-panel-integrales-ingesta-a-visualizacion) | Integrales → Ingesta a visualización | El emulador envía una trama y el panel la muestra con su estado. | 1 (1 pasa) | **Aprobado** |
| [P-E2E-DATO-ALERTA](#p-e2e-dato-alerta-integrales-dato-a-alerta) | Integrales → Dato a alerta | Escenario `sequia`: alerta, correo en `/dev/correos` y panel. | 1 (1 pasa) | **Aprobado** |
| [P-E2E-HISTORIAL](#p-e2e-historial-integrales-historial) | Integrales → Historial | Serie, comparación y descarga del CSV. | 4 (4 pasan) | **Aprobado** |
| [P-SEG-CONTRASENAS](#p-seg-contrasenas-seguridad-contrasenas) | Seguridad → Contraseñas | Formato scrypt; no contiene la contraseña. | 16 (16 pasan) | **Aprobado** |
| [P-SEG-SESION](#p-seg-sesion-seguridad-validez-de-la-sesion) | Seguridad → Validez de la sesión | Token válido, vencido, ausente, alterado y revocado. | 8 (8 pasan) | **Aprobado** |
| [P-SEG-AISLAMIENTO](#p-seg-aislamiento-complementaria-rnf02) | (complementaria, RNF02) | Recurso ajeno responde 404; admin responde 403 a un productor. | 13 (13 pasan) | **Aprobado** |
| [T6.5](#t6-5-accesibilidad-complementaria-rnf03-y-rnf05) | Accesibilidad (complementaria, RNF03 y RNF05) | Todas las pantallas, en Chromium y WebKit, escritorio y celular: sin infracciones detectadas por axe-core (WCAG 2.1 A y AA) y comprobaciones propias. | 60 (60 pasan) | **Aprobado** |
| [P-SEG-CIFRADO](#p-seg-cifrado-seguridad-cifrado) | Seguridad → Cifrado | Documental: no aplica en local (HTTP en localhost). | 2 (2 pasan) | **Aprobado** |
| [P-SEG-EXPOSICION-BD](#p-seg-exposicion-bd-seguridad-exposicion-de-la-bd) | Seguridad → Exposición de la BD | SQLite es un archivo local sin puerto de red. | 3 (3 pasan) | **Aprobado** |
| [P-CAR-INGESTA](#p-car-ingesta-carga-ingesta) | Carga → Ingesta | 768 tramas (un día de las 8 estaciones), de a 10 en paralelo: cero errores y cero lecturas perdidas. | carga.json (07-10-2026, 11:07 p. m.) | **Aprobado** |
| [P-CAR-HISTORICO](#p-car-historico-carga-historico) | Carga → Histórico | Panel e historial de 1 año con 4 años de datos: p95 < 3 s; las consultas usan el índice (sensor_id, fecha). | carga.json (07-10-2026, 11:07 p. m.) | **Aprobado** |
| [P-CAR-CONCURRENCIA](#p-car-concurrencia-carga-concurrencia) | Carga → Concurrencia | 20 sesiones simultáneas: cero errores y p95 < 3 s. | carga.json (07-10-2026, 11:07 p. m.) | **Aprobado** |
| [P-INF-DESPLIEGUE](#p-inf-despliegue-infraestructura-despliegue) | Infraestructura → Despliegue | `build` + `start` y consulta a `/api/salud`. | 1 (1 pasa) | **Aprobado** |
| [P-INF-RESPALDO](#p-inf-respaldo-infraestructura-respaldo) | Infraestructura → Respaldo | Respaldo diario y restauración con verificación de conteos. | 4 (4 pasan) | **Aprobado** |
| [P-INF-MONITOREO](#p-inf-monitoreo-infraestructura-monitoreo) | Infraestructura → Monitoreo | `/api/salud` ante una falla. | 2 (2 pasan) | **Aprobado** |

## Suites ejecutadas

| Suite | Comando | Pruebas | Duración | Resultado |
|---|---|---|---|---|
| Unitarias e integración (Vitest) | `npm run test` | 291 (291 pasan) | 30 s | Termina sin errores |
| Infraestructura (Vitest) | `npm run test:infra` | 1 (1 pasa) | 17 s | Termina sin errores |
| Extremo a extremo (Playwright) | `npm run test:e2e` | 169 (165 pasan, 4 omitidas) | 124 s | Termina sin errores |
| Carga | `npm run test:carga` | — | — | No se ejecuta aquí; resultados del 07-10-2026, 11:07 p. m. |

## Detalle por fila

### <a id="p-fun-cu01-funcionales-cu01"></a>P-FUN-CU01 · Funcionales → CU01

**Aprobado.** Login válido e inválido, cuenta deshabilitada, recuperación.

- Pasa · `tests/integracion/auth-api.test.ts` · inicio de sesión (CU01) › [P-FUN-CU01] con credenciales válidas crea una sesión con cookie HttpOnly y devuelve la cuenta y su rol
- Pasa · `tests/integracion/auth-api.test.ts` · inicio de sesión (CU01) › [P-FUN-CU01] el administrador recibe su rol para ir a /admin
- Pasa · `tests/integracion/auth-api.test.ts` · inicio de sesión (CU01) › [P-FUN-CU01] el correo no distingue mayúsculas ni espacios
- Pasa · `tests/integracion/auth-api.test.ts` · inicio de sesión (CU01) › [P-FUN-CU01] credenciales inválidas: mismo mensaje genérico exista o no el correo
- Pasa · `tests/integracion/auth-api.test.ts` · inicio de sesión (CU01) › [P-FUN-CU01] una cuenta deshabilitada no puede iniciar sesión y el mensaje lo indica
- Pasa · `tests/integracion/auth-api.test.ts` · inicio de sesión (CU01) › [P-FUN-CU01] campos vacíos o correo inválido responden con el error de cada campo
- Pasa · `tests/integracion/auth-api.test.ts` · inicio de sesión (CU01) › [P-FUN-CU01] «mantener sesión iniciada» dura 30 días; si no, 8 horas
- Pasa · `tests/integracion/auth-api.test.ts` · sesión y cierre de sesión (CU01) › [P-FUN-CU01] /auth/sesion devuelve la cuenta de la sesión y sin cookie responde 401
- Pasa · `tests/integracion/auth-api.test.ts` · sesión y cierre de sesión (CU01) › [P-FUN-CU01] cerrar sesión la invalida en el servidor, no solo en el navegador
- Pasa · `tests/integracion/intentos.test.ts` · [P-FUN-CU01] Límite de intentos de inicio de sesión (RF01.9) › [P-FUN-CU01] el quinto fallo todavía responde 401; después, 429 aunque la contraseña sea correcta
- Pasa · `tests/integracion/intentos.test.ts` · [P-FUN-CU01] Límite de intentos de inicio de sesión (RF01.9) › [P-FUN-CU01] el bloqueo dura 15 minutos desde el quinto fallo, y los intentos bloqueados no lo alargan
- Pasa · `tests/integracion/intentos.test.ts` · [P-FUN-CU01] Límite de intentos de inicio de sesión (RF01.9) › [P-FUN-CU01] 5 fallos repartidos en más de 15 minutos no bloquean
- Pasa · `tests/integracion/intentos.test.ts` · [P-FUN-CU01] Límite de intentos de inicio de sesión (RF01.9) › [P-FUN-CU01] un acceso exitoso no reinicia la ventana: 4 fallos, un acierto y otro fallo bloquean
- Pasa · `tests/integracion/intentos.test.ts` · [P-FUN-CU01] Límite de intentos de inicio de sesión (RF01.9) › [P-FUN-CU01] un correo inexistente se bloquea igual, sin distinguir mayúsculas: el 429 no revela qué correos existen
- Pasa · `tests/integracion/intentos.test.ts` · [P-FUN-CU01] Límite de intentos de inicio de sesión (RF01.9) › [P-FUN-CU01] los intentos con una cuenta deshabilitada cuentan como fallos
- Pasa · `tests/integracion/intentos.test.ts` · [P-FUN-CU01] Límite de intentos de inicio de sesión (RF01.9) › [P-FUN-CU01] cada intento fallido queda como evento sin responsable y sin la contraseña
- Pasa · `tests/integracion/intentos.test.ts` · [P-FUN-CU01] Límite de intentos de inicio de sesión (RF01.9) › [P-FUN-CU01] la API responde 429 DEMASIADOS_INTENTOS con Retry-After
- Pasa · `tests/integracion/intentos.test.ts` · [P-FUN-CU01] Límite de intentos de inicio de sesión (RF01.9) › [P-FUN-CU01] reglas del cálculo del bloqueo
- Pasa · `tests/integracion/recuperacion.test.ts` · solicitud del enlace (RF01.5) › [P-FUN-CU01] responde siempre 202 con el mismo mensaje, exista o no la cuenta
- Pasa · `tests/integracion/recuperacion.test.ts` · solicitud del enlace (RF01.5) › [P-FUN-CU01] solo se envía el correo si la cuenta existe y está habilitada
- Pasa · `tests/integracion/recuperacion.test.ts` · solicitud del enlace (RF01.5) › [P-FUN-CU01] se guarda el SHA-256 del enlace, que vence en 1 hora
- Pasa · `tests/integracion/recuperacion.test.ts` · solicitud del enlace (RF01.5) › [P-FUN-CU01] un correo inválido responde con el error del campo
- Pasa · `tests/integracion/recuperacion.test.ts` · restablecimiento (RF01.5) › [P-FUN-CU01] el enlace permite definir una contraseña nueva y revoca las sesiones abiertas
- Pasa · `tests/integracion/recuperacion.test.ts` · restablecimiento (RF01.5) › [P-FUN-CU01] el enlace es de un solo uso
- Pasa · `tests/integracion/recuperacion.test.ts` · restablecimiento (RF01.5) › [P-FUN-CU01] pedir un enlace nuevo invalida los anteriores no usados
- Pasa · `tests/integracion/recuperacion.test.ts` · restablecimiento (RF01.5) › [P-FUN-CU01] un enlace vencido no sirve
- Pasa · `tests/integracion/recuperacion.test.ts` · restablecimiento (RF01.5) › [P-FUN-CU01] un enlace inventado no sirve
- Pasa · `tests/integracion/recuperacion.test.ts` · restablecimiento (RF01.5) › [P-FUN-CU01] la contraseña nueva debe tener entre 12 y 128 caracteres
- Pasa · `tests/integracion/recuperacion.test.ts` · restablecimiento (RF01.5) › [P-FUN-CU01] el enlace de activación define la primera contraseña de una cuenta pendiente
- Pasa · `tests/integracion/recuperacion.test.ts` · bandeja de correos de desarrollo › [P-FUN-CU01] lista los correos del más nuevo al más antiguo
- Pasa en webkit-celular, webkit, celular, chromium · `tests/e2e/login.spec.ts` · [P-FUN-CU01] con credenciales válidas la productora entra al panel
- Pasa en webkit-celular, webkit, celular, chromium · `tests/e2e/login.spec.ts` · [P-FUN-CU01] el administrador entra a /admin
- Pasa en webkit-celular, webkit, celular, chromium · `tests/e2e/login.spec.ts` · [P-FUN-CU01] campos vacíos se marcan sin enviar la solicitud
- Pasa en webkit-celular, webkit, celular, chromium · `tests/e2e/login.spec.ts` · [P-FUN-CU01] un correo mal escrito se marca sin enviar la solicitud
- Pasa en webkit-celular, webkit, celular, chromium · `tests/e2e/login.spec.ts` · [P-FUN-CU01] credenciales inválidas: mensaje genérico y se conserva el correo
- Pasa en webkit-celular, webkit, celular, chromium · `tests/e2e/login.spec.ts` · [P-FUN-CU01] una cuenta deshabilitada no entra y el mensaje dice que no está disponible
- Pasa en webkit-celular, webkit, celular, chromium · `tests/e2e/login.spec.ts` · [P-FUN-CU01] «Mantener sesión iniciada» hace durar la sesión 30 días; sin marcarla, 8 horas
- Pasa en webkit-celular, webkit, celular, chromium · `tests/e2e/seguridad.spec.ts` · [P-FUN-CU01] tras 5 intentos fallidos, el inicio de sesión muestra «Demasiados intentos»
- Pasa en datos-2 · `tests/e2e/recuperacion.spec.ts` · [P-FUN-CU01] recuperación: pedir el enlace, abrirlo desde /dev/correos, definir la contraseña y entrar

### <a id="p-fun-cu02-funcionales-cu02"></a>P-FUN-CU02 · Funcionales → CU02

**Aprobado.** Número de serie disponible y repetido, sin escrituras parciales.

- Pasa · `tests/integracion/terrenos.test.ts` · registro de terrenos y estaciones (CU02) › [P-FUN-CU02] con número de serie disponible crea terreno, estación y los 6 sensores estándar
- Pasa · `tests/integracion/terrenos.test.ts` · registro de terrenos y estaciones (CU02) › [P-FUN-CU02] sin ubicación propia, la estación usa las coordenadas del terreno
- Pasa · `tests/integracion/terrenos.test.ts` · registro de terrenos y estaciones (CU02) › [P-FUN-CU02] se pueden desmarcar sensores, pero debe quedar al menos uno
- Pasa · `tests/integracion/terrenos.test.ts` · registro de terrenos y estaciones (CU02) › [P-FUN-CU02] con número de serie repetido informa el conflicto junto al campo y no escribe nada
- Pasa · `tests/integracion/terrenos.test.ts` · registro de terrenos y estaciones (CU02) › [P-FUN-CU02] datos faltantes o inválidos se marcan por campo
- Pasa · `tests/integracion/terrenos.test.ts` · registro de terrenos y estaciones (CU02) › [P-FUN-CU02] la estación con solo latitud o solo longitud se rechaza
- Pasa · `tests/integracion/terrenos.test.ts` · registro de terrenos y estaciones (CU02) › [P-FUN-CU02] se agregan estaciones a un terreno existente; con serie repetida no se escribe nada
- Pasa · `tests/integracion/terrenos.test.ts` · registro de terrenos y estaciones (CU02) › [P-FUN-CU02] el productor ve sus terrenos con estaciones y sensores, paginados
- Pasa en datos-1 · `tests/e2e/terrenos.spec.ts` · [P-FUN-CU02] registrar terreno con estación, conflicto de número de serie y agregar estación

### <a id="p-fun-cu04-funcionales-cu04"></a>P-FUN-CU04 · Funcionales → CU04

**Aprobado.** Los cinco estados de variable y los tres de estación.

- Pasa · `tests/integracion/estado.test.ts` · estado de las variables (RF04.2, diseno.md §8.1) › [P-FUN-CU04] NORMAL: lectura reciente que cumple sus criterios activos
- Pasa · `tests/integracion/estado.test.ts` · estado de las variables (RF04.2, diseno.md §8.1) › [P-FUN-CU04] FUERA_DE_RANGO: indica cuál criterio incumple
- Pasa · `tests/integracion/estado.test.ts` · estado de las variables (RF04.2, diseno.md §8.1) › [P-FUN-CU04] SIN_EVALUAR: lectura reciente sin criterios activos (deshabilitados y eliminados no cuentan)
- Pasa · `tests/integracion/estado.test.ts` · estado de las variables (RF04.2, diseno.md §8.1) › [P-FUN-CU04] SIN_DATOS_RECIENTES: más de 2 intervalos; el valor antiguo no se evalúa
- Pasa · `tests/integracion/estado.test.ts` · estado de las variables (RF04.2, diseno.md §8.1) › [P-FUN-CU04] exactamente 2 intervalos todavía cuenta como lectura reciente
- Pasa · `tests/integracion/estado.test.ts` · estado de las variables (RF04.2, diseno.md §8.1) › [P-FUN-CU04] SIN_LECTURAS: el sensor nunca ha reportado
- Pasa · `tests/integracion/estado.test.ts` · estado de las estaciones (RF04.4) › [P-FUN-CU04] ACTIVA, SIN_DATOS_RECIENTES y DESHABILITADA
- Pasa · `tests/integracion/estado.test.ts` · serie de 24 h (RF04.3) › [P-FUN-CU04] agrega a 30 minutos con el promedio y excluye lo anterior a 24 h
- Pasa · `tests/integracion/estado.test.ts` · alertas recientes (RF04.5) › [P-FUN-CU04] como máximo 10, las vigentes primero
- Pasa · `tests/integracion/estado.test.ts` · alertas recientes (RF04.5) › [P-FUN-CU04] se puede marcar una alerta como leída
- Pasa · `tests/integracion/estado.test.ts` · acceso › [P-FUN-CU04] la API entrega el estado a la dueña

### <a id="p-fun-cu05-funcionales-cu05"></a>P-FUN-CU05 · Funcionales → CU05

**Aprobado.** Rango válido, invertido y vacío; agregación; CSV.

- Pasa · `tests/integracion/historial.test.ts` · serie histórica (CU05) › [P-FUN-CU05] rango válido de 24 h: mediciones sin agregar, una serie por estación con el sensor
- Pasa · `tests/integracion/historial.test.ts` · serie histórica (CU05) › [P-FUN-CU05] rango invertido o igual responde 400 con el mensaje
- Pasa · `tests/integracion/historial.test.ts` · serie histórica (CU05) › [P-FUN-CU05] más de 1 año (366 días) responde 400
- Pasa · `tests/integracion/historial.test.ts` · serie histórica (CU05) › [P-FUN-CU05] un periodo sin mediciones responde 200 con las series vacías
- Pasa · `tests/integracion/historial.test.ts` · serie histórica (CU05) › [P-FUN-CU05] agrega en el menor intervalo que deja 500 puntos o menos
- Pasa · `tests/integracion/historial.test.ts` · serie histórica (CU05) › [P-FUN-CU05] cada punto agregado trae promedio, mínimo y máximo, y los intervalos empiezan en `desde`
- Pasa · `tests/integracion/historial.test.ts` · serie histórica (CU05) › [P-FUN-CU05] si los sensores tienen intervalos distintos, se usa el menor
- Pasa · `tests/integracion/historial.test.ts` · serie histórica (CU05) › [P-FUN-CU05] la comparación dura lo mismo, usa el mismo intervalo y se alinea por desfase
- Pasa · `tests/integracion/historial.test.ts` · serie histórica (CU05) › [P-FUN-CU05] una variable fuera del catálogo responde 400
- Pasa · `tests/integracion/historial.test.ts` · exportación a CSV (RF05.7) › [P-FUN-CU05] UTF-8 con BOM, separador «;», coma decimal, hora de Chile y sin agregar
- Pasa · `tests/integracion/historial.test.ts` · exportación a CSV (RF05.7) › [P-FUN-CU05] un periodo largo sale completo, por lotes
- Pasa · `tests/unit/fechas.test.ts` · días de Chile › [P-FUN-CU05] un día normal empieza a las 00:00 de Chile
- Pasa · `tests/unit/fechas.test.ts` · días de Chile › [P-FUN-CU05] en todos los días de dos años, el inicio cae en ese día y el instante anterior en el día previo
- Pasa · `tests/unit/fechas.test.ts` · días de Chile › [P-FUN-CU05] el rango de días es semiabierto e incluye completo el día «Hasta»
- Pasa · `tests/unit/fechas.test.ts` · días de Chile › [P-FUN-CU05] fecha_hora del CSV en hora de Chile, con segundos
- Pasa · `tests/unit/fechas.test.ts` · días de Chile › [P-FUN-CU05] las fechas relativas usan formato de 24 horas

### <a id="p-fun-cu06-funcionales-cu06-configuracion"></a>P-FUN-CU06 · Funcionales → CU06 (configuración)

**Aprobado.** Validación del umbral contra el rango; eliminación lógica.

- Pasa · `tests/integracion/criterios.test.ts` · configuración de criterios (CU06) › [P-FUN-CU06] se crea un criterio con umbral, condición y canales
- Pasa · `tests/integracion/criterios.test.ts` · configuración de criterios (CU06) › [P-FUN-CU06] el umbral fuera del rango admisible del sensor se indica junto al campo
- Pasa · `tests/integracion/criterios.test.ts` · configuración de criterios (CU06) › [P-FUN-CU06] el umbral debe ser numérico
- Pasa · `tests/integracion/criterios.test.ts` · configuración de criterios (CU06) › [P-FUN-CU06] sin canales se puede guardar; un canal desconocido no
- Pasa · `tests/integracion/criterios.test.ts` · configuración de criterios (CU06) › [P-FUN-CU06] muestra las últimas 5 lecturas del sensor, con su unidad y rango
- Pasa · `tests/integracion/criterios.test.ts` · configuración de criterios (CU06) › [P-FUN-CU06] la lista se puede filtrar por terreno
- Pasa · `tests/integracion/criterios.test.ts` · habilitar, deshabilitar y eliminar (RF06.4 y regla de §8.2) › [P-FUN-CU06] deshabilitar resuelve la alerta vigente con «Criterio deshabilitado»; habilitar no evalúa hacia atrás
- Pasa · `tests/integracion/criterios.test.ts` · habilitar, deshabilitar y eliminar (RF06.4 y regla de §8.2) › [P-FUN-CU06] eliminar es lógico: conserva el criterio y sus alertas, y resuelve la vigente con «Criterio eliminado»
- Pasa · `tests/integracion/criterios.test.ts` · lista de alertas e indicador de no leídas (RF06.10) › [P-FUN-CU06] filtra por estado y por no leídas, y la cantidad baja al marcarlas como leídas

### <a id="p-fun-cu07-funcionales-cu07-fila-por-agregar-a-la-tesis"></a>P-FUN-CU07 · Funcionales → CU07 (fila por agregar a la tesis)

**Aprobado.** Operaciones con motivo y evento; productor sin acceso a admin.

- Pasa · `tests/integracion/admin.test.ts` · registro de cuentas (RF07.3) › [P-FUN-CU07] crea el productor sin contraseña, con empresa nueva y RUT normalizado, y le envía el enlace de activación
- Pasa · `tests/integracion/admin.test.ts` · registro de cuentas (RF07.3) › [P-FUN-CU07] se puede asociar a una empresa existente
- Pasa · `tests/integracion/admin.test.ts` · registro de cuentas (RF07.3) › [P-FUN-CU07] un RUT inválido o repetido se indica junto al campo y no se escribe nada
- Pasa · `tests/integracion/admin.test.ts` · registro de cuentas (RF07.3) › [P-FUN-CU07] impide registrar un correo repetido, sin distinguir mayúsculas
- Pasa · `tests/integracion/admin.test.ts` · listado y detalle (RF07.2, RF07.5) › [P-FUN-CU07] lista solo productores, con búsqueda por nombre o correo y filtro por estado
- Pasa · `tests/integracion/admin.test.ts` · listado y detalle (RF07.2, RF07.5) › [P-FUN-CU07] el detalle muestra terrenos, estaciones y criterios, pero no mediciones
- Pasa · `tests/integracion/admin.test.ts` · listado y detalle (RF07.2, RF07.5) › [P-FUN-CU07] una cuenta de administrador no se gestiona por /admin/cuentas (404)
- Pasa · `tests/integracion/admin.test.ts` · actualización (RF07.4) › [P-FUN-CU07] el evento guarda cada campo modificado con su valor anterior y nuevo; el correo anterior recibe un aviso
- Pasa · `tests/integracion/admin.test.ts` · habilitación (RF07.4, RF07.8, RF07.9) › [P-FUN-CU07] deshabilitar exige motivo, revoca las sesiones y queda registrado
- Pasa · `tests/integracion/admin.test.ts` · habilitación (RF07.4, RF07.8, RF07.9) › [P-FUN-CU07] la operación y su evento van en la misma transacción: si el evento falla, no se aplica nada
- Pasa · `tests/integracion/admin.test.ts` · reenviar activación › [P-FUN-CU07] responde 409 si la cuenta ya está activa; si está pendiente, invalida el enlace anterior y envía uno nuevo
- Pasa · `tests/integracion/admin.test.ts` · estaciones y criterios (RF07.6 a RF07.8) › [P-FUN-CU07] deshabilitar una estación exige motivo, conserva su historial y queda registrado
- Pasa · `tests/integracion/admin.test.ts` · estaciones y criterios (RF07.6 a RF07.8) › [P-FUN-CU07] eliminar un criterio exige motivo; es lógico, conserva las alertas y resuelve la vigente
- Pasa · `tests/integracion/admin.test.ts` · eventos y listas de apoyo (RF07.10) › [P-FUN-CU07] los eventos se filtran por tipo y fecha, del más reciente al más antiguo, con su responsable
- Pasa · `tests/integracion/admin.test.ts` · eventos y listas de apoyo (RF07.10) › [P-FUN-CU07] lista las empresas para elegir una existente
- Pasa en datos-2 · `tests/e2e/admin.spec.ts` · [P-FUN-CU07] registrar un productor, activarlo desde /dev/correos y entrar
- Pasa en datos-2 · `tests/e2e/admin.spec.ts` · [P-FUN-CU07] deshabilitar cuenta, estación y umbral piden motivo y quedan en el registro de eventos

### <a id="p-fun-cu03-funcionales-cu03"></a>P-FUN-CU03 · Funcionales → CU03

**Aprobado.** Sensor registrado y no registrado.

- Pasa · `tests/integracion/ingesta.test.ts` · [P-FUN-CU03] Recepción de datos de sensores › [P-FUN-CU03] sensor registrado: la trama se acepta y se guardan sus lecturas
- Pasa · `tests/integracion/ingesta.test.ts` · [P-FUN-CU03] Recepción de datos de sensores › [P-FUN-CU03] sensor no registrado: se rechaza con 422, sin guardar nada y con evento

### <a id="p-fun-cu06-funcionales-cu06-evaluacion"></a>P-FUN-CU06 · Funcionales → CU06 (evaluación)

**Aprobado.** Fuera y dentro de rango, sin duplicados, resolución.

- Pasa · `tests/integracion/evaluacion.test.ts` · [P-FUN-CU06] Evaluación de criterios › [P-FUN-CU06] una lectura que incumple crea una alerta vigente con su mensaje y una notificación por canal
- Pasa · `tests/integracion/evaluacion.test.ts` · [P-FUN-CU06] Evaluación de criterios › [P-FUN-CU06] sin duplicados: otra lectura que incumple no crea otra alerta ni vuelve a notificar; una que cumple la resuelve
- Pasa · `tests/integracion/evaluacion.test.ts` · [P-FUN-CU06] Evaluación de criterios › [P-FUN-CU06] un valor igual al umbral no incumple, ni con «Supera» ni con «Desciende bajo»
- Pasa · `tests/integracion/evaluacion.test.ts` · [P-FUN-CU06] Evaluación de criterios › [P-FUN-CU06] un criterio deshabilitado o eliminado no se evalúa
- Pasa · `tests/integracion/evaluacion.test.ts` · [P-FUN-CU06] Evaluación de criterios › [P-FUN-CU06] un criterio sin canales crea la alerta, pero sin notificaciones (RF06.3)
- Pasa · `tests/integracion/evaluacion.test.ts` · [P-FUN-CU06] Evaluación de criterios › [P-FUN-CU06] una trama atrasada se guarda, pero no crea ni resuelve alertas

### <a id="p-int-ingesta-integraciones-ingesta-de-tramas"></a>P-INT-INGESTA · Integraciones → Ingesta de tramas

**Aprobado.** Trama válida se persiste; credencial o estructura inválida no.

- Pasa · `tests/integracion/ingesta.test.ts` · [P-INT-INGESTA] Ingesta de tramas › [P-INT-INGESTA] trama válida: guarda cada lectura con la trama original y actualiza la última lectura
- Pasa · `tests/integracion/ingesta.test.ts` · [P-INT-INGESTA] Ingesta de tramas › [P-INT-INGESTA] sin API key: 401, sin procesar el cuerpo y con evento sin la trama
- Pasa · `tests/integracion/ingesta.test.ts` · [P-INT-INGESTA] Ingesta de tramas › [P-INT-INGESTA] con una API key incorrecta: 401, sin procesar el cuerpo y con evento sin la trama
- Pasa · `tests/integracion/ingesta.test.ts` · [P-INT-INGESTA] Ingesta de tramas › [P-INT-INGESTA] cuerpo que no es JSON: 400 y evento con el texto recibido
- Pasa · `tests/integracion/ingesta.test.ts` · [P-INT-INGESTA] Ingesta de tramas › [P-INT-INGESTA] estructura inválida (fecha más de 5 min en el futuro): 400, sin guardar nada y con evento
- Pasa · `tests/integracion/ingesta.test.ts` · [P-INT-INGESTA] Ingesta de tramas › [P-INT-INGESTA] estructura inválida (fecha en otro formato): 400, sin guardar nada y con evento
- Pasa · `tests/integracion/ingesta.test.ts` · [P-INT-INGESTA] Ingesta de tramas › [P-INT-INGESTA] estructura inválida (sin lecturas): 400, sin guardar nada y con evento
- Pasa · `tests/integracion/ingesta.test.ts` · [P-INT-INGESTA] Ingesta de tramas › [P-INT-INGESTA] estructura inválida (más de 20 lecturas): 400, sin guardar nada y con evento
- Pasa · `tests/integracion/ingesta.test.ts` · [P-INT-INGESTA] Ingesta de tramas › [P-INT-INGESTA] estructura inválida (códigos repetidos): 400, sin guardar nada y con evento
- Pasa · `tests/integracion/ingesta.test.ts` · [P-INT-INGESTA] Ingesta de tramas › [P-INT-INGESTA] estructura inválida (valor no numérico): 400, sin guardar nada y con evento
- Pasa · `tests/integracion/ingesta.test.ts` · [P-INT-INGESTA] Ingesta de tramas › [P-INT-INGESTA] estructura inválida (sin número de serie): 400, sin guardar nada y con evento
- Pasa · `tests/integracion/ingesta.test.ts` · [P-INT-INGESTA] Ingesta de tramas › [P-INT-INGESTA] estación inexistente: 422, sin guardar nada y con evento
- Pasa · `tests/integracion/ingesta.test.ts` · [P-INT-INGESTA] Ingesta de tramas › [P-INT-INGESTA] estación deshabilitada: 422, sin guardar nada y con evento
- Pasa · `tests/integracion/ingesta.test.ts` · [P-INT-INGESTA] Ingesta de tramas › [P-INT-INGESTA] valor sobre el rango del sensor: 422, sin guardar nada y con evento
- Pasa · `tests/integracion/ingesta.test.ts` · [P-INT-INGESTA] Ingesta de tramas › [P-INT-INGESTA] valor bajo el rango del sensor: 422, sin guardar nada y con evento
- Pasa · `tests/integracion/ingesta.test.ts` · [P-INT-INGESTA] Ingesta de tramas › [P-INT-INGESTA] los límites del rango del sensor se aceptan
- Pasa · `tests/integracion/ingesta.test.ts` · [P-INT-INGESTA] Ingesta de tramas › [P-INT-INGESTA] lectura repetida (mismo sensor y fecha): no se duplica y la respuesta lo informa
- Pasa · `tests/integracion/ingesta.test.ts` · [P-INT-INGESTA] Ingesta de tramas › [P-INT-INGESTA] error de almacenamiento: 500, nada guardado a medias y evento ERROR_INGESTA
- Pasa · `tests/integracion/ingesta.test.ts` · [P-INT-INGESTA] Ingesta de tramas › [P-INT-INGESTA] el evento nunca guarda la API key y trunca la trama a 8 KB
- Pasa · `tests/integracion/ingesta.test.ts` · [P-INT-INGESTA] Ingesta de tramas › [P-INT-INGESTA] trama atrasada: se guarda, no mueve la última lectura ni se evalúa, y el panel muestra la más reciente

### <a id="p-int-notificacion-integraciones-notificacion-de-alertas"></a>P-INT-NOTIFICACION · Integraciones → Notificación de alertas

**Aprobado.** Fuera de rango notifica; dentro no.

- Pasa · `tests/integracion/evaluacion.test.ts` · [P-INT-NOTIFICACION] Notificación de alertas › [P-INT-NOTIFICACION] una lectura fuera de rango notifica por cada canal con el despachador real
- Pasa · `tests/integracion/evaluacion.test.ts` · [P-INT-NOTIFICACION] Notificación de alertas › [P-INT-NOTIFICACION] una lectura dentro de rango no notifica
- Pasa · `tests/integracion/evaluacion.test.ts` · [P-INT-NOTIFICACION] Notificación de alertas › [P-INT-NOTIFICACION] sin teléfono es una falla permanente: queda FALLIDA, un solo evento y no se reintenta
- Pasa · `tests/integracion/evaluacion.test.ts` · [P-INT-NOTIFICACION] Notificación de alertas › [P-INT-NOTIFICACION] una falla pasajera se reintenta con espera de 1, 2, 4 y 8 min y se detiene al intento 5
- Pasa · `tests/integracion/evaluacion.test.ts` · [P-INT-NOTIFICACION] Notificación de alertas › [P-INT-NOTIFICACION] una falla pasajera se envía en el siguiente reintento si el canal se recupera
- Pasa · `tests/integracion/evaluacion.test.ts` · [P-INT-NOTIFICACION] Notificación de alertas › [P-INT-NOTIFICACION] la tarea periódica despacha las notificaciones pendientes
- Pasa · `tests/integracion/evaluacion.test.ts` · [P-INT-NOTIFICACION] Notificación de alertas › [P-INT-NOTIFICACION] reglas de la espera creciente

### <a id="p-int-api-integraciones-consumo-de-la-api-rest"></a>P-INT-API · Integraciones → Consumo de la API REST

**Aprobado.** Sin token o con token vencido: 401 y la interfaz pide iniciar sesión.

- Pasa · `tests/integracion/acceso-paginas.test.ts` · protección de páginas (RF01.8, diseno.md §8.4) › [P-INT-API] sin sesión, toda página salvo /login y /restablecer lleva a /login
- Pasa · `tests/integracion/acceso-paginas.test.ts` · protección de páginas (RF01.8, diseno.md §8.4) › [P-INT-API] un productor que pide /admin va a /
- Pasa · `tests/integracion/acceso-paginas.test.ts` · protección de páginas (RF01.8, diseno.md §8.4) › [P-INT-API] un administrador que pide una página de productor va a /admin
- Pasa · `tests/integracion/acceso-paginas.test.ts` · protección de páginas (RF01.8, diseno.md §8.4) › [P-INT-API] con sesión, /login lleva al inicio del rol y la 404 se muestra
- Pasa · `tests/integracion/acceso-paginas.test.ts` · consumo de la API sin sesión válida › [P-INT-API] con sesión hay datos
- Pasa · `tests/integracion/acceso-paginas.test.ts` · consumo de la API sin sesión válida › [P-INT-API] sin token, con token vencido o alterado responde 401
- Pasa · `tests/integracion/solo-desarrollo.test.ts` · bandeja de correos según el entorno › [P-INT-API] en desarrollo, /dev/correos se ve sin sesión y con sesión
- Pasa · `tests/integracion/solo-desarrollo.test.ts` · bandeja de correos según el entorno › [P-INT-API] con NODE_ENV=production, la página responde 404 con o sin sesión
- Pasa · `tests/integracion/solo-desarrollo.test.ts` · bandeja de correos según el entorno › [P-INT-API] con NODE_ENV=production, el endpoint responde 404
- Pasa · `tests/integracion/solo-desarrollo.test.ts` · bandeja de correos según el entorno › [P-INT-API] en desarrollo, el endpoint responde 200
- Pasa en webkit-celular, webkit, celular, chromium · `tests/e2e/sesion.spec.ts` · [P-INT-API] sin sesión, cualquier página lleva a /login
- Pasa en webkit-celular, webkit, celular, chromium · `tests/e2e/sesion.spec.ts` · [P-INT-API] con una cookie alterada o vencida lleva a /login y la cookie se borra
- Pasa en webkit-celular, webkit, celular, chromium · `tests/e2e/sesion.spec.ts` · [P-INT-API] con sesión de productora se ve su menú y /admin la devuelve al panel
- Pasa en webkit-celular, webkit, celular, chromium · `tests/e2e/sesion.spec.ts` · [P-INT-API] con sesión de administrador se ve su menú y las páginas de productor lo llevan a /admin
- Pasa en webkit-celular, webkit, celular, chromium · `tests/e2e/sesion.spec.ts` · [P-INT-API] con sesión, /login lleva al inicio del rol
- Pasa en webkit-celular, webkit, celular, chromium · `tests/e2e/sesion.spec.ts` · [P-INT-API] cerrar sesión la invalida: volver atrás pide iniciar sesión

### <a id="p-e2e-ingesta-panel-integrales-ingesta-a-visualizacion"></a>P-E2E-INGESTA-PANEL · Integrales → Ingesta a visualización

**Aprobado.** El emulador envía una trama y el panel la muestra con su estado.

- Pasa en datos-1 · `tests/e2e/flujos.spec.ts` · [P-E2E-INGESTA-PANEL] el emulador envía una trama y el panel la muestra con su estado

### <a id="p-e2e-dato-alerta-integrales-dato-a-alerta"></a>P-E2E-DATO-ALERTA · Integrales → Dato a alerta

**Aprobado.** Escenario `sequia`: alerta, correo en `/dev/correos` y panel.

- Pasa en datos-1 · `tests/e2e/flujos.spec.ts` · [P-E2E-DATO-ALERTA] escenario sequia: alerta en el panel, correo en /dev/correos e indicador de no leídas

### <a id="p-e2e-historial-integrales-historial"></a>P-E2E-HISTORIAL · Integrales → Historial

**Aprobado.** Serie, comparación y descarga del CSV.

- Pasa en webkit-celular, webkit, celular, chromium · `tests/e2e/historial.spec.ts` · [P-E2E-HISTORIAL] serie con atajos, comparación superpuesta y descarga del CSV

### <a id="p-seg-contrasenas-seguridad-contrasenas"></a>P-SEG-CONTRASENAS · Seguridad → Contraseñas

**Aprobado.** Formato scrypt; no contiene la contraseña.

- Pasa · `tests/integracion/contrasenas.test.ts` · almacenamiento de contraseñas › [P-SEG-CONTRASENAS] el hash tiene formato scrypt$N$r$p$sal$hash y no contiene la contraseña
- Pasa · `tests/integracion/contrasenas.test.ts` · almacenamiento de contraseñas › [P-SEG-CONTRASENAS] la misma contraseña produce hashes distintos (sal aleatoria)
- Pasa · `tests/integracion/contrasenas.test.ts` · almacenamiento de contraseñas › [P-SEG-CONTRASENAS] la verificación acepta la contraseña correcta y rechaza otras
- Pasa · `tests/integracion/contrasenas.test.ts` · almacenamiento de contraseñas › [P-SEG-CONTRASENAS] sin hash (cuenta pendiente o inexistente) nunca verifica
- Pasa en webkit-celular, webkit, celular, chromium · `tests/e2e/sin-javascript.spec.ts` · [P-SEG-CONTRASENAS] sin JavaScript, el inicio de sesión no envía la contraseña ni la deja en la URL
- Pasa en webkit-celular, webkit, celular, chromium · `tests/e2e/sin-javascript.spec.ts` · [P-SEG-CONTRASENAS] sin JavaScript, restablecer la contraseña no la envía ni la deja en la URL
- Pasa en webkit-celular, webkit, celular, chromium · `tests/e2e/sin-javascript.spec.ts` · [P-SEG-CONTRASENAS] sin JavaScript, cambiar la contraseña en Ajustes no la envía ni la deja en la URL

### <a id="p-seg-sesion-seguridad-validez-de-la-sesion"></a>P-SEG-SESION · Seguridad → Validez de la sesión

**Aprobado.** Token válido, vencido, ausente, alterado y revocado.

- Pasa · `tests/integracion/sesion.test.ts` · validez de la sesión › [P-SEG-SESION] un token válido da acceso con los datos de la cuenta
- Pasa · `tests/integracion/sesion.test.ts` · validez de la sesión › [P-SEG-SESION] sin token responde 401
- Pasa · `tests/integracion/sesion.test.ts` · validez de la sesión › [P-SEG-SESION] un token vencido responde 401
- Pasa · `tests/integracion/sesion.test.ts` · validez de la sesión › [P-SEG-SESION] un token alterado responde 401
- Pasa · `tests/integracion/sesion.test.ts` · validez de la sesión › [P-SEG-SESION] un token firmado con otra clave responde 401
- Pasa · `tests/integracion/sesion.test.ts` · validez de la sesión › [P-SEG-SESION] un token revocado responde 401
- Pasa · `tests/integracion/sesion.test.ts` · validez de la sesión › [P-SEG-SESION] la tabla guarda el SHA-256 del token, no el token
- Pasa · `tests/integracion/sesion.test.ts` · validez de la sesión › [P-SEG-SESION] deshabilitar la cuenta invalida sus sesiones abiertas

### <a id="p-seg-aislamiento-complementaria-rnf02"></a>P-SEG-AISLAMIENTO · (complementaria, RNF02)

**Aprobado.** Recurso ajeno responde 404; admin responde 403 a un productor.

- Pasa · `tests/integracion/admin.test.ts` · acceso (RF07.1) › [P-SEG-AISLAMIENTO] un productor recibe 403 en /admin y el intento queda registrado; sin sesión, 401
- Pasa · `tests/integracion/criterios.test.ts` · acceso › [P-SEG-AISLAMIENTO] otro productor recibe 404 en sensores y criterios ajenos
- Pasa · `tests/integracion/criterios.test.ts` · acceso › [P-SEG-AISLAMIENTO] el administrador recibe 403 y sin sesión 401
- Pasa · `tests/integracion/estado.test.ts` · acceso › [P-SEG-AISLAMIENTO] otro productor recibe 404 en el estado y al marcar una alerta ajena
- Pasa · `tests/integracion/estado.test.ts` · acceso › [P-SEG-AISLAMIENTO] el administrador recibe 403 y sin sesión 401
- Pasa · `tests/integracion/historial.test.ts` · acceso › [P-SEG-AISLAMIENTO] otro productor recibe 404; el administrador, 403; sin sesión, 401
- Pasa · `tests/integracion/sesion.test.ts` · guardas por rol › [P-SEG-AISLAMIENTO] un productor recibe 403 en una ruta de administrador y queda registrado
- Pasa · `tests/integracion/sesion.test.ts` · guardas por rol › [P-SEG-AISLAMIENTO] el rol permitido pasa la guarda
- Pasa · `tests/integracion/terrenos.test.ts` · aislamiento entre cuentas (RNF02) › [P-SEG-AISLAMIENTO] otro productor recibe 404 al ver el terreno o agregarle estaciones
- Pasa · `tests/integracion/terrenos.test.ts` · aislamiento entre cuentas (RNF02) › [P-SEG-AISLAMIENTO] el listado de otro productor no incluye terrenos ajenos
- Pasa · `tests/integracion/terrenos.test.ts` · aislamiento entre cuentas (RNF02) › [P-SEG-AISLAMIENTO] el administrador recibe 403 y queda registrado
- Pasa · `tests/integracion/terrenos.test.ts` · aislamiento entre cuentas (RNF02) › [P-SEG-AISLAMIENTO] sin sesión responde 401
- Pasa en datos-2 · `tests/e2e/admin.spec.ts` · [P-SEG-AISLAMIENTO] una productora que pide /admin vuelve a su panel

### <a id="t6-5-accesibilidad-complementaria-rnf03-y-rnf05"></a>T6.5 · Accesibilidad (complementaria, RNF03 y RNF05)

**Aprobado.** Todas las pantallas, en Chromium y WebKit, escritorio y celular: sin infracciones detectadas por axe-core (WCAG 2.1 A y AA) y comprobaciones propias.

«Aprobado» significa que axe-core no detectó infracciones (WCAG 2.1 A y AA, ninguna regla desactivada) y que pasaron las comprobaciones propias (áreas táctiles de 44 px, texto base de 18 px y ninguno bajo 16 px, estados con ícono y texto, foco visible, sin scroll horizontal a 360 px y `prefers-reduced-motion`). Una herramienta automática no detecta todos los problemas: no equivale a certificar el cumplimiento de WCAG. Observación no cubierta por las herramientas: el texto de los ejes y la leyenda de los gráficos (canvas) es de unos 12 px.

- Pasa en webkit-celular, webkit, celular, chromium · `tests/e2e/accesibilidad.spec.ts` · [T6.5] Inicio de sesión: sin infracciones detectadas por axe-core y con las comprobaciones propias
- Pasa en webkit-celular, webkit, celular, chromium · `tests/e2e/accesibilidad.spec.ts` · [T6.5] Restablecer contraseña: sin infracciones detectadas por axe-core y con las comprobaciones propias
- Pasa en webkit-celular, webkit, celular, chromium · `tests/e2e/accesibilidad.spec.ts` · [T6.5] Panel de estado: sin infracciones detectadas por axe-core y con las comprobaciones propias
- Pasa en webkit-celular, webkit, celular, chromium · `tests/e2e/accesibilidad.spec.ts` · [T6.5] Panel sin terrenos: sin infracciones detectadas por axe-core y con las comprobaciones propias
- Pasa en webkit-celular, webkit, celular, chromium · `tests/e2e/accesibilidad.spec.ts` · [T6.5] Historial: sin infracciones detectadas por axe-core y con las comprobaciones propias
- Pasa en webkit-celular, webkit, celular, chromium · `tests/e2e/accesibilidad.spec.ts` · [T6.5] Alertas: lista: sin infracciones detectadas por axe-core y con las comprobaciones propias
- Pasa en webkit-celular, webkit, celular, chromium · `tests/e2e/accesibilidad.spec.ts` · [T6.5] Alertas: umbrales: sin infracciones detectadas por axe-core y con las comprobaciones propias
- Pasa en webkit-celular, webkit, celular, chromium · `tests/e2e/accesibilidad.spec.ts` · [T6.5] Ajustes: Perfil: sin infracciones detectadas por axe-core y con las comprobaciones propias
- Pasa en webkit-celular, webkit, celular, chromium · `tests/e2e/accesibilidad.spec.ts` · [T6.5] Ajustes: Seguridad: sin infracciones detectadas por axe-core y con las comprobaciones propias
- Pasa en webkit-celular, webkit, celular, chromium · `tests/e2e/accesibilidad.spec.ts` · [T6.5] Ajustes: Terrenos y estaciones: sin infracciones detectadas por axe-core y con las comprobaciones propias
- Pasa en webkit-celular, webkit, celular, chromium · `tests/e2e/accesibilidad.spec.ts` · [T6.5] Administración: Cuentas: sin infracciones detectadas por axe-core y con las comprobaciones propias
- Pasa en webkit-celular, webkit, celular, chromium · `tests/e2e/accesibilidad.spec.ts` · [T6.5] Administración: Detalle de cuenta: sin infracciones detectadas por axe-core y con las comprobaciones propias
- Pasa en webkit-celular, webkit, celular, chromium · `tests/e2e/accesibilidad.spec.ts` · [T6.5] Administración: Eventos: sin infracciones detectadas por axe-core y con las comprobaciones propias
- Pasa en webkit-celular, webkit, celular, chromium · `tests/e2e/accesibilidad.spec.ts` · [T6.5] Bandeja de correos (desarrollo): sin infracciones detectadas por axe-core y con las comprobaciones propias
- Pasa en webkit-celular, webkit, celular, chromium · `tests/e2e/accesibilidad.spec.ts` · [T6.5] Página no encontrada: sin infracciones detectadas por axe-core y con las comprobaciones propias

### <a id="p-seg-cifrado-seguridad-cifrado"></a>P-SEG-CIFRADO · Seguridad → Cifrado

**Aprobado.** Documental: no aplica en local (HTTP en localhost).

El prototipo se ejecuta en localhost por HTTP. Las pruebas verifican que en local la cookie va sin `Secure` y sin HSTS, y que con `APP_URL` en https la cookie lleva `Secure` y la respuesta trae HSTS.

- Pasa · `tests/integracion/exposicion-cifrado.test.ts` · [P-SEG-CIFRADO] Cifrado en tránsito › [P-SEG-CIFRADO] en local (http) no aplica: la cookie va sin Secure y no hay HSTS
- Pasa · `tests/integracion/exposicion-cifrado.test.ts` · [P-SEG-CIFRADO] Cifrado en tránsito › [P-SEG-CIFRADO] con APP_URL en https, la cookie lleva Secure y la respuesta trae HSTS

### <a id="p-seg-exposicion-bd-seguridad-exposicion-de-la-bd"></a>P-SEG-EXPOSICION-BD · Seguridad → Exposición de la BD

**Aprobado.** SQLite es un archivo local sin puerto de red.

- Pasa · `tests/integracion/exposicion-cifrado.test.ts` · [P-SEG-EXPOSICION-BD] La base de datos no se expone en la red › [P-SEG-EXPOSICION-BD] SQLite se abre como un archivo local, sin host ni puerto
- Pasa · `tests/integracion/exposicion-cifrado.test.ts` · [P-SEG-EXPOSICION-BD] La base de datos no se expone en la red › [P-SEG-EXPOSICION-BD] no hay clientes de bases de datos de red entre las dependencias
- Pasa · `tests/integracion/exposicion-cifrado.test.ts` · [P-SEG-EXPOSICION-BD] La base de datos no se expone en la red › [P-SEG-EXPOSICION-BD] la base, los correos y los respaldos quedan fuera del repositorio

### <a id="p-car-ingesta-carga-ingesta"></a>P-CAR-INGESTA · Carga → Ingesta

**Aprobado.** 768 tramas (un día de las 8 estaciones), de a 10 en paralelo: cero errores y cero lecturas perdidas.

- Ingesta (por trama): 768 consultas, 0 errores, p95 de 41 ms (umbral: menos de 3.000 ms). Cumple.
- Lecturas perdidas: 0 de 4.608. Cumple.

### <a id="p-car-historico-carga-historico"></a>P-CAR-HISTORICO · Carga → Histórico

**Aprobado.** Panel e historial de 1 año con 4 años de datos: p95 < 3 s; las consultas usan el índice (sensor_id, fecha).

- Panel de estado: 30 consultas, 0 errores, p95 de 9 ms (umbral: menos de 3.000 ms). Cumple.
- Historial de 1 año: 30 consultas, 0 errores, p95 de 141 ms (umbral: menos de 3.000 ms). Cumple.
- Plan de consulta (RNF06): `SEARCH mediciones USING INDEX mediciones_sensor_fecha_unico (sensor_id=? AND fecha>? AND fecha<?)`. Cumple.

### <a id="p-car-concurrencia-carga-concurrencia"></a>P-CAR-CONCURRENCIA · Carga → Concurrencia

**Aprobado.** 20 sesiones simultáneas: cero errores y p95 < 3 s.

- 20 usuarios simultáneos: 400 consultas, 0 errores, p95 de 787 ms (umbral: menos de 3.000 ms). Cumple.

### <a id="p-inf-despliegue-infraestructura-despliegue"></a>P-INF-DESPLIEGUE · Infraestructura → Despliegue

**Aprobado.** `build` + `start` y consulta a `/api/salud`.

- Pasa · `tests/infra/despliegue.test.ts` · [P-INF-DESPLIEGUE] build + start: la versión de producción arranca, responde y hace su respaldo

### <a id="p-inf-respaldo-infraestructura-respaldo"></a>P-INF-RESPALDO · Infraestructura → Respaldo

**Aprobado.** Respaldo diario y restauración con verificación de conteos.

- Pasa · `tests/integracion/respaldo.test.ts` · [P-INF-RESPALDO] Respaldo diario y restauración › [P-INF-RESPALDO] crea el respaldo del día con VACUUM INTO, con nombre del día de Chile, y no lo repite
- Pasa · `tests/integracion/respaldo.test.ts` · [P-INF-RESPALDO] Respaldo diario y restauración › [P-INF-RESPALDO] conserva 30 días y borra los más antiguos, sin tocar otros archivos
- Pasa · `tests/integracion/respaldo.test.ts` · [P-INF-RESPALDO] Respaldo diario y restauración › [P-INF-RESPALDO] restaura un respaldo después de cambios y verifica los conteos de cada tabla
- Pasa · `tests/integracion/respaldo.test.ts` · [P-INF-RESPALDO] Respaldo diario y restauración › [P-INF-RESPALDO] un archivo dañado o inexistente se rechaza sin tocar la base

### <a id="p-inf-monitoreo-infraestructura-monitoreo"></a>P-INF-MONITOREO · Infraestructura → Monitoreo

**Aprobado.** `/api/salud` ante una falla.

- Pasa · `tests/integracion/respaldo.test.ts` · [P-INF-MONITOREO] Salud del servicio › [P-INF-MONITOREO] informa base, notificaciones pendientes y fallidas, y último respaldo
- Pasa · `tests/integracion/respaldo.test.ts` · [P-INF-MONITOREO] Salud del servicio › [P-INF-MONITOREO] ante una falla de la base, /api/salud responde 503 con estado «error»

## Anexo: pruebas complementarias

Pruebas que llevan el ID de su tarea en `docs/spec/tareas.md`, porque no respaldan una fila de la tesis.

| ID | Pruebas | Resultado |
|---|---|---|
| T0.1 | 20 (16 pasan, 4 omitidas) | Aprobado |
| T0.3 | 16 (16 pasan) | Aprobado |
| T0.4 | 24 (24 pasan) | Aprobado |
| T0.5 | 23 (23 pasan) | Aprobado |
| T1.5 | 11 (11 pasan) | Aprobado |
| T2.1 | 17 (17 pasan) | Aprobado |
| T2.2 | 5 (5 pasan) | Aprobado |
| T5.3 | 10 (10 pasan) | Aprobado |
| T6.1 | 15 (15 pasan) | Aprobado |
| T6.6 | 11 (11 pasan) | Aprobado |
