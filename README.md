# LoRax

Prototipo del proyecto de título «Sistema de Monitoreo Medioambiental con LoRa»
(Universidad Mayor, 2026).

Es una plataforma web que recibe lecturas de sensores de terreno (temperatura,
humedad del aire y del suelo, nitrógeno, fósforo y potasio), las almacena, se
las muestra al productor agrícola y genera alertas por umbral. El hardware y la
red LoRaWAN no son parte del prototipo: un emulador envía las tramas al mismo
endpoint que usaría el servidor de red real.

## Requisitos

- Node.js 22 o superior
- npm

No hace falta Docker ni ningún servicio en la nube: todo corre en tu equipo.

## Instalación

1. Instala las dependencias:

   ```bash
   npm install
   ```

2. Crea el archivo de configuración a partir del ejemplo:

   ```bash
   cp .env.example .env
   ```

   Completa en `.env` los dos valores que vienen vacíos, `JWT_SECRET` e
   `INGESTA_API_KEY`, con un texto aleatorio distinto para cada uno. Puedes
   generarlos con:

   ```bash
   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
   ```

   Si falta `JWT_SECRET`, nadie puede iniciar sesión: la pantalla muestra
   «Ocurrió un problema en el servidor» y la terminal, «Falta JWT_SECRET en .env».
   Si falta `INGESTA_API_KEY`, la aplicación rechaza todas las tramas y el
   emulador no arranca.

3. Crea la base de datos con los datos de demostración:

   ```bash
   npm run db:reiniciar
   ```

4. Inicia la aplicación y ábrela en <http://localhost:3000>:

   ```bash
   npm run dev
   ```

## Cuentas de demostración

Todas usan la contraseña **`LoraxDemo2026!`**. Son datos ficticios.

| Cuenta | Rol | Para qué sirve |
|---|---|---|
| `admin@lorax.local` | Administrador | Módulo de administración. |
| `maria.gonzalez@lorax.local` | Productora | Parcela Los Castaños (EST-0001 a EST-0004): una alerta vigente de humedad del suelo, una estación sin datos recientes y alertas resueltas. |
| `jose.munoz@lorax.local` | Productor | Dos terrenos: Huerto San Nicolás y Potrero El Alba. |
| `ana.soto@lorax.local` | Productora | Sin terrenos, para ver el estado vacío. |
| `pedro.rojas@lorax.local` | Productor | Cuenta deshabilitada: no puede entrar. |

### Mantener los datos al día

La semilla carga 30 días de mediciones que terminan en la hora en que se
ejecuta. Pasados 30 minutos sin datos nuevos, el panel muestra las estaciones
como «sin datos recientes». Hay tres formas de refrescarlos:

- `npm run db:al-dia` completa las mediciones hasta ahora, sin reiniciar la base
  y con el servidor encendido. Conserva las situaciones preparadas: EST-0003
  sigue sin reportar y la humedad del suelo de EST-0001 sigue bajo el umbral.
- `npm run emulador`, en otra terminal, envía una ronda de tramas cada 15
  minutos, como lo haría la red real. Usa el escenario `normal`, así que
  resuelve la alerta de EST-0001 y EST-0003 vuelve a reportar.
- `npm run db:reiniciar` (con la aplicación detenida) vuelve todo al estado
  inicial, incluidas las contraseñas y lo que hayas creado.

## Cómo demostrar cada caso de uso

Los pasos parten de una base recién creada (`npm run db:reiniciar`) y de la
aplicación en marcha (`npm run dev`). Para los pasos con el emulador, abre otra
terminal en la carpeta del proyecto.

Cada escenario del emulador envía una ronda a las 8 estaciones. El siguiente
escenario devuelve a la normalidad lo que alteró el anterior: por ejemplo,
`helada` después de `sequia` resuelve la alerta de humedad del suelo. Al
iniciar, cada escenario imprime qué debería verse en la interfaz.

Los correos no se envían de verdad: se ven en la bandeja de desarrollo,
<http://localhost:3000/dev/correos>, que no pide sesión. Los SMS y mensajes de
WhatsApp simulados quedan en `data/mensajes/`.

