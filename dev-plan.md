# Micro-plan — Épica 11 (Ingresos) + retrofit "Banco" en Gastos

## Patrón arquitectónico detectado

El proyecto sigue una arquitectura por capas muy consistente que las decisiones de Architect/UX replican al pie de la letra:

- **Vistas** (`src/views/*.vue`): orquestan. Cargan datos en `onMounted` vía composables, mantienen estado de UI local (modales, filtros) con `ref`, leen listas desde el store con `computed`. Máx. ancho 720px, cabecera con botón "+ Nuevo". Gemelos a clonar: `CategoriasView.vue` (catálogo) e `HistorialView.vue` (listado + filtros + modal alta/edición).
- **Composables de dominio** (`src/composables/use*.ts`): ÚNICO punto que habla con Supabase. Cada función hace `store.establecerCargando(true)` / `limpiarError()` en `try/finally`, mapea errores a mensajes en español y escribe el resultado en el store. Devuelven `boolean` de éxito. `useCategorias` ya traduce el código Postgres `23505` (unicidad) a texto claro — patrón exacto a reusar para bancos duplicados (constante `CODIGO_POSTGRES_UNICIDAD = '23505'`).
- **Stores Pinia** (`src/stores/*.ts`): estado + mutaciones síncronas (`establecerX`, `agregarX`, `actualizarX`, `quitarX`, `establecerCargando`, `establecerError`, `limpiarError`). No tocan Supabase. `stores/ui.ts` es transversal (`modalAbierto`) y gobierna el `v-show` del bottom nav.
- **Componentes**: `Modal*.vue` (overlay + cierre por backdrop/Escape/botón; llama `storeUi.abrirModal()`/`cerrarModal()` en `onMounted`/`onUnmounted`) que envuelve un `Formulario*.vue` (validación local en `validarFormulario()`, `errorValidacion` propio, muestra `store.error` como fallback). Presentacionales puros con `v-model`/emit (`ToggleMoneda`, `FiltrosHistorial`, `TarjetaResumenMoneda`).
- **Tipos** (`src/types/gasto.ts`): interfaces espejo de las tablas + tipos `*Input` para payloads editables.
- **Funciones puras de agregación** en `useDashboard.ts` (exportadas sueltas, sin estado): reciben filas y devuelven agregados; la vista resuelve nombres contra el store.

Conclusión: la Épica 11 es una réplica de patrones ya probados. No hay que inventar nada salvo el bottom sheet `HojaAccionesFab.vue` (UX), que reutiliza el patrón de overlay/cierre de `ModalGasto`.

## Desviación de arquitectura

- **¿Se necesita desviarse? NO.**

Ninguna decisión de Architect/UX rompe el patrón existente. Observaciones que NO son desviación estructural (no disparan GATE 1), pero que el builder debe tener presentes:

1. **`banco_id` obligatorio en `Gasto`/`GastoInput`** (migración 006 ya aplicada). Es un cambio del modelo de datos, pero ya está migrado en producción; el frontend solo lo consume. Ripple conocido y acotado: añadir el campo al tipo y al selector del formulario de gasto, y actualizar tests de Épica 2 que afirman el payload exacto (ver Plan de pruebas). Encaja en el patrón; no es un patrón nuevo.
2. **Lectura cross-dominio del catálogo de bancos.** Architect decidió que el estado de bancos vive en `stores/ingresos.ts`. Como el formulario y el historial de GASTOS también necesitan la lista de bancos, leerán ese store/composable (`useBancos`) desde el dominio de gastos. Acoplamiento aceptado por decisión de Architect (bancos es catálogo compartido), no una desviación a resolver aquí. Se documenta para que el builder no lo "arregle" moviéndolo.
3. **`HojaAccionesFab.vue`** es un patrón visual nuevo (bottom sheet), pero se apoya en el mismo mecanismo de overlay/cierre/`storeUi.abrirModal()` ya existente. Contrato importante: debe llamar `storeUi.abrirModal()` al montarse para que el bottom nav se oculte detrás de la hoja (así el test existente del FAB en `AppShellLayout.spec` sigue verde — ver Plan de pruebas).

## Archivos a crear/modificar

