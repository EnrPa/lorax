# Diseño técnico del prototipo

Complementa a `requisitos.md` y describe cómo se construye. Los cambios a las secciones 4, 6 o 7 requieren aprobación, porque afectan a la tesis.

## 1. Prioridad y decisiones

**Prioridad: pantallas funcionales primero.** Cada pantalla se construye sobre la API y la base de datos reales, alimentada por datos piloto que muestran todos sus estados. No se usan datos simulados en la interfaz. Lo que no se ve (reintentos con espera, respaldos, pruebas de carga, límites de intentos) se agrupa en la fase de endurecimiento (§11). Esas funciones quedan documentadas ahí y no se implementan antes.

| ID | Decisión |
|---|---|
| D1 | Una sola aplicación SolidStart: páginas, API REST (`/api/v1`) e ingesta, sobre Node.js ≥ 22 y TypeScript. |
| D2 | SQLite con Drizzle ORM (driver `better-sqlite3`), en el archivo `data/lorax.db` y en modo WAL. Migraciones con `drizzle-kit`. La tesis mantiene PostgreSQL como diseño objetivo; el esquema es equivalente (§4). |
| D3 | Sesión con JWT (HS256, `jose`) en una cookie HttpOnly. La tabla `sesiones` guarda el hash del token para poder revocarlo. |
| D4 | Contraseñas con `scrypt` de `node:crypto`. Validación con Zod, con esquemas compartidos en `src/lib/`. |
| D5 | Chart.js sin adaptadores de fecha: eje lineal en milisegundos y etiquetas con `Intl.DateTimeFormat('es-CL')`. |
| D6 | Notificaciones: la plataforma y el correo son reales. El correo se escribe en `data/correos/` y se ve en `/dev/correos`. SMS y WhatsApp son simulados y quedan en `data/mensajes/`. |
| D7 | Fechas guardadas como enteros en UTC (milisegundos) y mostradas en America/Santiago. |
| D8 | npm como único gestor de paquetes (el `pnpm-lock.yaml` era un residuo de la plantilla de SolidStart). |

Si `better-sqlite3` no se instala en el equipo (falta un binario precompilado), se usa `@libsql/client` con un archivo local. Drizzle soporta ambos; el cambio se reporta.

## 2. Arquitectura

```
 Emulador ──POST /api/v1/ingesta──┐        ┌── Navegador (productor / administrador)
                                  ▼        ▼
 ┌──────────────── Aplicación SolidStart (Node.js) ────────────────┐
 │ middleware · páginas (src/routes) · API REST (src/routes/api)   │
 │ src/server: auth · servicios · ingesta · alertas · notificaciones│
 │                 Drizzle ──► SQLite (data/lorax.db)               │
 └──────────────────────────────────────────────────────────────────┘
      canales: plataforma · correo (archivo) · SMS/WhatsApp simulados
```

La conexión a SQLite es un singleton guardado en `globalThis`, para que sobreviva a la recarga en caliente.

## 3. Estructura de carpetas

Se extiende el prototipo existente; no se recrea.

```
src/
  app.tsx, routes.ts, middleware.ts, entry-*.tsx   (existentes)
  routes/        páginas registradas en routes.ts
  routes/api/    endpoints REST
  components/    Forms.tsx y Sidebar.tsx (existentes) + ui/
  contexts/      session.tsx (se reescribe: consulta /api/v1/auth/sesion)
  core/          form.ts (existente), api.ts (cliente fetch tipado)
  lib/           esquemas zod, catálogo de variables, formato de unidades y fechas
  server/        SOLO servidor: db/, auth/, servicios/, ingesta/, notificaciones/
  styles/        Forms.css (existente), tokens.css
scripts/         datos-piloto.ts, semilla.ts, emulador.ts, capturas.ts
tests/           integracion/, e2e/
data/            (en .gitignore)
```

Si el enrutador por archivos de SolidStart choca con el registro manual de páginas, se permite mover las páginas a `src/pages/` y dejar `src/routes/` solo para la API.

**Carga de datos en las páginas (regla general).** Las páginas consultan la API solo desde el navegador (`onMount` o un recurso que no se ejecute en el servidor). El servidor renderiza la estructura de la página con un estado de carga («Cargando…»). Así, las páginas nunca llaman a la API durante el renderizado en el servidor, donde no hay una URL base ni la cookie del navegador. Se aplica a todas las pantallas. La única excepción es la cuenta de la sesión, que el middleware ya validó y el contexto de sesión toma del servidor para no mostrar un menú vacío.

## 4. Modelo de datos

Son las mismas entidades y campos de la sección 7.4.1 de la tesis (versión corregida). Estas son las equivalencias de tipos en SQLite:

| Tesis (PostgreSQL) | Prototipo (SQLite + Drizzle) |
|---|---|
| INT / BIGINT, identificadores | `integer` autoincremental |
| NUMERIC | `real` |
| VARCHAR / TEXT | `text` (el largo se valida con Zod) |
| BOOL | `integer` en modo boolean |
| TIMESTAMP | `integer` en modo `timestamp_ms` |
| JSONB (`payload`, `detalle`) | `text` en modo json |
| GEOGRAPHY (punto) | dos columnas: `latitud` y `longitud` (`real`) |
| POLYGON (`dimensiones`) | `text` con GeoJSON, nulo; no se usa en la interfaz |

**Tablas:** empresas, clientes, cuentas, sesiones, tokens_recuperacion, terrenos, estaciones, sensores, mediciones, criterios, alertas, notificaciones y eventos.

**Campos por tabla.** Todas tienen `id` entero autoincremental. Los campos son no nulos salvo que se indique «nulo». Las fechas son enteros en milisegundos UTC (D7).

- **empresas:** `nombre` (hasta 50), `rut` (hasta 12, con dígito verificador válido, módulo 11). El RUT se guarda normalizado: sin puntos, con guion y con el dígito verificador en mayúscula (`12345678-K`); la interfaz lo muestra con puntos (`12.345.678-K`).
- **clientes:** `cargo` (hasta 50, nulo), `empresa_id` → empresas, `cuenta_id` → cuentas.
- **cuentas:**
  - `correo` (hasta 255), `nombre` y `apellido` (hasta 255);
  - `telefono` (hasta 20, formato E.164 `+569…`, nulo);
  - `contrasena_hash` (nulo mientras la cuenta no se activa);
  - `rol`, `habilitada`.
  - **Pendiente de activación:** estado derivado, no es una columna. Una cuenta con `contrasena_hash` nulo está pendiente de activación: no puede iniciar sesión (§8.4) y el administrador puede reenviarle el enlace (§7).
