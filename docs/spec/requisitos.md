# Requisitos del prototipo

Fuente: tesis "Sistema de Monitoreo Medioambiental con LoRa", capítulos 2 (objetivos y alcance), 6 (Ingeniería de Requerimientos), 7 (Ingeniería de Diseño) y 9 (Ingeniería de QA). Si este documento y la tesis difieren, este documento manda y la diferencia se reporta.

## 1. Propósito

Poner a disposición del productor agrícola de pequeña escala las mediciones ambientales de sus propios terrenos, para que pueda anticipar condiciones adversas y verificar el efecto de sus decisiones de riego, fertilización y manejo.

El sistema es estrictamente informativo: no recomienda, no predice y no controla actuadores.

## 2. Alcance del prototipo

**Dentro del alcance**

- Aplicación web responsive (escritorio y celular) con autenticación, registro de terrenos y estaciones, panel de estado, historial con exportación, configuración de alertas y módulo de administración.
- Endpoint de ingesta HTTP con el mismo contrato que usaría un servidor de red LoRaWAN (ver `diseno.md` §6).
- Emulador de estaciones que envía tramas simuladas a ese endpoint, con escenarios de prueba.
- Notificaciones en la plataforma y por correo electrónico. SMS y WhatsApp como canales simulados con la misma interfaz que un proveedor real.
- Ejecución 100 % local con SQLite: `npm install` y `npm run dev`, sin Docker ni servicios en la nube.
- Pruebas automatizadas que generan la evidencia del capítulo 9 de la tesis.

**Fuera del alcance** (no implementar)

- Hardware, firmware, gateway o servidor de red LoRaWAN reales.
- Despliegue en Azure u otra nube (el diseño lo contempla; el prototipo es local).
- Integración con proveedores reales de SMS o WhatsApp.
- Análisis predictivo, IA, recomendaciones agronómicas, control de riego.
- Aplicación móvil nativa.
- La pantalla "Observaciones" del prototipo actual: su contenido no está definido. Se retira del menú hasta que se defina.

## 3. Actores y roles

| Actor | Rol en el sistema | Descripción |
|---|---|---|
| Productor agrícola | `PRODUCTOR` | Usuario principal. Registra terrenos y estaciones, consulta estado e historial, configura umbrales y recibe alertas. Solo ve los datos de su cuenta. |
| Administrador de la plataforma | `ADMINISTRADOR` | Crea y gestiona cuentas de productores, supervisa estaciones y umbrales. No ve ni modifica mediciones. |
| Servidor de red LoRaWAN | (sistema, API key) | Entrega las lecturas al endpoint de ingesta. En el prototipo lo reemplaza el emulador. |

No hay autorregistro: las cuentas de productor las crea el administrador.

## 4. Requerimientos funcionales

Cada RF indica su historia de usuario (HU) y caso de uso (CU) en la tesis. Los criterios de aceptación son verificables y cada uno debe quedar cubierto por al menos una prueba.

### RF01 — Autenticación y gestión de sesiones (HU01, CU01)

**Descripción:** acceso con correo y contraseña. La sesión determina qué funciones y datos ve cada usuario según su rol.

**Criterios de aceptación**

1. Con credenciales válidas, se crea una sesión con expiración y se redirige al panel correspondiente al rol: el productor va a `/` y el administrador a `/admin`.
2. Si un campo está vacío o el correo no tiene un formato válido, el formulario indica el error sin enviar la solicitud.
3. Con credenciales inválidas, se muestra un mensaje genérico que no revela si el correo existe. El formulario conserva el correo ingresado.
4. Una cuenta deshabilitada no puede iniciar sesión; el mensaje indica que la cuenta no está disponible.
5. **Recuperación de contraseña.**
   - "¿Olvidaste tu contraseña?" pide el correo y siempre responde el mismo mensaje, exista o no la cuenta.
   - Si existe, se envía un enlace de un solo uso que vence en 1 hora.
   - El enlace permite definir una contraseña nueva e invalida las sesiones abiertas.
6. **"Mantener sesión iniciada".** Si está marcada, la sesión dura 30 días; si no, 8 horas.
7. **Cierre de sesión.** Invalida la sesión en el servidor, no solo en el navegador.
8. **Protección de rutas.** Toda página distinta de `/login` y `/restablecer` exige una sesión válida y, si no la hay, redirige a `/login`. Toda llamada a la API sin sesión válida responde 401.
   - **Excepción, solo en desarrollo:** la bandeja de correos `/dev/correos` y su endpoint son públicos, para demostrar la recuperación de contraseña sin un servidor de correo. En producción no existen: responden 404 (`diseno.md` §9).