### Tipos
- `src/types/ingreso.ts` — crear — `Banco` (id, usuario_id, nombre, created_at), `Ingreso` (id, usuario_id, banco_id, fecha, moneda, importe, concepto, created_at), `IngresoInput` (banco_id, fecha, moneda, importe, concepto). Reusa `Moneda` importado de `./gasto`.
- `src/types/gasto.ts` — modificar — añadir `banco_id: string` a `interface Gasto` y a `interface GastoInput`. (Los borradores de correo ya traen banco_id por el backfill de la migración 006; no se hace nullable.)

### Store
- `src/stores/ingresos.ts` — crear — estado `ingresos: Ingreso[]`, `bancos: Banco[]`, `cargando`, `error`. Mutaciones espejo de `gastos.ts`: `establecerIngresos`, `agregarIngreso`, `establecerBancos`, `agregarBanco`, `establecerCargando`, `establecerError`, `limpiarError`. (Sin editar/eliminar ingreso ni banco: no está en las HU; ver sugerencias fuera de alcance.)

### Composables
- `src/composables/useBancos.ts` — crear — `cargarBancos()` (`select().order('nombre')` → `establecerBancos`) y `crearBanco(nombre)` (insert con `usuario_id` explícito; mapea `23505` → "Ya existe un banco con ese nombre.", otros → "No se pudo crear el banco."). Espejo de `useCategorias` (sin abreviaturas). Escribe en `useIngresosStore`.
- `src/composables/useIngresos.ts` — crear — `cargarIngresos()` (`select().order('fecha', { ascending: false })` → `establecerIngresos`) y `crearIngreso(input: IngresoInput)` (insert con `usuario_id` explícito, `agregarIngreso` al éxito). Espejo de `useGastos`; mensajes "No se pudieron cargar los ingresos." / "No se pudo guardar el ingreso." / reusar "No hay una sesión activa...".
- `src/composables/useDashboard.ts` — modificar — añadir función pura exportada `cargarBalancePorMoneda(gastos: Gasto[], ingresos: Ingreso[], mes: string): Record<Moneda, { ingresos: number; gastos: number; balance: number }>`: filtra ambas colecciones al `YYYY-MM` del mes, agrupa por moneda (PEN/USD por separado, NUNCA mezcla), resta ingresos − gastos. Extender `cargarDatosDashboard()` (o añadir un `filasIngresos` ref con su propio fetch a `ingresos`, misma ventana/patrón que `filas`) para traer ingresos del mes. NO tocar las funciones puras existentes.

### Vistas nuevas + router
- `src/views/BancosView.vue` — crear — clon de `CategoriasView.vue` en versión lista simple (sin agrupación predefinida/personalizada, sin `DialogoConfirmacion`): cabecera "Bancos" + "+ Nuevo banco", `<ul>` de bancos, estado vacío claro, abre `ModalBanco`. `onMounted(cargarBancos)`.
- `src/views/IngresosView.vue` — crear — clon estructural de `HistorialView.vue`: cabecera "Ingresos" + "+ Nuevo ingreso", `onMounted(cargarIngresos + cargarBancos)`, `<ul>` ordenada por fecha desc con banco/moneda/importe/concepto por fila, estado vacío claro cuando no hay ingresos, abre `ModalIngreso`. (HU-11.3; el orden lo garantiza el `.order` del composable.)
- `src/router/index.ts` — modificar — añadir dos rutas hijas del App Shell: `{ path: 'ingresos', name: 'ingresos', component: () => import('@/views/IngresosView.vue') }` y `{ path: 'bancos', name: 'bancos', component: () => import('@/views/BancosView.vue') }`. Sin `meta` (heredan `requiereAuth` del padre).

