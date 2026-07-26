# Gastorin

Control de gastos **personal** (un solo usuario: Gianmarco) — Vue 3 + Vite + Supabase (Postgres + Auth + Edge Functions) + Vercel. No es una app multiusuario ni regulada; el diseño y las decisiones de esta app se toman con ese criterio (simplicidad de uso personal, no "enterprise").

Diseño visual actual: rediseño **"Caudal"** (sidebar ≥900px / bottom-nav <900px, hero oscuro `#1a1a18`, DM Sans + IBM Plex Mono self-hosted vía `@fontsource`).

## Stack y comandos

```bash
npm run dev        # servidor local (Vite)
npm run build      # vue-tsc -b && vite build — el gate de compilación real
npm run test:run   # vitest run, suite completa
```

- Supabase CLI ya está `link`eado a producción (`npx supabase projects list` confirma `linked: true`). Para SQL directo (migraciones, queries de verificación): `npx supabase db query --linked "SQL..."`. **No usar `npx supabase db push`**: intenta reproducir el historial completo de migraciones y varias (008-011) se aplicaron directo por `db query`, no por `db push`, así que su tabla de tracking no coincide — `db push` queda colgado pidiendo confirmación interactiva. Aplicar migraciones nuevas con `db query` pegando el SQL del archivo.
- No es un proyecto Node con backend propio: toda la lógica de servidor vive en Supabase (RLS + 2 Edge Functions).

## Arquitectura de capas (estricta, no te la saltees)

```
types/*.ts        → espejo de las tablas de Postgres
stores/*.ts        → Pinia, única fuente de verdad en memoria (gastos, ingresos, auth, ui)
composables/use*.ts → única puerta a Supabase; nunca llamar a supabase.from() desde una vista/componente
views/ + components/ → presentacional; leen del store via composables, o son "tontos" (props/emit)
```

- **Nunca** `supabase.from(...)` directo en un `.vue`. Siempre a través de un composable.
- Los composables mutan el store correspondiente (`stores/gastos.ts` tiene `categorias`, `gastos`, `presupuestos`, `borradores`; `stores/ingresos.ts` tiene `ingresos`, `bancos`).
- `stores/ui.ts` es estado transversal de UI (no de dominio): `modalAbierto`, `hojaAccionesAbierta`, `contadorRegistro`.
- **Patrón `cargando`**: nunca un booleano plano si el store recibe cargas concurrentes sin `await` entre ellas (ej. el `onMounted` del Dashboard dispara 4-5 composables en paralelo). Usar un contador (`cargasEnVuelo: number`, getter `cargando = cargasEnVuelo > 0`) — un booleano plano se pisa cuando la carga más rápida termina antes que la más lenta. Mismo criterio para `error`: preservar el primero, no dejar que un segundo fallo concurrente lo sobrescriba en silencio.
- **Vistas con copia LOCAL de datos** (`DashboardView` vía `useDashboard().filas/filasIngresos`, `AppShellLayout` vía su propio `gastosDelMesShell`) **no son reactivas** a cambios del store de otras vistas/modales. El FAB "+ Registrar" vive en `AppShellLayout` (fuera de cualquier vista) y escribe en el store global; para que Dashboard/Proyección se enteren, usan `watch(() => storeUi.contadorRegistro, ...)` — `notificarRegistro()` se llama al confirmar un gasto/ingreso. Si agregas otra vista con copia local de datos que dependa de gastos/ingresos recién creados, suscribite a esa misma señal.

## Convenciones de código

- **Nombres y comentarios en español** (`cargarGastosDelMesShell`, no `loadShellExpenses`).
- Sin comentarios que expliquen QUÉ hace el código (los nombres ya lo dicen); sí comentarios cuando hay una razón no obvia, un supuesto documentado, o una decisión de diseño (ver el propio código: está lleno de estos, son parte del estilo del proyecto).
- Componentes Vue chicos, una responsabilidad; lógica reutilizable en composables, nunca duplicada entre vistas.
- Sin código muerto, sin `console.log` de depuración.
- **Moneda**: PEN y USD **nunca se suman entre sí**. Cualquier agregación (`saldosPorBanco`, `totalesPorCategoria`, `calcularSaldoNetoPorCuenta`, KPIs) calcula cada moneda por separado. `useMoneda.ts` centraliza formateo (`formatearMonto`) y las funciones puras de agregación por moneda.
- **Fechas**: nunca `new Date('YYYY-MM-DD')` ni `.toISOString()` para fechas locales — corrige a UTC y puede mostrar el día siguiente/anterior. Patrón correcto (repetido en varios composables): construir `YYYY-MM-DD` a mano desde `getFullYear()/getMonth()/getDate()` locales.
- **Funciones puras de agregación** viven en el composable de su dominio (`useMoneda.ts`, `useDashboard.ts`, `usePresupuestos.ts`), se exportan sueltas (no solo dentro del factory `use*()`) para poder testearlas aisladas, y casi todas tienen su propio `describe` con casos borde explícitos (montos negativos, arrays vacíos, empates).

