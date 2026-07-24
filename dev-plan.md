# Micro-plan — Listas agrupadas por fecha (Historial/Ingresos) + widget "Últimos movimientos" (Dashboard)

> Sobrescribe un `dev-plan.md` previo (tarea "desglose neto por banco", ya cerrada).

## Patrón arquitectónico detectado

Vue 3 `<script setup lang="ts">` + Pinia + Supabase, con separación de capas muy consistente:

- **Lógica pura de dominio → funciones exportadas a nivel de módulo dentro de un archivo `useX.ts`.** No son "composables reactivos": reciben datos ya cargados y devuelven agregados. Precedentes: `cargarResumenPorMoneda`, `cargarGastoPorCategoria`, `cargarTendenciaMensual`, `cargarTendenciaDiaria`, `cargarBalancePorMoneda` (todas `export function` sueltas en `useDashboard.ts`, fuera de `useDashboard()`), y `calcularAbreviaturas` (exportada desde `useCategorias.ts`, con su propio `calcularAbreviaturas.spec.ts`). `useColorCategoria`/`useMoneda` son composables puros (sin estado ni store).
- **Cada función pura tiene un `.spec.ts` en `src/<capa>/__tests__/`** (Vitest), con casos "camino feliz / borde / mayoría / vacío". Cobertura alta y sistemática.
- **Componentes presentacionales puros** en `src/components/` reciben props ya calculadas y solo formatean/renderizan (`TarjetaResumenMoneda.vue`, `ListaGastoPorCategoria.vue`, `TarjetaBalanceMoneda.vue`), cada uno con su spec. Colores semánticos vía variables CSS `--color-error` (rojo) / `--color-exito` (verde), ya usados en `TarjetaResumenMoneda`.
- **Las vistas** (`src/views/`) orquestan: cargan datos vía composables, derivan `computed`, resuelven nombres contra los stores y pasan props a los componentes. Historial e Ingresos son casi clones estructurales entre sí.
- **Formato de fecha en filas hoy:** crudo — se imprime `gasto.fecha` / `ingreso.fecha` (`YYYY-MM-DD`) tal cual en los metadatos. No existe helper de formateo de fecha todavía.
- **Zona horaria ya resuelta:** `useDashboard.ts` construye fechas con `new Date(anio, mes, dia)` y `getFullYear/getMonth/getDate`, NO `toISOString()`, a propósito, para evitar el desfase a UTC (ver comentario de `fechaDiaRelativo`). El agrupador debe seguir esa convención.
- **Datos ya ordenados desc:** `store.gastos` (`.order` en `cargarGastos`), `store.ingresos` (`cargarIngresos`), y `filas`/`filasIngresos` (`.order('fecha', { ascending: false })`). El agrupador recibe items ya ordenados y NO reordena; el combinador del dashboard sí ordena (mezcla dos fuentes ordenadas por separado).

## Desviación de arquitectura

- ¿Se necesita desviarse? **NO.**
- Todo encaja en patrones ya establecidos:
  - Funciones puras nuevas (`agruparPorFecha`, `etiquetaFecha`, `combinarUltimosMovimientos`) idénticas en forma a las funciones-módulo de `useDashboard.ts`/`useCategorias.ts`.
  - Widget del dashboard = un componente presentacional más, como `ListaGastoPorCategoria`.
  - Agrupado en el template = reestructurar el `v-for` existente (lista plana → grupos), sin tocar filtros, estados vacíos, totalizador ni stores.
- **Sin cambios de modelo de datos, sin nueva ruta, sin nuevo patrón de estado. No dispara GATE 1.**

### Decisiones de ubicación (justificadas)

1. **`agruparPorFecha` + `etiquetaFecha` → nuevo `src/composables/useFechas.ts`** (composable de fechas genérico). NO en `useMoneda.ts` (mal fit: no es dinero), NO en un `useAgrupacionFecha.ts` demasiado específico.
   - Justificación: `etiquetaFecha(fecha)` ("Hoy"/"Ayer"/"20 de julio") es un util de **formateo de fecha reutilizable por sí solo** (podría formatear también el metadato de fecha de cada fila, no solo el encabezado de grupo). Un nombre genérico `useFechas` deja lugar a futuros helpers de fecha sin crear un archivo por función. Sigue el patrón "funciones puras exportadas a nivel de módulo".
2. **`combinarUltimosMovimientos` → dentro de `useDashboard.ts`** (export a nivel de módulo). NO en `useFechas.ts`.
   - Justificación: es lógica **de dominio del Dashboard**: conoce las formas `Gasto`/`Ingreso`, produce el tipo unificado, y opera sobre `filas` + `filasIngresos`, las dos fuentes que `useDashboard` ya combina para el balance (`cargarBalancePorMoneda` ya mezcla gastos+ingresos). Ponerla en el composable de fechas acoplaría un helper genérico a dos tipos de dominio ajenos. El orden desc lo hace ella (mezcla dos arrays), no `agruparPorFecha`.
