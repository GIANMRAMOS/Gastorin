# Micro-plan — Sidebar sin botones de registro + Tendencia Diaria en Dashboard

## Patrón arquitectónico detectado

Proyecto Vue 3 + `<script setup lang="ts">` + Pinia, con capas bien separadas:

- **Vistas** (`src/views/*.vue`): orquestan estado local de UI (refs `modalAbierto`, filtros) y delegan datos a composables/stores. El patrón de cabecera "+ Nuevo X" ya está establecido idéntico en tres vistas (`CategoriasView`, `HistorialView`, `IngresosView`): `div.cabecera-*` con `<h1>` + `button.boton-primario.boton-nuevo` que llama a `abrirModalAlta()`, y el modal montado con `v-if` **dentro de la propia vista**. El CSS de `.boton-nuevo` es idéntico y visible a cualquier ancho (no está tras `@media`).
- **Composables de dominio** (`src/composables/useDashboard.ts`): exportan **funciones puras** a nivel de módulo (`cargarTendenciaMensual`, `cargarGastoPorCategoria`, `cargarResumenPorMoneda`, `cargarBalancePorMoneda`) + un `useDashboard()` que hace el fetch a Supabase y guarda las filas crudas en un `ref` local. Las funciones puras reciben `(gastos, ...params)` y se testean aisladas.
- **Componentes presentacionales** (`src/components/GraficoTendenciaMensual.vue`): reciben `datos`/`moneda` por props, dibujan con CSS (`height %`), **sin librería de gráficos** (precedente explícito: barra de `TarjetaPresupuesto`).
- **Layout** (`AppShellLayout.vue`): sidebar desktop (≥900px) + bottom-nav móvil + FAB. Hoy el sidebar tiene DOS botones extra (`Registrar gasto` / `Registrar ingreso`, clase `.item-nav-boton`) que abren `ModalGasto`/`ModalIngreso` montados en el propio layout. El FAB móvil abre `HojaAccionesFab`, que también abre esos mismos modales del layout.

**Hallazgo que acota el Cambio 1:** los botones "+ Nuevo gasto" / "+ Nuevo ingreso" en las vistas **ya existen y ya abren su propio modal** (`HistorialView.vue:152`, `IngresosView.vue:52`; el test `IngresosView.spec.ts:91` ya lo verifica). Por tanto la decisión de "quién abre el modal" ya está tomada por el patrón vigente: **la vista abre su propio modal**. El Cambio 1 se reduce a **quitar los dos botones del sidebar** (y su código muerto asociado), sin tocar las vistas ni el FAB móvil.

## Desviación de arquitectura

- ¿Se necesita desviarse? **NO.**
- Ambos cambios encajan en patrones ya existentes:
  - Cambio 1: solo elimina elementos del sidebar; las vistas ya siguen el patrón "+ Nuevo".
  - Cambio 2: nueva función pura análoga a `cargarTendenciaMensual` (mismo módulo, misma firma) + nuevo componente presentacional CSS sin librería (mismo patrón que `GraficoTendenciaMensual`) + nueva sección en `DashboardView` gobernada por el `monedaSeleccionada` ya existente. No cambia el modelo de datos, no toca fetch, no introduce patrón nuevo.
- **No dispara GATE 1.**

### Decisiones de criterio documentadas

1. **Cambio 1 — quién abre el modal:** se mantiene el patrón ya vigente (la vista abre su propio modal). En el layout, tras quitar los botones del sidebar, `ModalGasto`/`ModalIngreso` **siguen montados en el layout** porque el FAB móvil (`HojaAccionesFab`) los sigue usando — esa vía NO se toca. Solo quedan huérfanas las funciones `abrirModalGasto()` (`AppShellLayout.vue:50`) y `abrirModalIngreso()` (`:65`), cuyo único llamador eran los botones borrados: se eliminan como código muerto. El resto (`cerrar*`, `manejarGuardado*`, `elegir*DesdeHoja`, `abrirHoja`) se conserva (lo usa la hoja del FAB).

2. **Cambio 2 — reutilizar vs. crear componente:** `GraficoTendenciaMensual.vue` **NO es genérico**: keyea por `dato.mes`, formatea etiquetas con `etiquetaMes()` que asume prefijo `YYYY-MM`, y es un gráfico de **barras**. La tarea pide un gráfico de **líneas** de 30 puntos diarios (`YYYY-MM-DD`); reusarlo obligaría a 30 barras finas con 30 etiquetas de mes repetidas ("jul jul jul…"), y generalizarlo a líneas cambiaría el diseño de la mensual (que debe seguir siendo barras). Decisión: **crear `GraficoTendenciaDiaria.vue`** (mismo patrón: presentacional, props `datos`/`moneda`, CSS/SVG sin librería). Así no se rompen los tests de la mensual ni se acopla un componente a dos formas de datos.