- **sesiones:** `cuenta_id` → cuentas, `token_hash` (SHA-256 del JWT), `fecha_creacion`, `fecha_expiracion`.
- **tokens_recuperacion:** `cuenta_id` → cuentas, `token_hash` (SHA-256 del enlace), `fecha_creacion`, `fecha_expiracion`, `utilizado`. Se usa para la recuperación de contraseña y para la activación de cuentas nuevas.
- **terrenos:**
  - `cliente_id` → clientes, `nombre` (hasta 100);
  - `latitud`, `longitud`;
  - `superficie` en hectáreas (nulo), `dimensiones` (nulo), `tipo_cultivo` (hasta 256, nulo);
  - `fecha_ultima_actualizacion`.
- **estaciones:**
  - `terreno_id` → terrenos;
  - `tipo`, `modelo` y `numero_serie` (hasta 255);
  - `latitud`, `longitud`: no nulas; si el formulario no las trae, el servidor usa las del terreno;
  - `habilitada`, `fecha_creacion`, `fecha_ultima_actualizacion`.
- **sensores:**
  - `estacion_id` → estaciones;
  - `codigo` (hasta 50), `tipo` (del catálogo, §5), `modelo` (hasta 50, nulo), `unidad` (hasta 50);
  - `rango_minimo`, `rango_maximo`, `intervalo_medicion` en segundos;
  - `fecha_creacion`, `fecha_ultima_lectura` (nulo).
- **mediciones:** `sensor_id` → sensores, `valor`, `fecha` (el instante informado en la trama), `payload` (la trama completa), `nota` (hasta 50, nulo).
- **criterios:**
  - `sensor_id` → sensores, `severidad`, `umbral`, `condicion`;
  - `canales`: lista separada por comas de `PLATAFORMA`, `CORREO`, `SMS` y `WHATSAPP`; puede quedar vacía (RF06.3);
  - `habilitado`, `fecha_creacion`, `fecha_eliminacion` (nulo; eliminación lógica).
- **alertas:**
  - `medicion_id` → mediciones, `criterio_id` → criterios;
  - `nombre`, `tipo` (hasta 256), `mensaje`, `descripcion` (nulo);
  - `estado`, `leida`, `fecha`, `fecha_resolucion` (nulo).
- **notificaciones:** `alerta_id` → alertas, `canal`, `estado` (`PENDIENTE`, `ENVIADA` o `FALLIDA`), `intentos`, `fecha_ultimo_intento` (nulo), `error` (nulo).
- **eventos:**
  - `cuenta_id` → cuentas (nulo; el responsable, o nulo si lo genera el sistema);
  - `tipo`: `OPERACION_ADMINISTRATIVA`, `ACCESO_FALLIDO`, `ACCESO_DENEGADO`, `ORIGEN_RECHAZADO`, `TRAMA_RECHAZADA`, `ERROR_INGESTA` o `ERROR_NOTIFICACION` (la lista se valida en el código; la columna no tiene CHECK);
  - `entidad`, `entidad_id` y `motivo` (nulos);
  - `detalle` (nulo; nunca contiene contraseñas, tokens ni API keys, y las tramas se truncan a 8 KB);
  - `fecha`.

**Restricciones que sí se implementan** (SQLite las soporta):
- **Únicos:**
  - `cuentas.correo`, sin distinguir mayúsculas;
  - `empresas.rut` y `clientes.cuenta_id`;
  - `estaciones.numero_serie`;
  - `sensores (estacion_id, codigo)`;
  - `sesiones.token_hash` y `tokens_recuperacion.token_hash`.
- **`mediciones (sensor_id, fecha)`:** índice único; sirve de índice compuesto y evita duplicados.
- **`alertas (criterio_id)` con `estado = 'VIGENTE'`:** índice único parcial; nunca hay dos alertas vigentes para el mismo criterio.
- **Trigger en `mediciones`:** rechaza UPDATE y DELETE (`RAISE(ABORT)`).
- **CHECK en los valores permitidos:**
  - `rol`: ADMINISTRADOR o PRODUCTOR;
  - `condicion`: SUPERA o DESCIENDE;
  - `severidad`: ADVERTENCIA o CRITICA;
  - `estado` de alertas: VIGENTE o RESUELTA;
  - `estado` y `canal` de notificaciones.
- **Llaves foráneas:** activas (`PRAGMA foreign_keys = ON`).
- **Valores por defecto:** `habilitada` y `habilitado` en true, `leida` en false, `intentos` en 0, `intervalo_medicion` en 900.

**Cadena de propiedad:** terreno → cliente → cuenta. Todo lo que consulta un productor se filtra por la cuenta de su sesión. Un recurso ajeno responde 404. Las cuentas de administrador no tienen cliente.

## 5. Catálogo de variables

Vive en `src/lib/variables.ts`.

| tipo | Etiqueta | Código por defecto | Unidad | Rango admisible |
|---|---|---|---|---|
| `temperatura_aire` | Temperatura del aire | `temp_aire` | °C | −20 a 60 |
| `humedad_aire` | Humedad del aire | `hum_aire` | % | 0 a 100 |
| `humedad_suelo` | Humedad del suelo | `hum_suelo` | % | 0 a 100 |
| `nitrogeno` | Nitrógeno (N) | `n` | mg/kg | 0 a 1999 |
| `fosforo` | Fósforo (P) | `p` | mg/kg | 0 a 1999 |
| `potasio` | Potasio (K) | `k` | mg/kg | 0 a 1999 |

Una estación estándar tiene los 6 sensores, así que el piloto de 8 estaciones suma 48 sensores.

## 6. Contrato de ingesta

`POST /api/v1/ingesta`, con encabezado `X-Api-Key`.

```json
{
  "numero_serie": "EST-0001",
  "fecha": "2026-10-05T14:15:00Z",
  "lecturas": [ { "codigo": "temp_aire", "valor": 14.2 }, { "codigo": "hum_suelo", "valor": 31.5 } ],
  "meta": { "rssi": -97, "bateria": 3.9 }
}
```

La trama se procesa en una sola transacción: todo o nada.

| Caso | Respuesta | Registro |
|---|---|---|
| API key ausente o inválida | 401 | Evento `TRAMA_RECHAZADA`, sin guardar el cuerpo. |
| Estructura inválida: fecha más de 5 min en el futuro, entre 1 y 20 lecturas no cumplido, códigos repetidos o valores no numéricos | 400 | Evento con la trama y la causa. |
| Estación inexistente o deshabilitada, código desconocido o valor fuera del rango admisible | 422 | Evento con la trama y la causa. |
| Válida | 200 `{ aceptadas, duplicadas }` | Guarda cada lectura con la trama como `payload`, actualiza `fecha_ultima_lectura` y evalúa los criterios (§8.2). |
| Error de base de datos | 500 | Evento `ERROR_INGESTA`; nada queda guardado. |