3. **Tipo unificado `MovimientoUnificado`** (`{ tipo: 'gasto' | 'ingreso'; fecha; monto; descripcion; moneda; id }`) → exportado desde `useDashboard.ts` junto a la función (es su tipo de retorno; no amerita tocar `types/`).
4. **Widget → nuevo presentacional `src/components/UltimosMovimientos.vue`** (prop `movimientos: MovimientoUnificado[]`, renderiza lista + filas, formatea monto/color/fecha internamente vía `useMoneda`+`useFechas`). Sigue el patrón de `ListaGastoPorCategoria`, mantiene `DashboardView` delgado. No hace falta un `FilaMovimiento.vue` aparte: la fila solo se usa aquí.
5. **Link "Ver todos": OMITIDO.** No existe vista combinada de movimientos y el task prohíbe inventar ruta. Widget sin enlace de navegación (decisión explícita).
6. **Posición del widget:** en `DashboardView`, **después de `<section class="seccion-resumen">` (3 tarjetas) y antes de `.selector-moneda-dashboard`**. UX: los totales del mes se leen primero (macro), y "últimos movimientos" es el vistazo rápido inmediato; queda por encima de los gráficos (análisis más profundo). El widget es independiente del `ToggleMoneda` (cada movimiento en su propia moneda), por eso va antes del toggle.

## Archivos a crear/modificar

**Chunk A — Feature 1 (agrupador). Independiente de B/C hasta el paso de vistas.**
- `src/composables/useFechas.ts` — **crear** — exporta a nivel de módulo:
  - `etiquetaFecha(fecha: string): string` → "Hoy" / "Ayer" / fecha larga `es-PE`. Construir `Date` con partes locales (`new Date(anio, mes-1, dia)`) para evitar desfase UTC; calcular "hoy"/"ayer" comparando strings `YYYY-MM-DD` derivados con `getFullYear/getMonth/getDate` (estilo `fechaDiaRelativo` de `useDashboard.ts`). Formato: `Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'long' })`; añadir `year: 'numeric'` solo si el año de la fecha ≠ año actual.
  - `agruparPorFecha<T>(items: T[], obtenerFecha: (item: T) => string): Array<{ etiqueta: string; items: T[] }>` → agrupa consecutivos por día (`fecha.slice(0,10)`), preservando orden de entrada (NO reordena), etiqueta cada grupo con `etiquetaFecha`. Lista vacía → `[]`.
- `src/composables/__tests__/useFechas.spec.ts` — **crear**.

**Chunk B — Feature 2 lógica. Independiente de A.**
- `src/composables/useDashboard.ts` — **modificar** — añadir el tipo `MovimientoUnificado` y la función pura exportada `combinarUltimosMovimientos(gastos: Gasto[], ingresos: Ingreso[], limite = 5): MovimientoUnificado[]` (mapea gasto → `{ tipo:'gasto', fecha, monto: g.monto ?? 0, descripcion: g.descripcion ?? '', moneda, id }`, ingreso → `{ tipo:'ingreso', fecha, monto: i.importe, descripcion: i.concepto, moneda, id }`, concatena, ordena por `fecha` desc con desempate determinista (p. ej. por `id`), `slice(0, limite)`). Gastos confirmados nunca traen `monto`/`moneda` null, pero tipar defensivo.
- `src/composables/__tests__/useDashboard.spec.ts` — **modificar** — nuevo describe para `combinarUltimosMovimientos`.

**Chunk C — Feature 2 UI. Depende de B (tipo + función).**
- `src/components/UltimosMovimientos.vue` — **crear** — presentacional puro. Prop `movimientos: MovimientoUnificado[]`. Por fila: indicador de tipo (icono/emoji o glifo con `aria-label`), `descripcion`, fecha vía `etiquetaFecha`, monto vía `useMoneda.formatearMonto` coloreado — rojo gasto (`--color-error`), verde ingreso (`--color-exito`). Estado vacío propio ("Aún no hay movimientos"). Sin link "Ver todos".
- `src/components/__tests__/UltimosMovimientos.spec.ts` — **crear**.
- `src/views/DashboardView.vue` — **modificar** — importar `combinarUltimosMovimientos`/`MovimientoUnificado` y `UltimosMovimientos.vue`; `computed` `ultimosMovimientos = combinarUltimosMovimientos(filas.value, filasIngresos.value, 5)`; insertar `<section>` con el widget tras `.seccion-resumen`.
- `src/views/__tests__/DashboardView.spec.ts` — **modificar** — verificar render del widget con los últimos 5.