3. **Cambio 2 — sin fetch nuevo (confirmado):** `useDashboard.cargarDatosDashboard()` hace `gte('fecha', primerDiaDeMesRelativo(5))` = primer día del mes hace 5 meses (p.ej. hoy 2026-07 → `2026-02-01`, ver test `useDashboard.spec.ts:282`). Los últimos 30 días caen holgadamente dentro de esa ventana ya cargada en `filas`. `cargarTendenciaDiaria` es **solo una nueva agregación sobre `filas.value`**, sin tocar el fetch.

## Archivos a crear/modificar

Chunks independientes marcados con [A]/[B] (pueden construirse en paralelo; dentro de [B], `DashboardView.vue` depende de los dos artefactos nuevos).

### Chunk [A] — Cambio 1 (sidebar)
- `src/layouts/AppShellLayout.vue` — **modificar** — quitar del `<nav class="navegacion">` los dos `<button class="item-nav item-nav-boton">` de "Registrar gasto" (líneas ~145-150) y "Registrar ingreso" (~194-199). Eliminar las funciones muertas `abrirModalGasto()` y `abrirModalIngreso()`. Conservar: `ModalGasto`/`ModalIngreso` montados, FAB, `HojaAccionesFab` y todos los handlers `cerrar*`/`manejarGuardado*`/`elegir*DesdeHoja`/`abrirHoja`. Ajustar el comentario de cabecera del componente (líneas 16-23) que menciona "En escritorio, Registrar gasto/Registrar ingreso abren sus modales directamente".
- `src/layouts/__tests__/AppShellLayout.spec.ts` — **modificar** — ver Plan de pruebas.

### Chunk [B] — Cambio 2 (tendencia diaria)
- `src/composables/useDashboard.ts` — **modificar** — nueva función pura exportada `cargarTendenciaDiaria(gastos, moneda, dias = 30)`, análoga a `cargarTendenciaMensual` pero agrupando por día `YYYY-MM-DD`, iterando `dias` días hacia atrás desde hoy (inclusive), devolviendo cada día con `total: 0` si no hay gasto, en orden cronológico ascendente (último = hoy). Añadir helper local `fechaDiaRelativo(diasAtras): string` (aritmética local con `getFullYear/getMonth/getDate` + `padStart`, mismo estilo que `primerDiaDeMesRelativo`, cuidando el cruce de mes/año). Constante `DIAS_VENTANA_TENDENCIA_DIARIA = 30`. NO tocar `cargarDatosDashboard`.
- `src/components/GraficoTendenciaDiaria.vue` — **crear** — presentacional, props `{ datos: Array<{ dia: string; total: number }>, moneda: Moneda }`, gráfico de líneas (SVG `polyline`/`path` sobre un viewBox, o CSS) sin librería. Etiquetas de eje espaciadas para no saturar (p.ej. primer/último día, o cada N días); resaltar el último punto (hoy). Usar `useMoneda().formatearMonto` para el tooltip/`title` del punto, como hace la mensual.
- `src/views/DashboardView.vue` — **modificar** — importar `cargarTendenciaDiaria` y `GraficoTendenciaDiaria`; computed `tendenciaDiaria = computed(() => cargarTendenciaDiaria(filas.value, monedaSeleccionada.value))`; nueva `<section class="seccion-dashboard">` con `<h2>Tendencia diaria</h2>` y el nuevo gráfico, **debajo** de la sección "Tendencia mensual" (después de la línea 130). Reutiliza el `monedaSeleccionada` existente (NO crear otro `ToggleMoneda`).
- `src/composables/__tests__/useDashboard.spec.ts` — **modificar** — añadir describe `cargarTendenciaDiaria`.
- `src/components/__tests__/GraficoTendenciaDiaria.spec.ts` — **crear**.
- `src/views/__tests__/DashboardView.spec.ts` — **modificar** — cobertura de la nueva sección y de que el toggle también gobierna la tendencia diaria.

## Plan de pruebas

### Tests EXISTENTES que rompen y hay que actualizar (Cambio 1)