### Componentes nuevos
- `src/components/ModalBanco.vue` — crear — clon de `ModalCategoria.vue` sin el emit `pedir-desactivar`. Envuelve `FormularioBanco`. Título "Nuevo banco".
- `src/components/FormularioBanco.vue` — crear — clon reducido de `FormularioCategoria.vue`: solo campo nombre, valida no vacío ("Ingresa un nombre para el banco."), `crearBanco`, emite `guardado`/`cerrar`. Muestra `store.error` (incluye el mensaje traducido de duplicado). Sin modo edición/desactivar.
- `src/components/ModalIngreso.vue` — crear — clon de `ModalGasto.vue`. Envuelve `FormularioIngreso`. Título "Nuevo ingreso".
- `src/components/FormularioIngreso.vue` — crear — patrón `FormularioGasto` (alta): fecha (`type=date`), banco (selector desde `useIngresosStore().bancos`), moneda (`ToggleMoneda` + `<select>` oculto), importe (`inputmode=decimal`), concepto (texto). `validarFormulario()`: importe > 0 numérico, banco seleccionado, concepto no vacío, fecha presente, moneda presente — todo bloquea ANTES de llamar al backend (HU-11.2). Si no hay bancos: mensaje "No hay bancos; créalos primero." + botón deshabilitado (patrón "sin categorías").
- `src/components/TarjetaBalanceMoneda.vue` — crear — presentacional puro (props `moneda`, `ingresos`, `gastos`, `balance`). Balance neto formateado con `useMoneda`, coloreado con `--color-primario` (≥0) / `--color-error` (<0), señal visual de signo, y un `router-link` "Ver ingresos" → `{ name: 'ingresos' }` (único acceso a Ingresos en móvil). NO modificar `TarjetaResumenMoneda.vue`.
- `src/components/HojaAccionesFab.vue` — crear — bottom sheet anclado al fondo en móvil. Overlay con cierre por backdrop/Escape (patrón `ModalGasto`); llama `storeUi.abrirModal()`/`cerrarModal()` en mount/unmount. Dos botones ≥44px alto, ≥8px separación: "Registrar gasto" (emit `registrar-gasto`) y "Registrar ingreso" (emit `registrar-ingreso`). Emite `cerrar`.

### Componentes/vistas a modificar (retrofit + wiring)
- `src/components/FormularioGasto.vue` — modificar — añadir selector de **Banco** obligatorio (leído de `useIngresosStore().bancos`, cargado por `useBancos` desde la vista contenedora). `banco_id` inicial `props.gasto?.banco_id ?? ''`. Añadir a `validarFormulario()`: "Selecciona un banco." si vacío (bloquea envío). Incluir `banco_id` en el payload de `crearGasto` y de edición manual (para origen correo, ver decisión abierta abajo).
- `src/components/FiltrosHistorial.vue` — modificar — añadir un `<select>` "Filtrar por banco" (prop `bancos: Banco[]`, prop `bancoId: string`, emit `update:bancoId`), mismo patrón que el select de categoría. Opción "Todos los bancos".
- `src/views/HistorialView.vue` — modificar — `onMounted` también `cargarBancos()`; `bancoFiltro` ref; pasar `bancos`+`v-model:banco-id` a `FiltrosHistorial`; sumar `cumpleBanco` a `gastosFiltrados`; mostrar el nombre del banco en los metadatos de cada fila (helper `nombreBanco` resolviendo `banco_id` contra `useIngresosStore().bancos`).
- `src/layouts/AppShellLayout.vue` — modificar —
  - Desktop (sidebar): añadir botón "Registrar ingreso" debajo de "Registrar gasto" (abre `ModalIngreso` directo). Añadir ítems de navegación "Ingresos" y "Bancos" (ver decisión abajo).
  - Móvil (bottom nav): el FAB "+" abre `HojaAccionesFab` en vez de `ModalGasto`. Las opciones de la hoja abren `ModalGasto`/`ModalIngreso`. NO añadir 6º ícono al bottom nav.
  - Estado: `modalGastoAbierto`, `modalIngresoAbierto`, `hojaAbierta`. Renderizar `<ModalGasto>`, `<ModalIngreso>`, `<HojaAccionesFab>` con sus `v-if`.
- `src/views/DashboardView.vue` — modificar — `onMounted` cargar también ingresos (vía `cargarDatosDashboard` extendido); computar `balancePorMoneda` con `cargarBalancePorMoneda`; añadir a `<section class="seccion-resumen">` dos `<TarjetaBalanceMoneda>` (PEN y USD) junto a las `TarjetaResumenMoneda`. Ajustar el grid (pasa a 4 tarjetas). NO tocar `TarjetaResumenMoneda.vue`.

**Chunks paralelizables** (no se solapan):
- Chunk A (catálogo bancos): `types/ingreso.ts`, `stores/ingresos.ts`, `useBancos.ts`, `BancosView.vue`, `ModalBanco.vue`, `FormularioBanco.vue`, ruta `bancos`.
- Chunk B (ingresos, depende de A): `useIngresos.ts`, `IngresosView.vue`, `ModalIngreso.vue`, `FormularioIngreso.vue`, ruta `ingresos`.
- Chunk C (dashboard balance, depende de A por tipos): `useDashboard.ts`, `TarjetaBalanceMoneda.vue`, `DashboardView.vue`.
- Chunk D (retrofit gastos, depende de A): `types/gasto.ts`, `FormularioGasto.vue`, `FiltrosHistorial.vue`, `HistorialView.vue` + tests afectados.
- Chunk E (shell/UX, depende de B por `ModalIngreso`): `HojaAccionesFab.vue`, `AppShellLayout.vue` + su test.