9. *(Fase de endurecimiento)* Tras 5 intentos fallidos para un mismo correo en 15 minutos, se bloquean nuevos intentos durante 15 minutos. Cada intento fallido queda registrado como evento.

### RF02 — Registro de terrenos y estaciones (HU02, CU02)

**Descripción:** el productor registra sus terrenos, las estaciones instaladas en ellos y los sensores de cada estación.

**Criterios de aceptación**

1. **Datos del terreno:**
   - nombre (obligatorio);
   - ubicación, como latitud y longitud (obligatoria y dentro de rangos válidos);
   - superficie en hectáreas (opcional);
   - tipo de cultivo (opcional).
2. **Datos de la estación:**
   - tipo, modelo y número de serie (obligatorios);
   - ubicación dentro del terreno, como latitud y longitud (opcional; si se deja vacía, se usan las coordenadas del terreno).
3. **Sensores de la estación.** Por defecto se crean los 6 sensores estándar (`diseno.md` §5). El productor puede desmarcar los que su estación no tenga, pero debe quedar al menos uno.
4. **Número de serie repetido.** Si ya existe, se informa el conflicto junto al campo y no se escribe ningún registro. Terreno, estación y sensores se guardan en una sola transacción.
5. **Errores del formulario.** Si faltan datos o son inválidos, se marcan los campos con error y se conserva lo ya ingresado.
6. **Listados.** El productor ve la lista de sus terrenos con sus estaciones y sensores, y puede agregar estaciones a un terreno existente.
7. **Propiedad.** Un productor no puede ver ni modificar terrenos de otra cuenta: la API responde 404.

### RF03 — Recepción y almacenamiento de datos de sensores (HU03, CU03)

**Descripción:** proceso automático, sin interfaz. El servidor de red (el emulador, en el prototipo) envía tramas JSON por HTTP.

**Criterios de aceptación**

1. **Credencial.** Una trama sin API key válida se rechaza con 401 sin procesar su contenido, y se registra el evento.
2. **Estructura.** Una trama con estructura o valores inválidos se rechaza con 400, sin persistir nada, y se registra el evento con la trama y la causa.
3. **Origen desconocido o no admitido.** Se rechaza con 422, sin persistir nada, y se registra el evento, en estos casos:
   - número de serie o código de sensor no registrado;
   - estación deshabilitada;
   - valor fuera del rango admisible del sensor.
4. **Trama válida.** Se guarda cada lectura con su valor y la trama original (JSONB), se actualiza la fecha de última lectura de cada sensor, se evalúan los criterios (RF06) y se responde 200 con el número de lecturas aceptadas.
5. **Duplicados.** Una lectura repetida (mismo sensor y misma fecha) no se duplica ni se vuelve a evaluar; la respuesta lo informa.
6. **Error de almacenamiento.** Si falla la escritura, se responde 500 y no queda nada guardado a medias, para permitir el reenvío.
7. **Inmutabilidad.** Las mediciones no se pueden modificar ni eliminar desde ninguna parte del sistema.

### RF04 — Visualización del estado actual del terreno (HU04, CU04)

**Descripción:** panel de estado (dashboard). La lógica de estado se calcula en el servidor y la interfaz solo la presenta.

**Criterios de aceptación**

1. **Selección de terreno.** El productor elige uno de sus terrenos; por defecto se muestra el primero. Si no tiene terrenos, el panel lo explica y ofrece registrar uno.
2. **Datos por variable.** Para cada sensor se muestra el valor vigente, la unidad, la fecha y hora de la lectura y uno de estos estados:
   - **Normal:** hay lectura reciente y cumple todos sus criterios activos.
   - **Fuera de rango:** incumple al menos un criterio activo. Se indica cuál (por ejemplo, "bajo 20 %").
   - **Sin datos recientes:** la última lectura tiene más de 2 intervalos de medición. No se destaca el valor antiguo; se muestra la fecha del último dato.
   - **Sin evaluar:** hay lectura reciente pero el sensor no tiene criterios activos.
   - **Sin lecturas:** el sensor nunca ha reportado.
3. **Mini-gráfico.** Cada variable incluye la evolución de sus últimas 24 horas.
4. **Estaciones.** Se muestra el estado de cada estación: activa, sin datos recientes o deshabilitada.
5. **Alertas recientes.** Se muestran las últimas 10 alertas del terreno, vigentes primero, con opción de marcarlas como leídas.
6. **Actualización.** El panel se refresca solo cada 60 segundos mientras está abierto.

### RF05 — Consulta del historial de mediciones (HU05, CU05)