Una lectura repetida (mismo sensor y misma fecha) se omite y se cuenta como duplicada. Las notificaciones se despachan después de confirmar la transacción.

**Lecturas atrasadas.** `fecha_ultima_lectura` conserva siempre la fecha más reciente: una lectura con fecha anterior a la última lectura de su sensor se guarda en el historial y se cuenta como aceptada, pero no cambia `fecha_ultima_lectura` ni se evalúa contra los criterios (§8.2). El panel toma como valor vigente la medición con la fecha más reciente, no la última en llegar.

## 7. API REST

- **Base:** `/api/v1`, con JSON en entrada y salida.
- **Errores:** `{ "error": { "codigo", "mensaje", "campos" } }`, con mensajes en español que dicen cómo corregir.
- **Códigos:**

| Código | HTTP |
|---|---|
| `NO_AUTENTICADO` | 401 |
| `PROHIBIDO` | 403 |
| `NO_ENCONTRADO` | 404 |
| `CONFLICTO` | 409 |
| `VALIDACION` | 400 |
| `NO_PROCESABLE` | 422 |
| `DEMASIADOS_INTENTOS` | 429 |
| `INTERNO` | 500 |

- **Listas:** paginadas con `?pagina&tamano` (por defecto 20).

| Método | Ruta | Acceso | Uso |
|---|---|---|---|
| POST | `/auth/login` | público | `{correo, contrasena, recordar}` → cookie + `{cuenta}` |
| POST | `/auth/logout` | sesión | Revoca la sesión. |
| GET | `/auth/sesion` | sesión | Devuelve `{id, nombre, apellido, correo, rol}`. |
| POST | `/auth/recuperar` | público | Siempre responde 202 con el mismo mensaje. |
| POST | `/auth/restablecer` | público | `{token, contrasena}`. Revoca las sesiones de la cuenta. |
| GET / PATCH | `/cuenta` | sesión | Perfil: solo se editan nombre, apellido y teléfono. |
| POST | `/cuenta/contrasena` | sesión | `{actual, nueva}` |
| GET / POST | `/terrenos` | PRODUCTOR | Listar / crear terreno + estación + sensores en una transacción. |
| GET | `/terrenos/:id` | dueño | Detalle con estaciones y sensores. |
| POST | `/terrenos/:id/estaciones` | dueño | Agregar estación con sensores. |
| GET | `/terrenos/:id/estado` | dueño | Datos del panel (§8.1). |
| GET | `/mediciones/serie` | dueño | `?terrenoId&tipo&desde&hasta[&compararDesde]` (§8.3) |
| GET | `/mediciones/exportar` | dueño | CSV (§8.3). |
| GET | `/sensores/:id/lecturas-recientes` | dueño | Últimas 5 lecturas. |
| GET / POST | `/criterios` | PRODUCTOR | Listar (`?terrenoId`) / crear. |
| PATCH / DELETE | `/criterios/:id` | dueño | Habilitar o deshabilitar / eliminación lógica. |
| GET | `/alertas` | PRODUCTOR | `?terrenoId&estado&noLeidas` |
| PATCH | `/alertas/:id` | dueño | `{leida: true}` |
| GET | `/alertas/no-leidas/cantidad` | PRODUCTOR | Para el indicador del menú. |
| GET / POST | `/admin/cuentas` | ADMINISTRADOR | Listar (`?q&habilitada`) / crear productor y enviar enlace de activación. Cada cuenta del listado trae `pendienteActivacion` (§4). |
| GET / PATCH | `/admin/cuentas/:id` | ADMINISTRADOR | Detalle con terrenos, estaciones, criterios y `pendienteActivacion` / actualizar. |
| POST | `/admin/cuentas/:id/habilitacion` | ADMINISTRADOR | `{habilitada, motivo}`. Al deshabilitar, revoca sesiones. |
| POST | `/admin/cuentas/:id/reenviar-activacion` | ADMINISTRADOR | Marca como utilizados los enlaces anteriores de la cuenta y envía uno nuevo. Solo para cuentas pendientes de activación; si no lo está, responde 409. |
| POST | `/admin/estaciones/:id/deshabilitar` | ADMINISTRADOR | `{motivo}` |
| POST | `/admin/criterios/:id/eliminar` | ADMINISTRADOR | `{motivo}` |
| GET | `/admin/empresas`, `/admin/eventos` | ADMINISTRADOR | Listas de apoyo. |
| POST | `/ingesta` | API key | §6 |
| GET | `/dev/correos` | público, solo en desarrollo | Bandeja de correos escritos a archivo (D6). Responde 404 con `NODE_ENV=production` (§9). |
| GET | `/api/salud` | público | `{ estado, bd, ultimaIngesta, notificaciones: { pendientes, fallidas }, ultimoRespaldo }` (§11). 503 si la base no responde. |

Toda operación administrativa y su evento `OPERACION_ADMINISTRATIVA` van en la misma transacción.

**Reglas de la administración de cuentas**
- **Solo productores:** `/admin/cuentas` lista y gestiona únicamente cuentas de productor. Pedir una cuenta de administrador por `/admin/cuentas/:id` responde 404 (así un administrador tampoco puede deshabilitarse a sí mismo).
- **Datos generales editables** (`PATCH /admin/cuentas/:id`): nombre, apellido, teléfono, correo y cargo. La empresa no se cambia.
  - El correo se normaliza a minúsculas y no puede repetirse (409 junto al campo). Al crear una cuenta también se guarda en minúsculas.
  - Si cambia el correo, se envía un aviso al correo anterior: «El correo de tu cuenta LoRax fue cambiado por el administrador. Si no lo solicitaste, contáctalo.»
  - El evento guarda en `detalle` los campos modificados, con su valor anterior y nuevo.
- **Motivo:** obligatorio al deshabilitar una cuenta o una estación y al eliminar un criterio (RF07.8). Opcional al crear, actualizar, habilitar una cuenta y reenviar la activación. Todas estas operaciones registran su evento.
- **RUT:** se normaliza antes de validar, comparar y guardar (sin puntos, con guion y dígito verificador en mayúscula, §4). Una empresa nueva con un RUT que ya existe responde 409 junto al campo: «Ya existe una empresa con ese RUT. Elígela de la lista de empresas existentes».

## 8. Reglas de negocio

### 8.1 Estado del terreno

Se calcula en el servidor para cada sensor:

| Condición | Estado |
|---|---|
| Nunca ha reportado | `SIN_LECTURAS` |
| Última lectura con más de 2 intervalos de medición | `SIN_DATOS_RECIENTES` |
| Sin criterios activos | `SIN_EVALUAR` |
| Incumple algún criterio activo | `FUERA_DE_RANGO`, con el detalle |
| En otro caso | `NORMAL` |

**Estado de cada estación:** `ACTIVA`, `SIN_DATOS_RECIENTES` o `DESHABILITADA`.

| Condición | Estado |
|---|---|
| La estación no está habilitada | `DESHABILITADA` |
| Ninguno de sus sensores tiene una lectura reciente (el mismo umbral que los sensores: última lectura con 2 intervalos de medición o menos) | `SIN_DATOS_RECIENTES` |
| En otro caso | `ACTIVA` |

**Respuesta del panel:** terreno, estaciones, variables agrupadas por estación (valor, unidad, fecha, estado y serie de 24 h agregada a 30 min) y las 10 alertas más recientes.

### 8.2 Evaluación de criterios

Para cada lectura nueva, se consideran los criterios del sensor habilitados y no eliminados. Solo se evalúan las lecturas con fecha posterior a la última lectura del sensor: una lectura atrasada queda en el historial, pero no crea ni resuelve alertas (§6). Una lectura incumple un criterio si la condición es `SUPERA` y el valor es mayor que el umbral, o si es `DESCIENDE` y el valor es menor.

- **Si la lectura incumple y no existe una alerta `VIGENTE` para ese criterio:**
  - se crea la alerta;
  - el mensaje identifica terreno, estación, variable, valor y umbral, por ejemplo «Humedad del suelo bajo el umbral en Parcela Los Castaños (EST-0001): 18,2 % (umbral 25 %)»;
  - se crea una notificación por cada canal del criterio.
- **Si la lectura cumple y existe una alerta vigente:** pasa a `RESUELTA`, con su fecha de resolución.
- **Si la lectura incumple y ya hay una alerta vigente:** no se hace nada.

**Al eliminar o deshabilitar un criterio** (lo haga el productor o el administrador):
- si tiene una alerta `VIGENTE`, pasa a `RESUELTA` con `fecha_resolucion = ahora`, y en su `descripcion` se anota «Criterio eliminado» o «Criterio deshabilitado», según corresponda;
- esto ocurre en la misma transacción que la operación sobre el criterio;
- si el criterio se vuelve a habilitar, la evaluación sigue con normalidad desde la siguiente lectura (no se evalúa hacia atrás).

### 8.3 Historial y CSV

- **Rango:** semiabierto, `desde <= fecha < hasta`. Si `desde` no es anterior a `hasta`, 400 con el mensaje «La fecha inicial debe ser anterior a la final». El rango máximo es de 1 año, tomado como 366 días para que el atajo «1 año» funcione también en años bisiestos.
- **Fechas del formulario:** campos de día. El rango va desde las 00:00 del día «Desde» hasta las 00:00 del día siguiente a «Hasta», sin incluirlo. Los límites se calculan en America/Santiago con la zona horaria real, incluido el horario de verano. El mismo día en ambos campos es válido; solo es error si «Desde» es posterior a «Hasta» (RF05.2).
- **Atajos** (24 h, 7 días, 30 días y 1 año): fijan instantes exactos, desde ahora menos el periodo hasta ahora.
- **Series:** una por cada estación del terreno que tenga un sensor del tipo pedido.
- **Agregación:**
  - Los puntos de una serie se estiman como la duración del rango dividida por el intervalo de medición, no contando las filas reales, para que huecos en los datos no cambien el intervalo. Si los sensores consultados tienen intervalos distintos, se usa el menor, y todas las series usan el mismo intervalo.
  - Si una serie supera los 500 puntos, se agrupa en el menor intervalo de esta lista que no pase de 500: 30 min, 1 h, 3 h, 6 h, 12 h, 1 día o 1 semana. Los intervalos empiezan en `desde`.
  - Cada punto trae promedio, mínimo y máximo, y la respuesta indica el intervalo usado (nulo si las mediciones van sin agregar).
  - El gráfico dibuja la línea del promedio; el mínimo y el máximo se muestran en el detalle (tooltip) de cada punto.
- **Comparación:** un segundo periodo que empieza en `compararDesde`, con la misma duración y el mismo intervalo, alineado por desfase desde el inicio de cada periodo.
- **CSV:**
  - separador `;`, coma decimal, UTF-8 con BOM, sin agregar, en streaming;
  - columnas: `fecha_hora;terreno;estacion;variable;valor;unidad`;
  - `fecha_hora` en America/Santiago con segundos: `2026-09-26 14:05:00`;
  - los textos que contienen `;`, comillas o saltos de línea van entre comillas;
  - nombre del archivo: `historial_<terreno>_<variable>_<desde>_<hasta>.csv`, con terreno y variable (el tipo del catálogo) en minúsculas, sin tildes y con guiones; por ejemplo `historial_parcela-los-castanos_humedad-suelo_2026-09-01_2026-09-26.csv`. Las fechas son los días de Chile del primer y del último instante incluidos.

### 8.4 Sesiones

- **JWT:** `{ sub, rol, sid }`, válido 8 h o 30 días con «recordar».
- **Cookie:** `lorax_sesion`, con HttpOnly y SameSite=Lax.
- **Verificación en cada petición:**
  - firma y expiración del JWT;
  - que la sesión exista en la tabla con el mismo hash;
  - que la cuenta esté habilitada.
- **Middleware:**
  - sin sesión, redirige a `/login`;
  - un productor que pide `/admin` va a `/`;
  - un administrador que pide una página de productor va a `/admin`.
- **Contraseñas:** entre 12 y 128 caracteres, guardadas como `scrypt$N$r$p$sal$hash` y comparadas en tiempo constante.
- **Límite de intentos (RF01.9):**
  - Cuenta como fallo el login con credenciales inválidas (correo inexistente, contraseña incorrecta o cuenta pendiente de activación) o con una cuenta deshabilitada. Un formulario incompleto (400) no cuenta.
  - Los fallos se cuentan por el correo ingresado, en minúsculas, exista o no la cuenta: así el 429 no revela qué correos están registrados.
  - Cada fallo queda como evento `ACCESO_FALLIDO` con `{ correo, causa }`, nunca con la contraseña. El evento no tiene responsable (`cuenta_id` nulo): el intento puede venir de un tercero.
  - Con 5 fallos dentro de una ventana de 15 minutos, todo intento con ese correo responde 429 `DEMASIADOS_INTENTOS` durante los 15 minutos siguientes al quinto fallo, aunque la contraseña sea correcta. Mensaje: «Demasiados intentos. Vuelve a intentarlo en N minutos.», con el encabezado `Retry-After`.
  - Un intento durante el bloqueo se registra con la causa `INTENTOS_EXCEDIDOS`, pero no cuenta como fallo ni alarga el bloqueo.
  - Un acceso exitoso no reinicia la ventana: con 4 fallos, un acierto y otro fallo dentro de 15 minutos, el correo queda bloqueado.