### CU01 · Iniciar sesión y recuperar la contraseña

1. Entra como `maria.gonzalez@lorax.local`: llegas al **Panel**. Cierra sesión y
   entra como `admin@lorax.local`: llegas a **Administración**.
2. Deja los campos vacíos o escribe un correo sin `@` y pulsa «Iniciar sesión».
   El formulario marca el error sin enviar nada.
3. Escribe una contraseña incorrecta: aparece «El correo o la contraseña no son
   correctos», igual exista o no el correo, y el correo se conserva.
4. Entra como `pedro.rojas@lorax.local`: aparece «Tu cuenta no está disponible».
5. Marca «Mantener sesión iniciada» para que la sesión dure 30 días; si no la
   marcas, dura 8 horas.
6. **Recuperación.** Pulsa «¿Olvidaste tu contraseña?», escribe
   `ana.soto@lorax.local` y pulsa «Enviar enlace».
   1. Abre la bandeja `/dev/correos` y sigue el enlace del correo.
   2. Escribe la contraseña nueva en «Nueva contraseña» y en «Repite la
      contraseña», y pulsa «Guardar contraseña».
   3. Vuelves al inicio de sesión con el aviso «Tu contraseña se actualizó.
      Inicia sesión con ella.». La contraseña anterior ya no sirve.
7. **Límite de intentos.** Escribe 5 veces seguidas una contraseña incorrecta
   para un mismo correo. El sexto intento responde «Demasiados intentos. Vuelve
   a intentarlo en 15 minutos.», aunque la contraseña sea correcta. Usa un
   correo que no sea de demostración (por ejemplo `prueba@lorax.local`), para
   no bloquear una cuenta que necesites.
8. En **Administración → Eventos** quedan los accesos fallidos.

### CU02 · Registrar terrenos y estaciones

1. Entra como `ana.soto@lorax.local` y abre **Ajustes → Terrenos y
   estaciones**: aparece «Aún no tienes terrenos. Registra el primero.».
2. Pulsa «Registrar terreno».
   - Las coordenadas aceptan coma o punto decimal (`-35,12`).
   - La ubicación de la estación es opcional: si la dejas vacía, se usan las
     coordenadas del terreno.
   - Los 6 sensores vienen marcados; puedes desmarcar los que la estación no
     tenga, pero debe quedar al menos uno.
3. Usa `EST-0001` como número de serie. El error de número de serie repetido
   aparece junto al campo, no se guarda nada y lo que escribiste se conserva.
4. Cambia el número de serie (por ejemplo, `EST-9001`) y vuelve a pulsar
   «Registrar terreno»: aparece «Se registró el terreno…».
5. Con «Agregar estación» se suma otra estación al terreno.
6. En el **Panel**, los sensores de la estación nueva aparecen «Sin lecturas».

### CU03 · Recibir los datos de los sensores

1. Envía una ronda válida:

   ```bash
   npm run emulador -- normal --una-vez
   ```

   Cada estación responde `200 · 6 aceptadas, 0 duplicadas`.
2. Envía tramas que la aplicación debe rechazar, sin guardar nada:

   ```bash
   npm run emulador -- malformada --una-vez           # 400: trama con formato incorrecto
   npm run emulador -- desconocida --una-vez          # 422: estación no registrada
   npm run emulador -- credencial-invalida --una-vez  # 401: llave de acceso inválida
   ```

3. Entra como `admin@lorax.local` y abre **Administración → Eventos**. Cada
   rechazo aparece como «Trama rechazada», con su causa: «Trama con formato
   incorrecto», «Estación no registrada» o «Llave de acceso de la ingesta
   inválida».

### CU04 · Ver el estado del terreno