**Criterios de aceptación**

1. **Filtros:** terreno, variable (tipo de sensor) y rango de fechas. Existen atajos: últimas 24 h, 7 días, 30 días y 1 año.
2. **Rango inválido.** Si la fecha inicial es posterior a la final, se muestra el error y no se consulta. El mismo día en ambos campos es válido: el rango va desde el inicio del día «Desde» hasta el final del día «Hasta», en hora de Chile (`diseno.md` §8.3).
3. **Resultado.** Se muestra una serie de tiempo con Chart.js, una línea por estación que tenga esa variable en el terreno.
4. **Agregación.** Si el periodo tiene más de 500 puntos por serie, el servidor agrega por intervalo (promedio, mínimo y máximo). El gráfico indica el intervalo usado.
5. **Comparación.** Se puede superponer otro periodo de igual duración: "semana anterior" o un periodo elegido por el usuario. Ambas series se alinean desde el inicio de su periodo.
6. **Sin datos.** Si no hay mediciones, se informa "No hay mediciones en este periodo" y se mantienen los filtros.
7. **Exportación a CSV.** Exporta las mediciones del periodo sin agregar, con:
   - separador `;` y coma decimal;
   - UTF-8 con BOM, para que Excel en Chile lo abra correctamente;
   - columnas: fecha y hora (America/Santiago), terreno, estación, variable, valor y unidad.

### RF06 — Alertas y notificaciones por umbral (HU06, CU06)

**Criterios de aceptación**

1. **Configurar un criterio.** El productor elige terreno, sensor y variable. La pantalla muestra la unidad y las últimas 5 lecturas como referencia. Luego ingresa el valor de umbral, elige la condición (**Supera** / **Desciende bajo**) y marca los canales: plataforma, correo, SMS y WhatsApp.
2. **Validación del umbral.** El umbral debe ser numérico y estar dentro del rango admisible del sensor; si no, se indica el error junto al campo.
3. **Sin canales.** Si no marca ningún canal, se advierte que la alerta quedará registrada en la plataforma pero no se comunicará. Aun así se puede guardar.
4. **Gestión de criterios.** El productor puede ver sus criterios, habilitarlos o deshabilitarlos y eliminarlos. La eliminación es lógica.
5. **Evaluación.** Cada lectura aceptada se compara con los criterios habilitados y no eliminados de su sensor. "Supera" significa valor > umbral; "Desciende bajo" significa valor < umbral.
6. **Generación.** Si la lectura incumple y no existe una alerta vigente para ese criterio, se crea una alerta vigente con un mensaje que identifica terreno, estación, variable, valor y umbral. Se genera además una notificación por cada canal habilitado.
7. **Sin duplicados.** Si ya existe una alerta vigente para el criterio, no se crea otra ni se vuelve a notificar.
8. **Resolución.** Si una lectura posterior cumple el criterio y existe una alerta vigente, esta pasa a resuelta con su fecha de resolución.
9. **Envío fallido.** Si un envío falla, la alerta se conserva y el envío se reintenta. *(Fase de endurecimiento: hasta 5 intentos con espera creciente.)* El estado de cada envío queda registrado.
10. **Vista de alertas.** El productor ve la lista de alertas con filtro por terreno y estado, y un indicador de alertas no leídas en la barra lateral.

### RF07 — Administración de usuarios y configuraciones (HU07, CU07)

**Criterios de aceptación**

1. **Acceso.** Solo el rol ADMINISTRADOR entra a `/admin` y a `/api/v1/admin/*`. Otro rol recibe 403 y el intento queda registrado.
2. **Listado de cuentas** de productores con búsqueda por nombre o correo y filtro por estado (habilitada o deshabilitada).
3. **Registro de cuentas.** El administrador registra una cuenta de productor con estos datos:
   - nombre, apellido, correo y teléfono;
   - empresa, nueva o existente (con validación de RUT) y cargo.
   
   El sistema impide registrar un correo repetido. Al crearla, se envía al productor un enlace para definir su contraseña; el administrador nunca la conoce.