**Chunk D — Feature 1 en vistas. Depende de A. D-Historial y D-Ingresos son chunks independientes entre sí (archivos distintos → paralelizables).**
- `src/views/HistorialView.vue` — **modificar** — `computed` `gruposGastos = agruparPorFecha(gastosFiltrados.value, g => g.fecha)`; en el template, reemplazar la `<ul class="lista-gastos">` plana por un `v-for` de grupos: por grupo, un encabezado (`.encabezado-grupo-fecha` con `grupo.etiqueta`) + una `<ul>` con las filas de `grupo.items` (misma `fila-gasto` actual, sin cambios internos). Conservar intactos: filtros, `resumenGastos`, estados vacíos `sinGastos`/`sinResultadosPorFiltro`, guard `gastosFiltrados.length > 0`. Añadir estilo `.encabezado-grupo-fecha`.
- `src/views/IngresosView.vue` — **modificar** — análogo: `gruposIngresos = agruparPorFecha(ingresosFiltrados.value, i => i.fecha)`; agrupar la `<ul class="lista-ingresos">`. Conservar desglose por banco, nota sin-banco, totalizador y estados vacíos.
- `src/views/__tests__/HistorialView.spec.ts` / `IngresosView.spec.ts` (y sus `.integracion.spec.ts`) — **modificar/revisar** — actualizar asserts que asuman una única `<ul>` plana; añadir asserts de encabezados de grupo; verificar que los tests de integración siguen pasando.

## Plan de pruebas

### `etiquetaFecha` / `agruparPorFecha` (`useFechas.spec.ts`)
Fijar "hoy" con `vi.setSystemTime` (fecha determinista) para que hoy/ayer no dependan del reloj real.
- **etiquetaFecha:**
  - Hoy → "Hoy".
  - Ayer → "Ayer".
  - Ayer cruzando mes (hoy = día 1) → "Ayer" (valida aritmética local, no string).
  - Fecha antigua **mismo año** → "20 de julio" (sin año).
  - Fecha antigua **otro año** → incluye el año (ej. "20 de julio de 2024").
  - Robustez TZ: `'2026-07-20'` NO cae al 19 (Date con partes locales; assert día = 20).
- **agruparPorFecha:**
  - Camino feliz: items de 3 días distintos ya ordenados desc → 3 grupos, etiquetas correctas, mismo orden.
  - Todos el mismo día → 1 grupo con todos.
  - Lista vacía → `[]`.
  - No reordena: agrupa consecutivos tal cual los recibe (asume input ordenado).
  - Genérico: funciona con `obtenerFecha` distinto (gasto.fecha vs ingreso.fecha) y con fechas que traen hora (`slice(0,10)`).

### `combinarUltimosMovimientos` (`useDashboard.spec.ts`)
- Orden correcto: mezcla gastos + ingresos por fecha desc, sin importar array de origen.
- Empate de fecha (gasto e ingreso mismo día): ambos presentes, orden estable/determinista (assert reproducible).
- Límite de 5: con >5 totales devuelve exactamente 5 (los más recientes).
- Menos de 5: devuelve todos.
- Solo gastos (ingresos vacío) → solo gastos ordenados.
- Solo ingresos (gastos vacío) → solo ingresos.
- Ambos vacíos → `[]`.
- Mapeo de campos: `tipo` correcto, `descripcion` = `gasto.descripcion`/`ingreso.concepto`, `monto` = `gasto.monto`/`ingreso.importe`, moneda preservada.

### `UltimosMovimientos.vue` (`UltimosMovimientos.spec.ts`)
- Una fila por movimiento, en el orden recibido (no reordena).
- Gasto → color rojo; ingreso → color verde.
- Monto formateado según su propia moneda (PEN vs USD).
- Fecha vía `etiquetaFecha` ("Hoy"/"Ayer"/larga).
- Indicador de tipo accesible (aria-label o texto).
- Prop vacía → estado vacío, sin filas.
- Sin link "Ver todos".

### Render en las 3 vistas
- **HistorialView:** gastos en 2 días → 2 encabezados de grupo + filas correctas; totalizador y filtros siguen; estados vacíos `sinGastos`/`sinResultadosPorFiltro` intactos.
- **IngresosView:** análogo; además desglose por banco y nota "sin banco" siguen presentes.
- **DashboardView:** widget tras la fila de resumen y antes del toggle; hasta 5 movimientos mezclados; dashboard sin datos → estado vacío del widget.

## Sugerencias fuera de alcance (NO incluidas en este build)
- El metadato de fecha cruda por fila (`· {{ gasto.fecha }}`) queda redundante con el encabezado de grupo; podría quitarse o formatearse con `etiquetaFecha`. Cosmético, no pedido.
- `etiquetaFecha` podría más adelante centralizar TODO el formateo de fecha de la app. Reemplazo global fuera de alcance.