### Decisión pedida — "Ingresos" en el sidebar de desktop
**SÍ, añadir "Ingresos" como ítem de navegación en el sidebar de desktop.** Motivo: en desktop hay espacio (columna vertical, sin el límite de 5 del bottom nav), Ingresos es una sección de primer nivel equivalente a Historial, y dejar su único acceso desktop dentro de una tarjeta del Dashboard sería inconsistente con el resto de la navegación. Se recomienda añadir también "Bancos" al sidebar por consistencia con "Categorías" (catálogo secundario ya presente en el nav). Recomendación por defecto: incluir ambos ítems (Ingresos y Bancos) en el sidebar, ninguno en el bottom nav.

## Plan de pruebas

Framework: Vitest + @vue/test-utils + mock manual de Supabase (`crearConstructorConsulta`, `from.mockReturnValueOnce`). Mismos idiomas/estructura que los specs existentes.

### HU-11.1 — Catálogo de bancos (`useBancos.spec.ts` nuevo, `FormularioBanco.spec.ts` nuevo)
- Camino feliz: `crearBanco('BCP')` inserta con `usuario_id` explícito y agrega el banco al store; aparece en la lista/selectores.
- Borde/error (Gherkin duplicado): insert devuelve `error.code === '23505'` → `store.error === 'Ya existe un banco con ese nombre.'` (NO el error crudo de Postgres) y no se agrega al store.
- Borde: `crearBanco('')` / solo espacios → `FormularioBanco` bloquea con "Ingresa un nombre para el banco.", no llama a Supabase.

### HU-11.2 — Registrar ingreso (`FormularioIngreso.spec.ts` nuevo, `useIngresos.spec.ts` nuevo)
- Camino feliz: fecha + banco + moneda + importe>0 + concepto → `crearIngreso` inserta con `usuario_id` explícito; emite `guardado`.
- Borde: importe = 0 → bloquea, no llama a Supabase, "Ingresa un importe válido mayor a 0." (Gherkin importe ≤ 0).
- Borde: importe negativo → bloquea igual.
- Borde: sin banco → "Selecciona un banco.", no llama a Supabase (Gherkin banco obligatorio).
- Borde: sin concepto → "Ingresa un concepto.", no llama a Supabase (Gherkin concepto obligatorio).
- Borde: sin sesión activa → `useIngresos.crearIngreso` no llama a Supabase, error "No hay una sesión activa...".

### HU-11.3 — Historial de ingresos (`IngresosView.spec.ts` nuevo + cubierto por `useIngresos.spec.ts`)
- Camino feliz: `cargarIngresos` usa `.order('fecha', { ascending: false })`; la vista lista banco/moneda/importe/concepto.
- Borde: lista vacía → renderiza estado vacío claro (no error), sin filas.

### HU-11.4 — Balance en Dashboard (`useDashboard.spec.ts` ampliar, `TarjetaBalanceMoneda.spec.ts` nuevo, `DashboardView.spec.ts` ampliar)
- Camino feliz (función pura): gastos e ingresos mixtos PEN+USD en el mes → `cargarBalancePorMoneda` devuelve balance PEN y balance USD por separado (nunca sumados entre monedas). Ingresos > gastos → positivo.
- Borde: gastos > ingresos → negativo; `TarjetaBalanceMoneda` aplica `--color-error` y señal de signo negativo. Balance ≥ 0 → `--color-primario`.
- Borde: mes sin datos → balance 0 en ambas monedas (sin error).
- Integración vista: `DashboardView` renderiza 2 `TarjetaBalanceMoneda` (PEN/USD) en `seccion-resumen`; el enlace "Ver ingresos" apunta a `{name:'ingresos'}`.