## Base de datos (Supabase/Postgres)

- Migraciones en `supabase/migrations/`, numeradas secuencialmente (`001`...`011` a la fecha). Cada archivo lleva un comentario de cabecera explicando el HU/motivo.
- RLS en TODAS las tablas: policy `usuario_id = auth.uid()` (`for all`, salvo `estado_ingesta` que es solo `SELECT` para el usuario — la escribe la Edge Function con service role).
- Patrón para agregar una columna `NOT NULL` a una tabla con filas: **nullable → backfill → `SET NOT NULL`**, nunca en un solo paso (ver `006`, `008`).
- Patrón de "banco/categoría por defecto": sembrar una fila `'No especificado'`/`'Otros ingresos'` por usuario existente antes del backfill (ver `005`, `006`, `008`).
- **Nunca** dropear un constraint por nombre resuelto dinámicamente (`pg_get_constraintdef` + `ILIKE`) — Postgres normaliza el texto del constraint (casts, paréntesis) y el match falla en silencio, dejando el constraint viejo activo (pasó en `007`). Consultar el nombre real primero (`select conname from pg_constraint where conrelid=...`) y hardcodearlo en el `DROP CONSTRAINT IF EXISTS <nombre_exacto>`.
- Tipos enum ya definidos: `moneda_tipo` (`PEN`,`USD`), `origen_gasto` (`manual`,`correo`), `estado_gasto` (`confirmado`,`borrador`,`revision_manual`).
- Tablas clave y su propósito: `categorias` (columna `tipo`: `'gasto'|'ingreso'`, catálogos separados), `bancos`, `gastos`, `ingresos`, `presupuestos`, `estado_ingesta` (última ejecución de la ingesta automática), `metas_ahorro` (una fila por usuario), `reglas_comercio` (sugerencia de categoría por comercio), `ajustes_saldo_cuenta` (historial de "setear saldo" por banco+moneda).

## Edge Functions y automatización

- `supabase/functions/importar-borrador` — recibe datos de un correo bancario interpretado y crea un gasto en estado `borrador`/`revision_manual`. Autenticación por token fijo (`IMPORTAR_BORRADOR_TOKEN`, no JWT de usuario), `usuario_id` fijo en servidor. Resuelve `banco_id`/`categoria_id` con fallback (id explícito → nombre case-insensitive → `'No especificado'`/`'Otros'` → 400 solo si el fallback también falta). Deploy: `npx supabase functions deploy importar-borrador --no-verify-jwt`.
- `supabase/functions/registrar-ejecucion-ingesta` — marca `estado_ingesta.ultima_ejecucion_en`, la llama la tarea programada al final de cada corrida (encuentre o no correos nuevos).
- Tarea programada diaria (`gastorin-ingesta-diaria`, Claude Code scheduled task): revisa Gmail con etiqueta "Banco", interpreta el correo, llama a `importar-borrador`. Ventana de escaneo: últimas 36h (con margen sobre 24h por si una corrida se atrasa). Infiere `banco_nombre` ("BCP"→"BCP", "INTERBANK"/"IBK"→"IBK"). Los permisos Bash de esta tarea en `.claude/settings.local.json` (nivel carpeta padre `Gastorin/`, gitignored) deben ser **wildcard**, no exact-match — el payload cambia cada día y un allow exacto se rompe al día siguiente.

## Rutas actuales (`src/router/index.ts`)

`dashboard` (home), `historial` (texto visible "Egresos"), `ingresos`, `bandeja`, `categorias`, `presupuestos`, `bancos`, `graficos` (stub, `ProximamenteView`), `maestros` (stub, absorberá categorías+bancos a futuro). Guard global redirige a `login` sin sesión.

## Testing