- **Formularios antes de hidratar** (incidencia 5 de `evidencia/resumen-tesis.md`): ningún formulario envía sus datos por GET ni los deja en la URL, aunque la página no haya hidratado (red lenta o JavaScript que no cargó).
  - `Form` (`src/components/Forms.tsx`) usa siempre `method="post"`.
  - El botón de envío queda deshabilitado hasta que la página hidrata (§9). Sin JavaScript el formulario no se envía, ni con el botón ni con Enter, así que ninguna petición lleva la contraseña.
  - Los formularios siguen enviando sus datos solo a la API, como JSON; no hay cambios en la API.
- **Cuenta pendiente de activación** (`contrasena_hash` nulo): el login responde el mismo error genérico que ante credenciales inválidas, sin revelar que la cuenta existe.
- **Enlaces de recuperación y activación:** 32 bytes aleatorios, de los que se guarda el SHA-256. Vigencia de 1 h para recuperación y 72 h para activación. Son de un solo uso.
  - **Cuenta deshabilitada:** `/auth/recuperar` responde el mismo 202, pero no se le envía el correo.
  - **Un enlace nuevo invalida los anteriores** de la cuenta que no se hayan usado.
  - **Restablecer no inicia sesión:** guarda la contraseña, revoca las sesiones y redirige a `/login` con el aviso «Tu contraseña se actualizó. Inicia sesión con ella.».
  - **Activar funciona igual:** la cuenta nueva define su primera contraseña en la misma página y termina en `/login` con el mismo aviso.

### 8.5 Notificaciones

- **Creación:** la evaluación de una trama (§8.2) crea las notificaciones en estado `PENDIENTE`, dentro de la transacción de la trama.
- **Despacho:** después de confirmar la transacción, el despachador envía las pendientes, una a la vez y en orden. Si el despacho falla, la ingesta igual responde 200: las lecturas ya están guardadas.
- **Tarea periódica:** cada 60 s, el despachador corre también solo: envía las pendientes que hayan quedado (por ejemplo, si el servidor se detuvo justo después de una trama) y los reintentos cuya espera ya pasó. Comparte la fila de despachos con la ingesta, así que nunca hay dos a la vez. Se inicia con la primera petición al servidor (desde el middleware), una sola vez por proceso.
- **Destinatario:** el dueño del terreno (alerta → criterio → sensor → estación → terreno → cliente → cuenta).
- **Canales:**
  - **Plataforma:** la alerta ya aparece en la plataforma, así que la notificación se marca `ENVIADA`.
  - **Correo:** se escribe en `data/correos/` (D6), con el mensaje de la alerta y un enlace a `/alertas`.
  - **SMS y WhatsApp:** simulados, escritos en `data/mensajes/` al teléfono de la cuenta.
- **Cada intento** actualiza `estado`, `intentos`, `fecha_ultimo_intento` y `error`. Si un intento falla, la alerta se conserva y se registra un evento `ERROR_NOTIFICACION` (RF06.9).
- **Fallas permanentes:** no se arreglan reintentando.
  - Hoy, la única es SMS o WhatsApp a una cuenta sin teléfono.
  - La notificación queda `FALLIDA` con el error «La cuenta no tiene teléfono registrado».
  - Se registra un solo evento y no se reintenta.
  - La pantalla de alertas advierte «Agrega tu teléfono en Ajustes para recibir avisos por SMS o WhatsApp» cuando se marca uno de esos canales sin teléfono; el umbral se puede guardar igual.
- **Fallas pasajeras:** cualquier otro error de envío.
  - La notificación queda `FALLIDA` y se reintenta con espera creciente: 1, 2, 4 y 8 minutos después del intento 1, 2, 3 y 4. Son 5 intentos en total; con el quinto se detiene.
  - La espera vale para todo despacho: una trama nueva no adelanta un reintento.
  - Cada intento fallido registra su evento.
  - **`NOTIF_SIMULAR_FALLO`:** lista de canales separada por comas (por ejemplo `CORREO,SMS`) que fallan como falla pasajera, con el error «Falla simulada (NOTIF_SIMULAR_FALLO)», para probar los reintentos. Se lee en cada envío. `PLATAFORMA` no se simula, porque no envía nada.

## 9. Interfaz

**Público:** productores de 50 años o más, con poca experiencia digital, que usan sobre todo el celular.

