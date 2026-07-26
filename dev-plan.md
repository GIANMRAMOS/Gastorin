# Micro-plan — Orden por timestamp de registro (HU-18.1) + afordancia de acciones en TablaMovimientos

> Sobrescribe el `dev-plan.md` anterior (Fase 4 "Caudal", PresupuestosView, ya construida y en el código actual).

## Patrón arquitectónico detectado

Capas estrictas (confirmadas en CLAUDE.md y en el código):

- `types/*.ts` espejan las tablas. Confirmado: `Gasto.creado_en: string` (tabla `gastos`) y `Ingreso.created_at: string` (tabla `ingresos`) — nombres realmente distintos entre ambas tablas, tal como advertía la tarea. No hay que tocar `types/`.
- `composables/use*.ts` son la ÚNICA puerta a Supabase. Las tres queries a cambiar viven ahí (`useGastos.cargarGastos`, `useIngresos.cargarIngresos`, `useDashboard.cargarDatosDashboard`). Cada una arma la cadena `supabase.from(...).select()...order(...)`.
- Las vistas leen del store (Egresos/Ingresos) o de refs locales del composable (Dashboard) y son presentacionales.
- `TablaMovimientos.vue` es presentacional puro (`filas` ya viene lista y ordenada; emite `editar`/`eliminar` por id). Es compartido por `HistorialView` (Egresos) e `IngresosView`, así que el fix visual aplica a ambas automáticamente.

Flujo de orden, ya trazado (dato clave para el plan):

- **Egresos / Ingresos**: `store.gastos`/`store.ingresos` se pintan en el orden que devolvió la query. `HistorialView.gastosFiltrados`/`filasTabla` (y el equivalente en `IngresosView`) usan solo `.filter()`/`.map()`, que PRESERVAN el orden. `TablaMovimientos` NO reordena. ⇒ cambiar el `.order()` de la query basta para estas dos vistas.
- **Feed del Dashboard**: `FeedMovimientos.vue` NO reordena (agrupa con `agruparPorFecha`, que respeta el orden recibido). PERO el orden lo fija `DashboardView` vía `combinarMovimientosDelMes(...)`, que RE-ORDENA en memoria con `compararMovimientosDesc` (primario `fecha` desc, desempate por `id`). Por eso, cambiar solo el `.order()` de `cargarDatosDashboard` NO cambia el orden visible del feed: para dos movimientos del mismo día el desempate hoy es por `id` (UUID, arbitrario), no por hora de registro.

## Desviación de arquitectura

- ¿Se necesita desviarse? **NO.** Son cambios de query (columna de orden) y de presentación (íconos). No tocan modelo de datos, migraciones, ni la capa de stores. Encaja en el patrón existente. No dispara GATE 1.
- **Aclaración de alcance importante (no es desviación, pero corrige la tarea):** para que el **feed del Dashboard** cumpla el criterio Gherkin "mismo día ordenados por hora real", NO basta con cambiar las dos queries de `useDashboard` como decía la tarea. El feed se re-ordena en memoria en `combinarMovimientosDelMes`/`compararMovimientosDesc`, cuyo desempate es por `id`. Hay que llevar el timestamp de creación dentro de `MovimientoUnificado` y usarlo como desempate. Es un cambio acotado dentro del mismo composable (`useDashboard.ts`), sin tocar otra capa. Cambiar además el `.order()` de las queries de `cargarDatosDashboard` es de bajo valor por sí solo (el feed re-ordena y las agregaciones son independientes del orden), pero se hace igual por consistencia y porque la tarea lo pide.

## Archivos a crear/modificar

### Chunk A — Orden Egresos/Ingresos (independiente, paralelizable)
- `src/composables/useGastos.ts` — modificar — en `cargarGastos()`: cambiar `.order('fecha', { ascending: false })` por `.order('creado_en', { ascending: false })`.
- `src/composables/useIngresos.ts` — modificar — en `cargarIngresos()`: cambiar `.order('fecha', { ascending: false })` por `.order('created_at', { ascending: false })`.