### Retrofit Épica 2 — Banco obligatorio en gasto (ACTUALIZAR tests existentes + nuevos)
Tests EXISTENTES que ROMPEN y hay que actualizar (afirman payload exacto, hoy sin `banco_id`):
- `src/components/__tests__/FormularioGasto.spec.ts`:
  - Todos los `montarFormulario` deben sembrar ≥1 banco en el store de ingresos y seleccionarlo en los caminos felices; si no, la nueva validación "Selecciona un banco." hará fallar flujos que hoy pasan.
  - "camino feliz alta" (usa `objectContaining`, sobrevive) → añadir `banco_id` al assert.
  - "editar gasto manual — camino feliz" (assert `update` **exacto** con `{monto,moneda,categoria_id,fecha,descripcion}`) → añadir `banco_id`.
  - "editar gasto origen correo" (assert de que el payload NO incluye monto/fecha) → depende de la decisión abierta sobre banco editable en correo; ajustar assert en consecuencia.
  - Fixtures `Gasto` (`gastoManual`, `gastoCorreo`) → añadir `banco_id` para compilar.
- `src/composables/__tests__/useGastos.spec.ts`:
  - "crearGasto camino feliz" (`insert` con `{...input, usuario_id, origen, estado}` exacto) → el `GastoInput` de prueba debe incluir `banco_id`.
  - "editarGasto camino feliz" (`update).toHaveBeenCalledWith(input)` exacto) → añadir `banco_id` al `input`.
  - `gastoBase` y demás fixtures `Gasto` → añadir `banco_id` (TS lo exigirá).
- `src/views/__tests__/HistorialView.spec.ts`, `HistorialView.integracion.spec.ts`, `DashboardView.spec.ts`: fixtures `Gasto` necesitan `banco_id` para compilar; sus `fromMock.mockImplementation` de `onMounted` deben cubrir también `from('bancos')` (devolver `{data:[], error:null}`) para que `cargarBancos` no interfiera.
- Tests NUEVOS Épica 2 (en `FormularioGasto.spec.ts`):
  - Borde: gasto sin banco → "Selecciona un banco.", no llama a Supabase.
  - Camino feliz: con banco seleccionado, el payload de `crearGasto` incluye `banco_id`.

### Retrofit Épica 3 — Banco en historial (ACTUALIZAR + nuevos)
- `src/components/__tests__/FiltrosHistorial.spec.ts` → añadir: el nuevo select de banco emite `update:bancoId`; opción "Todos los bancos" por defecto.
- `HistorialView` (spec) → nuevo: filtro por banco reduce la lista (intersección con los filtros de moneda/categoría/mes existentes); cada fila muestra el nombre del banco.

### Retrofit shell (ACTUALIZAR)
- `src/layouts/__tests__/AppShellLayout.spec.ts`:
  - El `montarShell` usa un memory router SIN rutas `ingresos`/`bancos`: añadirlas para que los nuevos `router-link` no emitan warnings/fallos.
  - Test existente "al abrir el modal de registro (FAB) → `storeUi.modalAbierto=true` y bottom nav se oculta": con el nuevo comportamiento el FAB abre `HojaAccionesFab`. Si `HojaAccionesFab` llama `storeUi.abrirModal()` al montarse (contrato recomendado), el test sigue verde; si no, actualizar el test para reflejar que el FAB abre la hoja. Documentar la decisión.
  - Nuevos: FAB móvil abre la hoja con 2 opciones; "Registrar ingreso" del sidebar desktop abre `ModalIngreso`.

---

## Decisión funcional abierta (confirmar con Producto — no bloquea el build)
- **`banco_id` editable en gastos de origen correo.** Hoy el correo solo permite editar `categoria_id`/`descripcion`. Recomendación por defecto: permitir también editar el banco (igual que la categoría ya es editable), ya que la Edge Function que infiere banco se planea aparte y su inferencia puede necesitar corrección manual. Si Producto lo excluye, mantener el payload de correo limitado como hoy y ajustar el assert del test correspondiente.

## Sugerencias fuera de alcance (NO incluir en este build)
- Editar/eliminar ingresos y bancos (las HU 11.1–11.4 solo piden crear + listar). El store `ingresos.ts` puede dejarse sin `actualizar/quitar` hasta que exista una HU.
- Extraer un helper compartido de "primer día del mes" (hoy duplicado entre `useDashboard` y `usePresupuestos`) — mismo criterio que builds previos.
- Retrofit de la Edge Function `importar-borrador` para inferir banco: explícitamente fuera de alcance (se planeará por separado).
- `npm run build` / suite completa al final: lo ejecuta y reporta el builder.
