# LoRax — Prototipo de monitoreo medioambiental con LoRa

Prototipo del proyecto de título "Sistema de Monitoreo Medioambiental con LoRa"
(Universidad Mayor, 2026). Plataforma web que recibe lecturas de sensores de
terreno (temperatura, humedad del aire y del suelo, nitrógeno, fósforo y
potasio), las almacena, las muestra al productor agrícola y genera alertas por
umbral. El hardware y la red LoRaWAN NO se desarrollan: un emulador envía las
tramas al mismo endpoint que usaría el servidor de red real.

La especificación completa está en:

- @docs/spec/requisitos.md — qué debe hacer el sistema (RF, RNF, pantallas, criterios de aceptación).
- @docs/spec/diseno.md — cómo se construye (decisiones, modelo de datos, API, reglas de negocio).
- @docs/spec/tareas.md — plan de trabajo ordenado. Trabaja SIEMPRE desde aquí.

Las imágenes de referencia de la interfaz están en `docs/mockups/`.

## Stack (no cambiar sin aprobación)

- SolidStart 1.x (Vinxi) como aplicación completa: páginas + API REST + ingesta, sobre Node.js >= 22 y TypeScript estricto.
- Tailwind CSS v4, lucide-solid, Chart.js.
- SQLite con Drizzle ORM (`better-sqlite3`), archivo `data/lorax.db`. La tesis mantiene PostgreSQL como diseño objetivo; el esquema es equivalente.
- Zod para validar toda entrada. `jose` para JWT. `node:crypto` (scrypt) para contraseñas. Correo escrito a archivos (`data/correos/`).
- Vitest (unitarias e integración) y Playwright (extremo a extremo, en Chromium y WebKit), con `@axe-core/playwright` para la auditoría de accesibilidad (solo desarrollo). GitHub Actions para CI.
- Gestor de paquetes: npm (no pnpm ni yarn).

## Comandos

```bash
npm install
npm run db:reiniciar        # borra data/, migra y carga la semilla
npm run dev                 # http://localhost:3000
npm run emulador            # envía tramas simuladas a la app en ejecución
npm run typecheck
npm test                    # Vitest
npm run test:e2e            # Playwright
npm run capturas            # capturas de pantallas para la tesis
```

La lista completa de scripts está en `docs/spec/diseno.md` §10.

## Reglas de trabajo

0. Prioridad: pantallas funcionales sobre la API y los datos reales. Lo de la fase de endurecimiento (`diseno.md` §11) no se implementa antes de su fase.
1. Antes de implementar una tarea, lee su entrada en `tareas.md`, propón un plan y espera aprobación. Implementa una tarea a la vez.
2. Una tarea está terminada solo cuando sus criterios de aceptación se cumplen, `npm run typecheck` y `npm test` pasan, y marcaste su casilla en `tareas.md`.
3. Si el spec es ambiguo o contradice el código existente, PREGUNTA. No inventes requisitos ni "mejoras" fuera del spec.
4. No cambies el modelo de datos, el contrato de ingesta ni la API sin actualizar primero `diseno.md` (y avisar: esos cambios afectan la tesis).
5. No agregues dependencias fuera del stack sin preguntar.
6. Todo nombre de prueba lleva el ID de la prueba de la tesis que respalda, por ejemplo `[P-FUN-CU03]` (ver `diseno.md` §12).

## Convenciones

- Interfaz y mensajes en español de Chile, sin jerga técnica. `<html lang="es">`.
- Nombres del dominio en español y sin tildes en el código (`terreno`, `estacion`, `medicion`, `criterio`), igual que el modelo de datos de la tesis. Rutas de la interfaz en español (`/historial`, `/alertas`, `/ajustes`, `/admin`).
- Código solo de servidor en `src/server/` y nunca importado desde componentes de cliente. Las páginas consumen la API REST (`/api/v1/...`), no acceden a la base de datos.
- Conserva los patrones del prototipo existente: registro de rutas en `src/routes.ts` con su ubicación en la barra lateral, la fábrica de formularios `createForm` (`src/core/form.ts` + `src/components/Forms.tsx`), los estilos con variables CSS y `@apply` en `src/styles/`. Extiéndelos; no los reemplaces.
- Los valores siempre se muestran con su unidad. El estado de una variable nunca se comunica solo con color: color + ícono + texto.

## Prohibiciones

- Nunca modificar ni eliminar filas de `mediciones` (hay un trigger que lo impide; no lo desactives).
- Nunca guardar contraseñas, tokens ni la API key en texto plano, en logs ni en la tabla `eventos`.
- Nunca confiar en la interfaz para autorizar: cada endpoint verifica sesión, rol y propiedad del recurso.
- Nunca escribir secretos en el código: todo va en `.env` (hay un `.env.example`).