### Chunk B — Orden del feed del Dashboard (independiente de A)
- `src/composables/useDashboard.ts` — modificar:
  1. `cargarDatosDashboard()`: query de gastos `.order('fecha'...)` → `.order('creado_en', { ascending: false })`; query de ingresos `.order('fecha'...)` → `.order('created_at', { ascending: false })`. (El filtro `.gte('fecha', ...)` de la ventana de 6 meses se mantiene tal cual: la ventana sigue siendo por fecha del movimiento.)
  2. Interface `MovimientoUnificado`: agregar campo `creadoEn: string`.
  3. `movimientoDesdeGasto`: `creadoEn: gasto.creado_en`. `movimientoDesdeIngreso`: `creadoEn: ingreso.created_at`.
  4. `compararMovimientosDesc`: mantener `fecha` desc como primario (para que el agrupado por día de `agruparPorFecha` siga siendo válido); cambiar el desempate: primero `creadoEn` desc, y como último desempate determinista dejar `id` desc (para casos con `creadoEn` igual/ausente). Es decir: `fecha` → `creadoEn` → `id`.
- `src/views/DashboardView.vue` — NO tocar. `movimientosEnriquecidos` hace `...movimiento`, así que `creadoEn` fluye solo hacia `MovimientoFeed` (que extiende `MovimientoUnificado`). Solo confirmar, no requiere edición.
- `src/components/FeedMovimientos.vue` — NO tocar. Confirmado: no reordena, solo agrupa en el orden recibido.

### Chunk C — Afordancia visual de acciones (independiente de A y B)
- `src/components/TablaMovimientos.vue` — modificar:
  - Reemplazar el texto "Editar" por un `<svg>` de lápiz (reusar el `path` de lápiz de `TarjetaSaldosPorCuenta.vue`: `M12 20h9` + `M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z`, con `viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"`).
  - Reemplazar el "×" desnudo del botón eliminar por un `<svg>` de tacho/basura, mismo estilo de trazo.
  - Agregar `aria-label="Editar movimiento"` al botón de editar (el de eliminar ya tiene `aria-label="Eliminar movimiento"`).
  - **Mantener las clases `.boton-editar` y `.boton-eliminar`** (los tests las usan como selector; ver Plan de pruebas) y ambos siguen siendo `<button type="button">` reales que emiten `editar`/`eliminar`.
  - Contraste: hoy `.boton-fila` usa `color-texto-secundario` (apagado). Subir a `--color-texto` para editar y mantener/reforzar `--color-error` para eliminar; dar tamaño de ícono explícito (ej. 16-18px) para que se noten.
  - **Responsive**: revisar el bloque `@media (max-width: 640px)` (la tabla colapsa a tarjetas apiladas). La celda de acciones ahí tiene `.celda-acciones::before { content: none; }` y `justify-content: flex-end`. Confirmar que los dos íconos quedan alineados y con área de toque suficiente en ese layout, no solo en escritorio.

### Tests a actualizar (obligatorio: la suite completa debe quedar verde — GATE 2 + CLAUDE.md)
- `src/composables/__tests__/useGastos.spec.ts` (~línea 57): la aserción `expect(builder.order).toHaveBeenCalledWith('fecha', { ascending: false })` pasa a `'creado_en'`. Ajustar también el título del `it` ("ordenados por fecha descendente").
- `src/composables/__tests__/useIngresos.spec.ts` (~línea 51): idem a `'created_at'`.
- `src/composables/__tests__/useDashboard.spec.ts`: el test de empate (~líneas 542-553) asume desempate por `id`; los helpers `gastoDe`/`ingresoDe` hoy ponen `creado_en`/`created_at = ''`. Con el nuevo desempate `creadoEn`→`id`, ese test sigue pasando (ambos con `creadoEn=''` caen al desempate por `id`), pero conviene: (a) dar `creado_en`/`created_at` reales en los helpers, (b) actualizar el comentario "Desempate determinista por id". Verificar que ninguna otra aserción de `combinarMovimientosDelMes`/`combinarUltimosMovimientos` se rompa (las que ordenan por fechas distintas no se afectan). No hay aserción sobre el arg de `.order()` en este spec (solo sobre `.gte('fecha', ...)`, que no cambia).
- `src/components/__tests__/TablaMovimientos.spec.ts`: usa selectores `.boton-editar`/`.boton-eliminar` (NO texto), así que sigue verde si se conservan las clases. Agregar aserción de `aria-label="Editar movimiento"` como parte del fix de accesibilidad.

## Plan de pruebas