4. **Actualización y habilitación.** El administrador puede actualizar los datos generales de una cuenta (nombre, apellido, teléfono, correo y cargo; la empresa no se cambia) y habilitarla o deshabilitarla. Si cambia el correo, se avisa al correo anterior. El registro del cambio guarda cada campo modificado con su valor anterior y nuevo (`diseno.md` §7).
5. **Detalle de una cuenta:** muestra sus terrenos, estaciones y criterios. No muestra mediciones.
6. **Deshabilitar una estación.** La estación deja de aceptar lecturas y conserva su historial.
7. **Eliminar un criterio.** La eliminación es lógica: el criterio deja de evaluarse y sus alertas se conservan.
8. **Operaciones sensibles.** Deshabilitar cuenta o estación y eliminar criterio piden confirmación y un motivo obligatorio. Se registran en `eventos` con responsable, fecha, acción, elemento afectado y motivo. La operación y su registro ocurren en la misma transacción.
9. **Efecto de deshabilitar una cuenta.** Se cierran sus sesiones abiertas; sus datos se conservan.
10. **Registro de eventos.** El administrador puede consultar los eventos del sistema: operaciones administrativas, accesos fallidos y tramas rechazadas.

## 5. Requerimientos no funcionales

Cómo se verifican en un entorno local:

| ID | Requisito | Criterio verificable en el prototipo |
|---|---|---|
| RNF01 | Rendimiento | El panel de estado y el historial de 1 año responden en menos de 3 s (p95), con una base cargada con 4 años de datos de 48 sensores cada 15 minutos. |
| RNF02 | Seguridad | Contraseñas con hash scrypt. Sesión verificada en cada operación. Aislamiento entre cuentas. Cookies HttpOnly y SameSite. Ningún secreto en el código. |
| RNF03 | Usabilidad | Unidad junto a cada valor. Estados con color, ícono y texto. Indicación explícita de "sin datos recientes". Textos en español simple. Áreas táctiles de al menos 44 px. Texto base de al menos 16 px. |
| RNF04 | Disponibilidad y conservación | Respaldo automático diario con retención de 30 días, y restauración verificada por prueba. Endpoint de salud `/api/salud`. |
| RNF05 | Portabilidad | Funciona en Chromium y WebKit, en escritorio y celular (desde 360 px de ancho), sin instalación. |
| RNF06 | Escalabilidad | Índice único y compuesto (sensor, fecha) en mediciones. Agregación en el servidor. Se cumple RNF01 con el volumen proyectado. |

## 6. Pantallas

Rutas en español. La barra lateral muestra solo lo permitido al rol.

| Pantalla | Ruta | Rol | RF | Contenido |
|---|---|---|---|---|
| Inicio de sesión | `/login` | público | RF01 | Correo, contraseña, "Mantener sesión iniciada", enlace para recuperar contraseña. |
| Restablecer contraseña | `/restablecer?token=` | público | RF01 | Nueva contraseña y su confirmación. Sirve también para definir la primera contraseña. |
| Panel de estado | `/` | PRODUCTOR | RF04 | Selector de terreno, variables por estación, estado de estaciones, alertas recientes. |
| Historial | `/historial` | PRODUCTOR | RF05 | Filtros, gráfico, comparación de periodos, exportar CSV. |
| Alertas | `/alertas` | PRODUCTOR | RF06 | Configuración de criterios y lista de alertas. |
| Ajustes | `/ajustes` | ambos | RF01, RF02 | Pestañas: Perfil, Seguridad (cambio de contraseña) y, solo para el productor, Terrenos y estaciones. |
| Administración | `/admin` | ADMINISTRADOR | RF07 | Cuentas, detalle de cuenta, eventos. |
| No encontrada | `*` | — | — | Mensaje y enlace al inicio. |

Los mockups de `docs/mockups/` son referencia visual. Donde contradicen este documento, manda este documento. Por ejemplo, el panel del mockup muestra pH, que está fuera de alcance, y NPK como un solo valor, cuando son tres sensores.

## 7. Trazabilidad

| RF | HU | CU | Pruebas de la tesis (cap. 9) |
|---|---|---|---|
| RF01 | HU01 | CU01 | P-FUN-CU01, P-INT-API, P-SEG-CONTRASENAS, P-SEG-SESION |
| RF02 | HU02 | CU02 | P-FUN-CU02 |
| RF03 | HU03 | CU03 | P-FUN-CU03, P-INT-INGESTA, P-CAR-INGESTA |
| RF04 | HU04 | CU04 | P-FUN-CU04, P-E2E-INGESTA-PANEL |
| RF05 | HU05 | CU05 | P-FUN-CU05, P-E2E-HISTORIAL, P-CAR-HISTORICO |
| RF06 | HU06 | CU06 | P-FUN-CU06, P-INT-NOTIFICACION, P-E2E-DATO-ALERTA |
| RF07 | HU07 | CU07 | P-FUN-CU07 |
| RNF01–06 | — | — | P-CAR-*, P-SEG-*, P-INF-* |

Los IDs de prueba y su equivalencia con las tablas de la tesis están en `diseno.md` §12.