1. Entra como `maria.gonzalez@lorax.local`. El **Panel** muestra Parcela Los
   Castaños con una tarjeta por variable y estación. Cada tarjeta tiene el
   valor con su unidad, la hora de la lectura, su estado y la curva de las
   últimas 24 horas.
   - La humedad del suelo de EST-0001 aparece «Fuera de rango», con el detalle
     «bajo 25 %».
   - EST-0003 aparece «Sin datos recientes».
   - Las variables sin umbral aparecen «Sin evaluar».
2. En «Alertas recientes», la alerta vigente se puede marcar con «Marcar como
   leída».
3. Ejecuta `npm run emulador -- normal --una-vez`. En menos de un minuto (el
   panel se actualiza solo cada 60 segundos, o al recargar la página):
   - EST-0003 vuelve a «Activa»;
   - la humedad del suelo de EST-0001 pasa a «Normal».
4. Para ver los demás estados:
   - **Sin lecturas:** la estación nueva del CU02.
   - **Deshabilitada:** la estación que deshabilita el administrador en el CU07.
   - **Sin datos recientes en vivo:** deja corriendo
     `npm run emulador -- silencio:EST-0003`. A los 30 minutos, EST-0003 vuelve
     a «Sin datos recientes».
5. Ana, que no tiene terrenos, ve un panel que la invita a registrar uno.

### CU05 · Consultar el historial

1. Entra como `maria.gonzalez@lorax.local` y abre **Historial**.
   - Por defecto muestra los últimos 7 días, con el aviso «Promedios cada 30
     minutos.». Hay una línea por estación.
   - Elige la variable y prueba los atajos. Con «Últimas 24 h» aparece
     «Mediciones cada 15 minutos, sin agregar.»; con «30 días», «Promedios cada
     3 horas.». Los datos de demostración cubren 30 días, así que el atajo
     «1 año» muestra solo ese mes.
2. En «Comparar con», elige «Semana anterior» (u «Otro periodo») y pulsa «Ver
   historial»: el periodo anterior se superpone en el gráfico.
3. Pon en «Desde» una fecha posterior a «Hasta»: aparece «La fecha inicial no
   puede ser posterior a la final.» y no se consulta.
4. Elige un rango sin datos, por ejemplo de 2020: aparece «No hay mediciones en
   este periodo» y los filtros se mantienen.
5. Pulsa «Descargar CSV». El archivo se llama, por ejemplo,
   `historial_parcela-los-castanos_humedad-suelo_<desde>_<hasta>.csv` y se abre
   bien en Excel: separador `;`, coma decimal y fechas en hora de Chile.

### CU06 · Configurar umbrales y recibir alertas

1. Entra como `maria.gonzalez@lorax.local` y abre **Alertas**. En «Nuevo
   umbral», elige el terreno y el sensor. Aparecen la unidad, los valores
   posibles y las últimas lecturas.
2. En «Avisarme cuando el valor», elige «Supera» o «Desciende bajo» y escribe
   el umbral.
   - Un valor fuera del rango del sensor (por ejemplo, 150 para una humedad) se
     marca junto al campo: «Debe estar entre 0 y 100 %.».
   - Si desmarcas todos los canales, aparece «La alerta quedará registrada en la
     plataforma, pero no se te comunicará por ningún medio.». Se puede guardar
     igual.
   - Si borras tu teléfono en **Ajustes → Perfil** y marcas SMS o WhatsApp,
     aparece un aviso que pide agregarlo.
3. Pulsa «Guardar umbral». En «Mis umbrales» puedes deshabilitarlo, habilitarlo
   o eliminarlo.
4. **Alerta en vivo.** Ejecuta en orden:

   ```bash
   npm run emulador -- normal --una-vez   # resuelve la alerta vigente de la semilla
   npm run emulador -- sequia --una-vez   # humedad del suelo de EST-0001 bajo 25 %
   ```

   Después de `sequia`:
   - el panel muestra la humedad del suelo de EST-0001 «Fuera de rango» y una
     alerta vigente nueva;
   - el indicador de **Alertas** en el menú sube en uno;
   - en `/dev/correos` llega «Alerta LoRax: Humedad del suelo bajo el umbral».

   Si repites `sequia`, no se crea otra alerta ni se vuelve a avisar. Con
   `normal`, la alerta pasa a «Resuelta».