**Principios**
- **Lenguaje:** español simple, sin jerga («Humedad del suelo», no `hum_suelo»).
- **Botones:** dicen lo que hacen («Guardar umbral»).
- **Errores:** junto al campo, explicando cómo corregir.
- **Estados vacíos:** invitan a actuar.
- **Valores y estados:** siempre con unidad; los estados con color, ícono y texto.
- **Fechas:** relativas y absolutas («hace 12 min · 14:05»).
- **Accesibilidad:** texto base de 18 px, áreas táctiles de al menos 44 px, contraste AA, foco visible y respeto por `prefers-reduced-motion`.

**Diseño visual**
- Identidad «LoRax» de `docs/mockups/`: barra lateral con logo y verde como acento.
- Tokens en `src/styles/tokens.css`: paleta y colores de estado (normal, advertencia, crítico, sin datos, sin evaluar).
- Evitar el kit genérico de tarjetas idénticas con sombra gris. El elemento protagonista es la tarjeta de variable del panel: valor grande con unidad, estado y curva de 24 h. Todo lo demás, sobrio.

**Distribución**
- Barra lateral en escritorio. En pantallas de menos de 768 px, barra superior con menú desplegable.
- Sin barra lateral en `/login`, `/restablecer` y la 404.

**Bandeja de correos (`/dev/correos`)**
- Solo existe en desarrollo y es pública, porque quien recupera su contraseña todavía no tiene sesión (excepción de RF01.8).
- Con `NODE_ENV=production`, tanto la página como su endpoint (`GET /api/v1/dev/correos`) responden 404, con o sin sesión.

**Menú por rol**
- Productor: Panel, Historial, Alertas (con indicador de no leídas) y Ajustes.
- Administrador: Administración y Ajustes.

**Componentes**
- **En `createForm`:** Email, Fecha, opciones excluyentes, error por campo y botón con estado «guardando».
- **Pestañas en pantallas angostas** (`Pestanas`): si no caben en una fila (por ejemplo, a 390 px en Ajustes y en el detalle de cuenta de Administración), pasan a una segunda línea en vez de cortarse o desplazarse en horizontal. El texto de cada pestaña nunca se corta.
- **Botón de envío antes de hidratar** (§8.4): mientras la página no hidrata, el botón de envío (`Submit`) no queda solo deshabilitado: dice «Cargando…», con `aria-busy="true"`, y vuelve a su texto al hidratar. Así se entiende por qué todavía no responde.
- **Campo decimal (`Decimal`, en `createForm`):** lo usan todos los formularios con números con decimales (coordenadas, superficie y, más adelante, el umbral).
  - Acepta coma o punto como separador decimal (`-38,95` o `-38.95`) y convierte el texto a número antes de enviar. La API siempre recibe números.
  - No acepta separador de miles.
  - Si el texto es ambiguo o inválido (por ejemplo `1.234,5` o `12,`), muestra el error «Usa coma o punto solo para los decimales, por ejemplo -38,95».
- **Nuevos:** `InsigniaEstado`, `TarjetaVariable`, `GraficoSerie` (Chart.js, se destruye en `onCleanup`), `SelectorTerreno`, `DialogoConfirmacion` (con motivo), `Aviso`, `EstadoVacio`, `Pestanas`.

## 10. Configuración, datos piloto y scripts

**`.env.example`:** `DB_ARCHIVO=./data/lorax.db`, `JWT_SECRET=`, `SESION_HORAS=8`, `SESION_RECORDAR_DIAS=30`, `APP_URL=http://localhost:3000`, `INGESTA_API_KEY=` y `NOTIF_SIMULAR_FALLO=` (vacío; solo para probar los reintentos, §8.5).

**Datos piloto** (`scripts/datos-piloto.ts`). Están pensados para que cada pantalla muestre todos sus estados en las capturas.

**Cuentas**
- **Administrador:** `admin@lorax.local`.
- **Productora 1:** María González, empresa «Agrícola Los Castaños SpA».
  - Terreno «Parcela Los Castaños», Freire, La Araucanía (−38.95, −72.62). Cultivo: arándanos.
  - Estaciones EST-0001 a EST-0004.
- **Productor 2:** José Muñoz, empresa «Hortalizas Ñuble Ltda.».
  - Terreno «Huerto San Nicolás», San Nicolás, Ñuble (−36.50, −72.21). Estaciones EST-0005 y EST-0006.
  - Terreno «Potrero El Alba», Purranque, Los Lagos (−40.91, −73.16). Estaciones EST-0007 y EST-0008.
- **Productora 3:** Ana Soto, sin terrenos (para el estado vacío).
- **Productor 4:** cuenta deshabilitada.

**Datos**
- 30 días de historia, con 48 sensores cada 15 minutos.
- **Situaciones preparadas en la Parcela Los Castaños:**
  - EST-0001 con humedad del suelo bajo su umbral de 25 %, con una alerta vigente no leída;
  - EST-0003 sin reportar desde hace 3 horas, para mostrar «sin datos recientes»;
  - una alerta resuelta y una leída en el historial de alertas;
  - al menos un sensor sin criterios, para mostrar «sin evaluar».
- Criterios adicionales: temperatura del aire de EST-0005 desciende bajo 0 °C; nitrógeno de EST-0007 desciende bajo 20 mg/kg.
- Unos 10 eventos administrativos y de ingesta de ejemplo.
- **Historia simulada.** La semilla y `db:al-dia` generan historia simulada: crean sus alertas con las reglas de §8.2 y marcan sus notificaciones como `ENVIADA` sin enviarlas (no escriben correos ni mensajes). Por eso, las pruebas `[P-INT-NOTIFICACION]` y `[P-E2E-DATO-ALERTA]` verifican el envío con el despachador real (§8.5), a partir de tramas enviadas al endpoint de ingesta (el correo en `/dev/correos`), y nunca con notificaciones sembradas.
- RUT ficticios con dígito verificador válido.
- Contraseña de demostración común, `LoraxDemo2026!`, documentada en el README.

**Scripts**

| Script | Qué hace |
|---|---|
| `dev`, `build`, `start` | Los de Vinxi. |
| `typecheck` | `tsc --noEmit` |
| `test`, `test:e2e` | Vitest; Playwright con Chromium y WebKit, cada uno en escritorio y en celular (390×844). Las pruebas que modifican datos corren solo en Chromium de escritorio. |
| `test:infra` | Pruebas de infraestructura lentas, aparte de `test`: `[P-INF-DESPLIEGUE]` compila (`build`), inicia la versión de producción y consulta `/api/salud`. |
| `db:migrar`, `db:semilla`, `db:reiniciar` | Migrar, cargar datos piloto, borrar y recrear. |
| `db:al-dia` | Pone al día los datos piloto sin reiniciar la base. Ver abajo. |
| `historico -- --anios N` | Crea la base de las pruebas de carga, aparte de la de la aplicación (§11). |
| `test:carga` | Pruebas de carga `[P-CAR-*]` sobre la base de `historico` y la versión de producción; escriben `evidencia/carga.json` y `evidencia/carga.md`. Fuera del CI. |
| `evidencia` | Ejecuta `test`, `test:infra` y `test:e2e` con sus reporteros JSON (en `evidencia/resultados/`, fuera del repositorio), lee `evidencia/carga.json` sin volver a ejecutar la carga y escribe `evidencia/informe.md`: una fila por prueba de §12 (P-FUN-CU06 en dos filas: configuración y evaluación), con su resultado y el detalle de cada prueba. Termina con error si falla alguna suite o una fila no queda aprobada. |
| `restaurar <archivo>` | Restaura un respaldo, con la aplicación detenida, y verifica los conteos (§11). |
| `capturas` | Toma con Playwright las capturas de la tesis en `evidencia/capturas/` (se versionan): 6 pantallas en escritorio (1280×800) y celular (390×844), 12 PNG nombrados `<pantalla>-<escritorio\|celular>.png`. Reglas: **(1)** base recién sembrada en `data/capturas/`, con servidor propio en el puerto 3200 y claves aleatorias; nunca toca `data/lorax.db`; se pone al día (`db:al-dia`) justo antes de capturar. **(2)** Chromium con locale `es-CL`, zona `America/Santiago`, `deviceScaleFactor` 2 y movimiento reducido; el navegador corre con `LANG=es_CL.UTF-8` para que los campos de fecha usen el formato de Chile. **(3)** Pantallas: inicio de sesión (sin sesión); como María, panel, historial (humedad del suelo, 7 días), alertas (pestaña «Umbrales» con Parcela Los Castaños y el sensor «EST-0001 · Humedad del suelo» elegidos, para que se vean la unidad, el rango y las últimas lecturas; el umbral queda sin llenar; es la figura del CU06) y ajustes (pestaña «Terrenos y estaciones» con el formulario «Registrar terreno» abierto); administración como administrador. **(4)** Página completa en todas, salvo el panel, que se recorta para mostrar la estación EST-0001 entera, con la tarjeta de humedad del suelo fuera de rango: en escritorio, desde arriba (con las alertas recientes) hasta el final de la sección de EST-0001; en celular, desde el encabezado de EST-0001 hasta el final de esa tarjeta. La ventana se agranda siempre al alto del contenido antes de capturar o recortar, para que la barra lateral cubra la imagen entera. |
| `emulador` | Envía tramas a `APP_URL` cada 15 min, o `--una-vez`. Escenarios: `normal`, `sequia`, `helada`, `silencio:EST-0003`, `malformada`, `desconocida`, `credencial-invalida`. Cada uno imprime qué debería verse en la interfaz. |

**`npm run db:al-dia`**
- Completa las mediciones que faltan desde la última lectura de cada sensor hasta ahora, cada 15 minutos, con el mismo generador de la semilla (`scripts/modelo-valores.ts`). Solo afecta a las estaciones de los datos piloto que ya tienen lecturas y están habilitadas.
- Respeta las situaciones preparadas de `scripts/datos-piloto.ts`: EST-0003 no se completa (sigue «sin datos recientes») y la humedad del suelo de EST-0001 se mantiene bajo 25 % (sigue con su alerta vigente).
- Evalúa los criterios de las lecturas nuevas con las reglas de §8.2, igual que la semilla, para que las alertas sigan coincidiendo con los datos.
- Funciona con el servidor encendido: escribe en una sola transacción sobre la base en modo WAL.
- `npm run capturas` lo ejecuta antes de capturar.

**`npm run emulador -- [escenario] [--una-vez]`**
- Hace el papel del servidor de red: envía tramas por HTTP a `APP_URL` con `INGESTA_API_KEY` y no toca la base. Sin escenario usa `normal`; sin `--una-vez`, envía una ronda cada 15 minutos.
- Los valores salen del mismo generador de la semilla (`scripts/modelo-valores.ts`), recorrido 30 días al arrancar. La fecha de cada trama es el instante del envío, como la informaría el servidor de red real (una fecha redondeada coincidiría con la última de la semilla y se contaría como duplicada).
- **`normal`:** las 8 estaciones, lejos de los umbrales del piloto; resuelve la alerta vigente de EST-0001.
- **`sequia`:** la humedad del suelo de EST-0001 bajo 25 %. Con la semilla recién cargada ya hay una alerta vigente y no se duplica: para ver una alerta nueva con su correo, se corre antes `normal`.
- **`helada`:** la temperatura del aire de EST-0005 bajo 0 °C (alerta crítica, correo y SMS simulado).
- **`silencio:<número de serie>`:** todas las estaciones menos esa, que pasa a «sin datos recientes» a los 30 minutos.
- **`malformada`, `desconocida` y `credencial-invalida`:** una trama que el servidor rechaza con 400, 422 o 401, y que queda como evento.
- Cada ronda imprime la respuesta de cada trama, y al iniciar se imprime qué debería verse en la interfaz.

## 11. Endurecimiento (fase final; no implementar antes)

- **Límite de intentos de inicio de sesión:** 5 fallidos en 15 min → 429, con eventos `ACCESO_FALLIDO`. Las reglas están en §8.4.
- **Protección CSRF:** verificación de `Origin` en el middleware, para toda mutación (POST, PUT, PATCH, DELETE) de `/api/*`, que el navegador hace con la cookie de sesión. `/api/v1/ingesta` queda exenta: usa API key, no cookie.
  - Con `Origin`, debe coincidir con el de `APP_URL` o con el de la propia solicitud. Sin `Origin`, se rechaza solo si `Sec-Fetch-Site` es `cross-site`; los clientes que no son navegadores no pueden hacer CSRF.
  - El rechazo responde 403 `PROHIBIDO` y queda como evento `ORIGEN_RECHAZADO` con solo `{ origen, ruta, metodo }`, truncados a 200 caracteres; nunca el cuerpo, las cookies ni los tokens.
- **Encabezados de seguridad** en todas las respuestas: `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`, `Permissions-Policy` (sin cámara, micrófono ni geolocalización), `Cross-Origin-Opener-Policy: same-origin` y, si `APP_URL` usa https, `Strict-Transport-Security`.
  - CSP: `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`, `form-action 'self'`, `img-src 'self' data:`, `connect-src 'self'`, `script-src 'self' 'unsafe-inline'` y `style-src 'self' 'unsafe-inline'`. Solo en desarrollo, `connect-src` agrega `ws://<host de APP_URL>:*` para la recarga en caliente de Vite.
- **Limitaciones conocidas** (aceptables en un prototipo; se informan en el README):
  - **`'unsafe-inline'` en la CSP:** SolidStart inserta en cada página un script en línea que la activa en el navegador, y los componentes usan estilos en línea. Quitarlo exige nonces en el renderizado del servidor. Mientras tanto, la CSP no impide la ejecución de scripts en línea inyectados; el resto de la política sigue siendo restrictiva.
  - **Bloqueo por correo:** un tercero que conozca el correo de un productor puede bloquear su inicio de sesión durante 15 minutos con 5 intentos fallidos. Contarlos también por dirección IP lo mitigaría.
- **Reintentos de notificaciones:** tarea cada 60 s, hasta 5 intentos en total, con esperas de 1, 2, 4 y 8 min entre ellos. `NOTIF_SIMULAR_FALLO` para probarlos. Las reglas están en §8.5.
- **Respaldo:** diario con `VACUUM INTO respaldos/lorax-<fecha>.db`, retención de 30 días. `npm run restaurar <archivo>` con la verificación de conteos.
  - `<fecha>` es el día de Chile (`lorax-2026-10-07.db`): uno por día; si ya existe, no se repite. La carpeta es `RESPALDOS_DIR` (por defecto `./respaldos`, fuera del repositorio).
  - Una tarea revisa al arrancar (con la primera petición, como la de reintentos) y cada hora si falta el respaldo del día. Después de crearlo, borra los `lorax-*.db` de más de 30 días según la fecha del nombre. Un error queda en el log.
  - **Restauración** (con la aplicación detenida): verifica que el respaldo sea una base íntegra (`PRAGMA integrity_check`) y cuenta sus filas por tabla; guarda una copia de la base actual en `respaldos/antes-de-restaurar-<fecha y hora>.db`; reemplaza la base; compara los conteos de la base restaurada con los del respaldo. Si no coinciden, vuelve a la copia y termina con error.
- **Salud:** `/api/salud` completo, con notificaciones pendientes y último respaldo:
  - `notificaciones.pendientes`: las `PENDIENTE` más las `FALLIDA` que aún se reintentarán; `notificaciones.fallidas`: las que ya no se reintentan (falla permanente o tope de intentos).
  - `ultimoRespaldo`: `{ fecha }` del respaldo más reciente, o nulo si no hay.
  - `estado` es `ok` (200) o `error` (503, si la base no responde). La antigüedad del respaldo no cambia el estado.
- **Carga masiva:** `npm run historico -- --anios 4` para las pruebas de carga.
  - Crea una base nueva en `data/carga/lorax.db` (`--archivo` para otra ruta; `--reemplazar` si ya existe). Nunca escribe en la base de la aplicación.
  - Siembra los datos piloto (los últimos 30 días, con sus situaciones preparadas) y agrega la historia anterior de los 48 sensores cada 15 minutos, con el mismo generador y en transacciones por estación y mes. La historia anterior va sin sequías y no incumple los criterios del piloto, por eso no se evalúa; el script lo comprueba e informa el conteo (0).
  - Con 4 años: unos 6,9 millones de mediciones y 2,4 GB, en menos de un minuto.
- **Pruebas de carga** (`npm run test:carga`): sobre una copia de esa base y la versión de producción (`build` + `start`), sin el respaldo diario durante las mediciones.
  - `[P-CAR-HISTORICO]`: panel de estado de los 3 terrenos (30 consultas) e historial de 1 año de las 6 variables (30 consultas); p95 < 3 s. RNF06: las consultas por sensor y rango usan el índice `(sensor_id, fecha)` (`EXPLAIN QUERY PLAN`).
  - `[P-CAR-CONCURRENCIA]`: 20 sesiones simultáneas, 5 rondas de panel, historial de 7 días, historial de 1 año y alertas; cero errores y p95 < 3 s.
  - `[P-CAR-INGESTA]`: 768 tramas (un día de las 8 estaciones), de a 10 en paralelo; cero errores y cero lecturas perdidas.
  - El informe (`evidencia/carga.json` y `evidencia/carga.md`) trae p50, p95 y máximo de cada grupo, el tamaño de la base y el equipo usado.
- **Informe de evidencia:** `npm run evidencia` genera `evidencia/informe.md` (§12).

## 12. Pruebas y evidencia

Cada prueba lleva en su nombre el ID de su fila en el capítulo 9 de la tesis. La columna «Fase» indica cuándo se implementa.

| ID | Fila de la tesis | Qué verifica | Fase |
|---|---|---|---|
| P-FUN-CU01 | Funcionales → CU01 | Login válido e inválido, cuenta deshabilitada, recuperación. | 1 |
| P-FUN-CU02 | Funcionales → CU02 | Número de serie disponible y repetido, sin escrituras parciales. | 2 |
| P-FUN-CU04 | Funcionales → CU04 | Los cinco estados de variable y los tres de estación. | 2 |
| P-FUN-CU05 | Funcionales → CU05 | Rango válido, invertido y vacío; agregación; CSV. | 2 |
| P-FUN-CU06 | Funcionales → CU06 (configuración) | Validación del umbral contra el rango; eliminación lógica. | 2 |
| P-FUN-CU07 | Funcionales → CU07 (fila por agregar a la tesis) | Operaciones con motivo y evento; productor sin acceso a admin. | 3 |
| P-FUN-CU03 | Funcionales → CU03 | Sensor registrado y no registrado. | 5 |
| P-FUN-CU06 | Funcionales → CU06 (evaluación) | Fuera y dentro de rango, sin duplicados, resolución. | 5 |
| P-INT-INGESTA | Integraciones → Ingesta de tramas | Trama válida se persiste; credencial o estructura inválida no. | 5 |
| P-INT-NOTIFICACION | Integraciones → Notificación de alertas | Fuera de rango notifica; dentro no. | 5 |
| P-INT-API | Integraciones → Consumo de la API REST | Sin token o con token vencido: 401 y la interfaz pide iniciar sesión. | 1 |
| P-E2E-INGESTA-PANEL | Integrales → Ingesta a visualización | El emulador envía una trama y el panel la muestra con su estado. | 5 |
| P-E2E-DATO-ALERTA | Integrales → Dato a alerta | Escenario `sequia`: alerta, correo en `/dev/correos` y panel. | 5 |
| P-E2E-HISTORIAL | Integrales → Historial | Serie, comparación y descarga del CSV. | 2 |
| P-SEG-CONTRASENAS | Seguridad → Contraseñas | Formato scrypt; no contiene la contraseña. | 1 |
| P-SEG-SESION | Seguridad → Validez de la sesión | Token válido, vencido, ausente, alterado y revocado. | 1 |
| P-SEG-AISLAMIENTO | (complementaria, RNF02) | Recurso ajeno responde 404; admin responde 403 a un productor. | 2 |
| T6.5 (accesibilidad) | (complementaria, RNF03 y RNF05) | Todas las pantallas, en Chromium y WebKit, escritorio y celular: sin infracciones detectadas por axe-core (WCAG 2.1 A y AA, ninguna regla desactivada) y comprobaciones propias (áreas táctiles de 44 px, texto base de 18 px y ninguno bajo 16 px, estados con ícono y texto, foco visible, sin scroll horizontal a 360 px, `prefers-reduced-motion`). La suite e2e de lectura en los cuatro proyectos es la evidencia de RNF05. | 6 |
| P-SEG-CIFRADO | Seguridad → Cifrado | Documental: no aplica en local (HTTP en localhost). | 6 |
| P-SEG-EXPOSICION-BD | Seguridad → Exposición de la BD | SQLite es un archivo local sin puerto de red. | 6 |
| P-CAR-INGESTA, P-CAR-HISTORICO, P-CAR-CONCURRENCIA | Carga | Cero pérdidas; p95 < 3 s con 4 años de datos; 20 usuarios simultáneos. | 6 |
| P-INF-DESPLIEGUE, P-INF-RESPALDO, P-INF-MONITOREO | Infraestructura | `build` + `start`; respaldo y restauración; `/api/salud` ante una falla. | 6 |

Las pruebas de integración usan una base SQLite en memoria (`:memory:`) nueva por archivo de prueba, con migraciones y una semilla mínima.