### Camino feliz
- Egresos: `cargarGastos` consulta con `.order('creado_en', { ascending: false })` y el store queda con los gastos más recientemente registrados primero.
- Ingresos: `cargarIngresos` consulta con `.order('created_at', { ascending: false })`.
- Dashboard: `cargarDatosDashboard` usa `creado_en` (gastos) y `created_at` (ingresos); `combinarMovimientosDelMes` devuelve, dentro de cada día, los movimientos por `creadoEn` desc.
- TablaMovimientos: se renderizan íconos de lápiz y tacho visibles; clic en lápiz emite `editar` con el id; clic en tacho emite `eliminar` con el id.

### Borde / error
- **Empate de `creadoEn`** (mismo timestamp exacto, ej. seed/backfill): el desempate cae a `id` desc — orden determinista y reproducible (mismo input, mismo output).
- Query devuelve `error` → se mantiene el manejo actual (`establecerError`, return false). Sin cambios, cubierto por los tests existentes.
- Array vacío en el feed / sin movimientos → `[]`, mensaje "Ningún movimiento con estos filtros" (sin regresión).
- **Consecuencia intencional a validar**: en las tablas planas (Egresos/Ingresos) el orden pasa a ser por registro, no por fecha; un movimiento con `fecha` antigua pero registrado hoy sube al tope. Es el comportamiento pedido por PO. En el feed del Dashboard, en cambio, ese mismo movimiento aparece en el grupo de su `fecha` (día), ordenado dentro del día por `creadoEn` — coherente con que el feed agrupa por día.
- TablaMovimientos en mobile (`@media max-width: 640px`): los dos íconos se ven y son tocables en el layout de tarjetas apiladas, no solo en escritorio.

### Criterios de aceptación — HU-18.1 (Gherkin de ProductOwner)
1. **Dos movimientos del mismo día ordenados por hora real de registro**
   - Dado dos gastos con la misma `fecha` (mismo día) pero distinto `creado_en`,
   - Cuando se carga la lista de Egresos,
   - Entonces el de `creado_en` más reciente aparece primero.
   - (Test unitario en `useGastos.spec.ts` verificando el arg `.order('creado_en', {ascending:false})`; test de `combinarMovimientosDelMes` en `useDashboard.spec.ts` con dos ítems misma `fecha`, distinto `creadoEn` → orden por `creadoEn` desc.)
2. **Orden estable tras editar (regresión)**
   - Dado un movimiento en una posición del listado,
   - Cuando se edita su categoría/descripción/monto (que NO tocan `creado_en`/`created_at`; solo `actualizado_en` en gastos),
   - Entonces conserva su posición (no salta al tope).
   - Confirmado en el código: `editarGasto`/`editarIngreso` mandan `update(input)` con `Partial<GastoInput>`/`Partial<IngresoInput>`, y esos tipos NO contienen las columnas de timestamp. Test de regresión: tras `actualizarGasto` en el store, el orden relativo no cambia porque el criterio de orden (`creado_en`) es inmutable en la edición.
3. **Mismo comportamiento en Egresos / Ingresos / Feed del Dashboard**
   - Egresos vía `useGastos.cargarGastos` (`creado_en`).
   - Ingresos vía `useIngresos.cargarIngresos` (`created_at`).
   - Feed del Dashboard vía `combinarMovimientosDelMes` (desempate `creadoEn`) — cubierto por su propio test unitario, ya que cambiar solo la query NO era suficiente.

## Sugerencias fuera de alcance (no implementar en este build)
- El `id` como último desempate en `compararMovimientosDesc` es UUID (arbitrario); si en el futuro se quisiera un empate 100% intuitivo cuando `creadoEn` coincide, haría falta un tercer criterio semántico. Innecesario hoy.
- `UltimosMovimientos.vue` (widget legado, fuera del Dashboard actual) también consume `combinarUltimosMovimientos`; hereda el nuevo desempate por `creadoEn` sin cambios extra. No requiere acción, solo se nota que el cambio lo alcanza.

## Lo que no pude verificar / supuestos
- No inspeccioné `IngresosView.vue` línea por línea, pero por el patrón compartido (usa `TablaMovimientos` y filtra `store.ingresos` con `.filter/.map`) se asume que NO reordena, igual que `HistorialView`. El builder debe confirmarlo de un vistazo antes de cerrar.
- No corrí `npm run test:run`; las líneas de tests citadas son de lectura estática y deben reconfirmarse al editar.