- Vitest + Vue Test Utils. Mock manual de Supabase en `src/lib/__mocks__/supabaseClient.ts` (`crearConstructorConsulta()`, builder encadenable donde cada método es un `vi.fn()` que por defecto devuelve el propio builder — sobreescribir el método terminal de la cadena con `mockResolvedValueOnce`).
- Cuando un `onMounted` dispara varias tablas sin orden garantizado, mockear `fromMock.mockImplementation((tabla) => ...)` por NOMBRE de tabla, no por posición de llamada.
- Todo bug real encontrado por un pase de QA se corrige con un test de regresión en el mismo commit (buscar `regresión` en los nombres de `it(...)` para ver el historial de bugs reales ya corregidos: badge de Bandeja stale, barra de progreso con total negativo, escape de `ilike`, bubbling de teclado, etc.).
- Antes de dar cualquier feature por terminada: `npm run build` (gate de compilación) Y `npm run test:run` (suite completa) en verde — no alcanza con los tests del archivo tocado.

## Flujo de trabajo: personas y orquestadores (Claude Code)

Este proyecto se construye con un set de **skills** (`~/.claude/skills/`, global, no vive en este repo) que simulan un equipo. Se invocan por nombre (`ProductOwner`, `architect`, etc.) o por frase gatillo en español. Dos categorías, no las confundas:

**Personas** (una sola voz, sin subagentes — la coherencia se rompe si se paraleliza):
- **ProductOwner** — OnePage, épicas, HU con Gherkin, casos de prueba.
- **UX** (`ux-designer`) — flujo, jerarquía visual, responsive (mobile-first, breakpoint único de este proyecto: 900px), accesibilidad.
- **Architect** — arquitectura de aplicación, desacoplamiento, modularización por rutas, seguridad de app.
- **Data** (`data-dba`) — modelo de datos, migraciones, índices, RLS de diseño.

**Orquestadores** (despachan subagentes vía la herramienta `Agent`, casi nunca hacen el trabajo ellos mismos):
- **Developer** → `dev-planner` (opus, planea y detecta desviación de arquitectura = GATE 1) → `dev-builder` (sonnet, implementa) → **GATE 2** (`npm run build` debe pasar antes de seguir) → `dev-tester` (sonnet, pruebas unitarias del código nuevo). Política de modelos fija: opus planea, sonnet ejecuta.
- **Demoleitor** → `qa-funcional` / `qa-regresion` / `qa-automatizacion` (QA end-to-end y de regresión, más allá de las pruebas unitarias de `dev-tester`).
- **Auditor** → `auditor-sod` / `auditor-vulnerabilidades` / `auditor-riesgos` / `auditor-cumplimiento` (en paralelo), consolidación con severidad.
- **DevOps** → `deploy-preflight` → `deploy-migraciones` (con backup) → `deploy-release` → `deploy-verify` (con rollback automático si falla el smoke test).

**Secuencia típica para una feature nueva de alcance real** (ej. Épica 12-17 de este proyecto): ProductOwner define HU → UX valida flujo/responsive → Data/Architect resuelven cualquier decisión de modelo o técnica pendiente → Developer construye (pipeline completo) → si el cambio es grande, un pase de QA independiente adicional (Agent `dev-tester` fresco, sin el contexto del builder) antes de dar por cerrado. Para fixes acotados y bien entendidos, saltarse la ceremonia completa y resolver directo es válido — el criterio es el tamaño real del cambio, no seguir el proceso por seguirlo.

**Reglas de oro que ya se rompieron y costaron bugs reales en este proyecto** (no las repitas):
- Un orquestador que hace el trabajo del subagente en vez de despachar.
- Saltarse el GATE 2 (probar código que no compila).
- Un GATE 1 con desviación estructural resuelto en silencio en vez de declararlo.
- Migraciones que solo existen en el chat, nunca como archivo en `supabase/migrations/` (pasó una vez, causó un bug de producción real).

## Contexto del rediseño "Caudal"

4 fases completadas (commits `3bca822`, `f36b3ca` y anteriores en `main`):
1. App Shell (sidebar/bottom-nav) + Dashboard (KPIs, saldo por cuenta, feed).
2. Ingresos/Egresos como tabla con filtros/buscador/categorías propias.
3. Bandeja como panel maestro-detalle, con reglas de comercio y detección de duplicados.
4. Presupuesto con hero de consumo mensual, stats agregadas, desglose semanal, copiar mes anterior.

Pendiente (no empezado): Fase 5 (Gráficos, migrar las tendencias que hoy siguen al final del Dashboard) y Fase 6 (Maestros, absorber Categorías/Bancos).