1. `AppShellLayout.spec.ts` — describe "orden de menú" › test `sidebar de escritorio: orden exacto…` (línea 158): el array esperado incluye `'Registrar gasto'` y `'Registrar ingreso'` y usa el selector `.item-nav, .item-nav-boton`. **Rompe.** Actualizar el array esperado a `['Dashboard','Egresos','Ingresos','Bandeja','Presupuestos','Categorías','Bancos']` (ya no hay `.item-nav-boton` en el sidebar) y ajustar el chequeo de índice: hoy verifica `nav.findAll('.item-nav')[2].href === '/historial'`; con los botones fuera, 'Egresos' pasa a índice 1 → `[1]`. Renombrar el título del test.
2. `AppShellLayout.spec.ts` — describe "fix: bancos/categorías se cargan al montar el shell" › helper `abrirNuevoGasto` (líneas 342-348): clickea el botón `.item-nav-boton` "Registrar gasto" del sidebar, que ya no existe. **Rompe los 3 tests que lo usan** (líneas 350, 377, 402). Reescribir `abrirNuevoGasto` para abrir el modal por la vía que queda: click en `.boton-fab` → en `HojaAccionesFab` emitir/clickear "registrar gasto". Mantiene intacta la intención (verificar que el modal ve bancos/categorías ya cargados en `onMounted`). El test "borde: onMounted pide bancos/categorías exactamente una vez" (línea 415) NO cambia.
3. `AppShellLayout.independiente.spec.ts`: no referencia los botones de registro; **no rompe** (revisado). No tocar.

### Tests NUEVOS — Cambio 1
- `AppShellLayout.spec.ts`: "el sidebar YA NO contiene botones 'Registrar gasto'/'Registrar ingreso'" (`nav.navegacion .item-nav-boton` vacío; ningún texto de registro en `nav.navegacion`).
- `AppShellLayout.spec.ts`: regresión — "el FAB móvil sigue siendo vía de registro" (extender el test del `.boton-fab` de línea 134: al elegir en la hoja, se monta `ModalGasto`/`ModalIngreso`).
- `HistorialView.spec.ts`: **añadir** un test corto "el botón '+ Nuevo gasto' abre `ModalGasto` en modo alta" (hoy el spec solo cubre eliminar; el equivalente para ingresos ya existe en `IngresosView.spec.ts:91`).

### Tests NUEVOS — Cambio 2 (`cargarTendenciaDiaria`)
Usar `vi.useFakeTimers()` + `setSystemTime` como el describe de `cargarTendenciaMensual`.
- Camino feliz: con `setSystemTime` fijo, devuelve exactamente 30 entradas en orden ascendente, la última con `dia` = hoy (`YYYY-MM-DD`), sumando por día en la moneda dada.
- Borde (huecos): un día intermedio sin gasto aparece con `total: 0`, no se salta (mismo criterio que la mensual → sin huecos en el gráfico).
- Borde (moneda): ignora gastos de la otra moneda.
- Borde (fuera de ventana): un gasto de hace 31+ días no entra; un gasto de hoy sí.
- Borde (parámetro `dias`): `cargarTendenciaDiaria(gastos, moneda, 7)` devuelve 7 entradas.
- Borde: `gastos = []` → 30 entradas todas con `total: 0`.
- Cruce de mes/año: fijar hoy p.ej. 2026-01-05 → la ventana incluye días de diciembre 2025 con el `YYYY-MM-DD` correcto, sin desfase de zona horaria.

### Tests NUEVOS — Cambio 2 (`GraficoTendenciaDiaria.vue`)
- Camino feliz: con 30 puntos renderiza 30 elementos/puntos.
- El último punto (hoy) se resalta (clase de destacado); los anteriores no.
- Borde: puntos con `total: 0` se renderizan sin error (posición/altura 0, sin hueco).
- El punto de total máximo alcanza el tope de la escala.

### Tests NUEVOS — Cambio 2 (`DashboardView.spec.ts`)
- Existe la sección "Tendencia diaria" con un `GraficoTendenciaDiaria` debajo de "Tendencia mensual".
- Sigue habiendo **un único** `ToggleMoneda` (`findAllComponents({name:'ToggleMoneda'})` → 1) y al emitir `update:modelValue='USD'` cambian a la vez gasto-por-categoría, tendencia mensual **y tendencia diaria** (`GraficoTendenciaDiaria.props('moneda')` pasa a 'USD').
- Estado sin datos: la tendencia diaria renderiza sin `[role=alert]` (todos los días en 0).
- Ampliar "onMounted dispara cargarCategorias y cargarDatosDashboard": confirmar que la tendencia diaria NO dispara un fetch adicional (mismo número de llamadas a `from`).

## Sugerencias fuera de alcance (NO implementar en este build)
- Extraer un helper compartido de escala/formato de eje si aparece un tercer gráfico (hoy mensual y diaria comparten poco: barras vs. líneas).
- Revisar densidad visual del sidebar desktop tras la limpieza (puramente estético; no bloquea).