5. **Alerta crítica con SMS.** `npm run emulador -- helada --una-vez` crea una
   alerta para José (temperatura del aire de EST-0005 bajo 0 °C), con un correo
   en `/dev/correos` y un SMS simulado en `data/mensajes/`.
6. En **Alertas**, la lista se filtra por terreno y por estado («Vigentes» o
   «Resueltas»).

### CU07 · Administrar cuentas

1. Entra como `admin@lorax.local`. En **Administración → Cuentas** puedes
   buscar por nombre o correo y filtrar por estado.
2. **Registrar un productor.** Pulsa «Registrar productor» y completa sus datos
   con «Empresa nueva».
   1. Escribe un RUT con el dígito verificador incorrecto (por ejemplo,
      `76.111.222-9`): se marca junto al campo. Corrígelo (`76.111.222-8`).
   2. Al guardar aparece «Se creó la cuenta y se envió el enlace de activación
      a…», y la cuenta queda «Pendiente de activación».
   3. En `/dev/correos` llega «Activa tu cuenta en LoRax». Con ese enlace, el
      productor define su contraseña y luego inicia sesión. El administrador
      nunca la conoce.
   4. Si el enlace se pierde, en el detalle de la cuenta está «Reenviar enlace
      de activación».
3. **Operaciones con motivo.** Cada una pide confirmación y un motivo
   obligatorio.
   - Abre el detalle de José y pulsa «Deshabilitar cuenta»: se cierran sus
     sesiones abiertas y ya no puede entrar.
   - En el detalle de María, en la pestaña «Terrenos y estaciones», deshabilita
     EST-0004: deja de aceptar lecturas y conserva su historial.
   - En la pestaña «Umbrales», elimina un umbral.
4. En **Administración → Eventos** aparece cada operación con su responsable y
   su motivo, junto con los accesos fallidos y las tramas rechazadas.
5. El administrador no tiene ninguna opción sobre las mediciones. Si una
   productora abre `/admin`, vuelve a su panel.

## Pruebas y evidencia

| Comando | Qué hace |
|---|---|
| `npm test` | Pruebas unitarias y de integración con Vitest, sobre bases en memoria. |
| `npm run test:e2e` | Pruebas de extremo a extremo con Playwright, en Chromium y WebKit, en escritorio y celular. Usan su propia base (`data/e2e/`) y su propio servidor (puerto 3100): no tocan `data/lorax.db`. |
| `npm run test:infra` | Prueba de despliegue: compila la versión de producción, la inicia y consulta `/api/salud` (alrededor de un minuto). |
| `npm run historico -- --anios 4` | Crea la base de las pruebas de carga en `data/carga/lorax.db` (unos 2,4 GB, menos de un minuto). No toca la base de la aplicación. |
| `npm run test:carga` | Pruebas de carga sobre esa base y la versión de producción. Deja el informe en `evidencia/carga.md`. |
| `npm run evidencia` | Ejecuta `npm test`, `npm run test:infra` y `npm run test:e2e` (unos 3 minutos) y escribe `evidencia/informe.md`, con el resultado de cada prueba del capítulo 9 de la tesis. Toma la carga de `evidencia/carga.json`, sin volver a ejecutarla. |
| `npm run capturas` | Toma las 12 capturas de la tesis (6 pantallas, en escritorio y celular) en `evidencia/capturas/`, sobre su propia base recién sembrada (`data/capturas/`) y su propio servidor (puerto 3200). Tarda menos de un minuto. |

Para las pruebas de extremo a extremo, Playwright necesita sus navegadores:
`npx playwright install`. En NixOS se usa el paquete
`playwright-driver.browsers`, con `PLAYWRIGHT_BROWSERS_PATH` apuntando a él y
`PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=true`. Por eso `@playwright/test`
está fijado en la misma versión que trae nixpkgs (1.59.1); si nixpkgs se
actualiza, hay que subir ambas versiones a la vez.

## Comandos disponibles

| Comando | Qué hace |
|---|---|
| `npm run dev` | Inicia la aplicación en modo desarrollo. |
| `npm run build` / `npm start` | Compila y ejecuta la versión de producción. |
| `npm run typecheck` | Revisa los tipos de TypeScript. |
| `npm run db:migrar` | Aplica las migraciones pendientes a `data/lorax.db`. |
| `npm run db:reiniciar` | Borra la base, la migra y carga los datos de demostración (con la app detenida). |
| `npm run db:semilla` | Carga los datos de demostración en una base vacía. |
| `npm run db:al-dia` | Completa las mediciones de demostración hasta ahora, sin reiniciar la base y con el servidor encendido. |
| `npm run db:generar` | Genera una migración nueva tras cambiar `src/server/db/esquema.ts`. |
| `npm run restaurar <archivo>` | Restaura un respaldo de `respaldos/` (con la app detenida) y verifica los conteos de cada tabla. |
| `npm run emulador -- [escenario] [--una-vez]` | Envía tramas simuladas a la aplicación en ejecución, cada 15 minutos o una sola vez. Escenarios: `normal`, `sequia`, `helada`, `silencio:EST-0003`, `malformada`, `desconocida` y `credencial-invalida`. |

Los comandos de pruebas están en [Pruebas y evidencia](#pruebas-y-evidencia).

## Operación

### Respaldos

Con la aplicación encendida se crea un respaldo por día en `respaldos/lorax-<fecha>.db`
(carpeta configurable con `RESPALDOS_DIR`) y se conservan los últimos 30 días. Para volver
a uno, detén la aplicación y ejecuta `npm run restaurar respaldos/lorax-2026-10-07.db`:
antes de reemplazar la base guarda una copia de la actual en
`respaldos/antes-de-restaurar-<fecha y hora>.db`, y al terminar compara los conteos de
cada tabla. `/api/salud` informa la fecha del último respaldo y las notificaciones pendientes.

### Probar los reintentos de notificaciones

Con `NOTIF_SIMULAR_FALLO=CORREO` (o `SMS`, `WHATSAPP`, separados por comas) en
`.env`, esos canales fallan a propósito. Cada 60 segundos la aplicación reintenta
los envíos fallidos, con esperas de 1, 2, 4 y 8 minutos, hasta 5 intentos; cada
intento queda en Administración → Eventos. Para el uso normal, déjalo vacío.

## Limitaciones conocidas

Son aceptables en un prototipo; el detalle está en [diseno.md §11](docs/spec/diseno.md).

- **`'unsafe-inline'` en la política de seguridad de contenido (CSP).** SolidStart
  inserta en cada página un script en línea que la activa en el navegador, y los
  componentes usan estilos en línea. Por eso la CSP permite scripts y estilos en
  línea, y no impediría la ejecución de un script en línea inyectado. El resto de
  la política es restrictiva (`default-src 'self'`, `object-src 'none'`,
  `base-uri 'self'`, `frame-ancestors 'none'`). Quitarlo exige nonces en el
  renderizado del servidor.
- **Bloqueo por correo.** Tras 5 intentos fallidos en 15 minutos, el inicio de
  sesión con ese correo se bloquea durante 15 minutos. Un tercero que conozca el
  correo de un productor puede bloquear así su acceso temporalmente. Contar los
  intentos también por dirección IP lo mitigaría.
- **Ejecución local.** El prototipo corre en `localhost` por HTTP, con SQLite.
  El diseño objetivo de la tesis usa PostgreSQL y un despliegue en la nube con
  HTTPS; con `APP_URL` en https, la cookie de sesión lleva `Secure` y las
  respuestas incluyen HSTS.

## Documentación

- [Requisitos](docs/spec/requisitos.md)
- [Diseño técnico](docs/spec/diseno.md)
- [Plan de tareas](docs/spec/tareas.md)
- [Informe de evidencia](evidencia/informe.md) y [pruebas de carga](evidencia/carga.md)
- Mockups de referencia en [docs/mockups/](docs/mockups/)
