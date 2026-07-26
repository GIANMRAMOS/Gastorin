# Micro-plan — Sacar la columna "Acciones" fuera del scroll horizontal de `TablaMovimientos.vue`

> Sobrescribe el `dev-plan.md` anterior (HU-18.1 orden por timestamp + afordancia de acciones, ya construido y en el código actual).

## Patrón arquitectónico detectado

- **Capas (CLAUDE.md, estricta):** `TablaMovimientos.vue` es un componente *presentacional puro* de `components/`. No toca Supabase ni el store; recibe `filas: FilaMovimiento[]` + `totalSinFiltrar: number` y emite `editar: [string]` / `eliminar: [string]`. Ambas vistas (`HistorialView.vue`, `IngresosView.vue`) resuelven el id emitido contra el store (`abrirModalEdicionPorId`, `pedirConfirmacionEliminarPorId`). **El contrato externo es el único acoplamiento y no se toca.**
- **Convenciones del propio componente:** nombres/comentarios en español; comentarios solo para el "por qué" no obvio (el archivo ya está lleno de ellos, es el estilo); `min-width/height: 44px` como zona táctil; menú "⋮" con estado único `filaMenuAbiertoId` + cierre por `mousedown` afuera (no `click`, para no perder la carrera con el `click` del ítem) + `Escape`; breakpoint local de ESTE componente = **640px** (distinto del global de 900px de la app; se respeta el 640px existente porque es donde esta tabla colapsa a tarjetas).
- **Patrón de tests (dato decisivo, leído del código real):** los unitarios (`TablaMovimientos.spec.ts`) navegan por `thead th`, `tfoot`, `tbody tr`, `td[data-etiqueta]` y clases (`.boton-menu-acciones`, `.boton-editar`, `.boton-eliminar`, `.menu-acciones-fila`). Los de integración (`HistorialView.*`, `IngresosView.*`) cuentan filas con `wrapper.findAll('tbody tr')` (~10 veces por archivo) y disparan acciones con `wrapper.find('.boton-menu-acciones')` **sin scoping** (primer match). Esto gobierna la elección de enfoque.

## Enfoque técnico elegido (decidido, no abierto)

**Opción B refinada: "tabla de datos + carril de acciones lateral".** Un envoltorio flex con dos regiones hermanas:

1. `.envoltorio-datos` — `overflow-x: auto`, `flex: 1; min-width: 0`. Contiene la `<table class="tabla-movimientos">` **con solo las 5 columnas de datos** (Fecha, Descripción, Categoría, Banco, Monto). Mantiene `<thead>`/`<tbody>`/`<tfoot>` nativos.
2. `.carril-acciones` — `flex: 0 0 auto`, ancho fijo (~56px), **fuera del `overflow`**, sin scroll. Contiene el control "⋮" por fila (reusando el menú actual) + su cabecera (sr-only "Acciones") + un espaciador al pie que alinea con el `<tfoot>`.

**Por qué B y no A:** la Opción A (grid por fila con `overflow-x` propio en cada fila) tiene un defecto de UX que la descarta: si cada fila scrollea por su cuenta, las columnas dejan de alinearse verticalmente entre filas y aparecen múltiples scrollbars. Una tabla de datos exige **un solo scrollbar y columnas alineadas**, y eso obliga a que TODAS las filas de datos vivan en un único contenedor de scroll — exactamente la región `.envoltorio-datos` de la Opción B. La `<table>` nativa es además la forma más barata de mantener anchos de columna consistentes entre filas.

**Por qué B y no abandonar `<table>`:** los tests de integración cuentan `findAll('tbody tr')`. Conservando `<table>`/`<tbody>`/`<tr>` para los datos, **ambos specs de integración pasan sin cambios** y no hace falta reconstruir semántica de tabla con ARIA. Abandonar la tabla (Opción A) obligaría a reescribir ~20 asserts de integración y a replicar la semántica con roles ARIA — mucho más blast radius por cero beneficio de layout.

**Por qué esto SÍ resuelve el overlap de raíz (y el sticky no):** el carril tiene su ancho reservado por el `flex` del envoltorio; nunca comparte caja con las columnas de datos y `table-layout: auto` ya no puede reasignar su ancho al Monto, porque el carril **no es una columna de la tabla**. El botón vive fuera del contenedor con `overflow`, así que es imposible que quede tapado o que tape nada, en cualquier `scrollLeft`.

**Riesgo de desincronización de altura (el punto débil declarado de B) — neutralizado por el diseño existente:** en escritorio la descripción usa `white-space: nowrap; text-overflow: ellipsis` (`.celda-descripcion`) → **toda fila de datos es de una sola línea**, altura constante e independiente del contenido. Con el mismo box-model en el carril (igual `padding: var(--espacio-3)`, igual `border-bottom: 1px`, igual `line-height`) las alturas coinciden por construcción, no por suerte. El escenario que rompería B (una descripción que wrappea y agranda la fila) **no puede ocurrir en escritorio** por el `nowrap`. Blindaje extra: definir una variable `--altura-fila` aplicada a `.fila-movimiento td` y a la celda del carril. En mobile no aplica (ver responsive).

## Responsive (breakpoint 640px) — confirmación y decisión

Confirmado: **en mobile NO hay problema de overlap** (no hay scroll horizontal; la tabla colapsa a tarjetas apiladas con `data-etiqueta`), así que el split lateral no hace falta y de hecho estorba (un carril lateral no puede alinearse con tarjetas de altura variable que wrappean).

Decisión para no duplicar el control ni introducir fragilidad de doble render: **render condicional por `matchMedia('(max-width: 640px)')`** (reactivo, con listener añadido/quitado en `onMounted`/`onUnmounted`, igual que los listeners actuales de `mousedown`/`keydown`). Solo se monta UNA de las dos ubicaciones a la vez:
- **Escritorio** (`esMovil = false`, y también el default cuando `window.matchMedia` no existe → **jsdom cae acá**): acciones en `.carril-acciones`.
- **Mobile** (`esMovil = true`): acciones como una celda dentro de cada `<tr>` (vuelve a stackear dentro de la tarjeta, con `data-etiqueta="Acciones"` y `justify-content: flex-end`, como hoy).

Para no duplicar el markup del botón + menú (SVGs, roles), **extraer un subcomponente interno `AccionesFila.vue`** usado en ambas ubicaciones. El estado `filaMenuAbiertoId` y los handlers `editar/eliminar` quedan en el padre y se pasan por props/emit — una sola fuente de verdad del menú abierto. `matchMedia` como pieza JS es una desviación menor del "responsive puro por CSS", justificada porque CSS no puede reubicar un nodo del DOM de un contenedor a otro.

## Desviación de arquitectura

- **¿Se necesita desviarse? NO.** Refactor interno de la vista de UN componente presentacional. No cambia el modelo de datos, no toca Supabase/store/composables, no cambia el contrato (props/emits idénticos) → `HistorialView.vue` e `IngresosView.vue` no requieren ningún cambio. **No dispara GATE 1.**
- Coincido con el criterio inicial de Gianmarco tras ver el código real. Dos matices menores, contenidos dentro del componente y sin impacto en otros módulos (los declaro por transparencia, no ameritan consultar a Architect):
  1. Se introduce un subcomponente hijo `AccionesFila.vue` (archivo nuevo, pero interno a esta feature).
  2. Se introduce un uso de `matchMedia` (patrón nuevo en este componente) para el render responsive del control.

## Archivos a crear/modificar

- `src/components/TablaMovimientos.vue` — **modificar** — nuevo layout flex (`.tabla-con-acciones` = `.envoltorio-datos` + `.carril-acciones`); `<table>` reducida a 5 columnas; `<tfoot>` ajustado; `matchMedia` reactivo (`esMovil`) con listener en mount/unmount; render del control en carril (desktop) o como `<td>` dentro del `<tr>` (mobile); mover estado del menú/handlers como props/emit hacia el hijo. CSS: quitar `position: sticky/right/box-shadow` de `.columna-acciones`; añadir estilos del envoltorio flex, carril y alineación de alturas; ajustar el bloque `@media (max-width: 640px)`.
- `src/components/AccionesFila.vue` — **crear** — control "⋮" por fila. Props `{ filaId: string; abierto: boolean; etiquetaFila?: string }`; emits `{ alternar: [string]; editar: [string]; eliminar: [string] }`. Contiene el botón `.boton-menu-acciones` (con `aria-haspopup`/`aria-expanded`/`aria-label`) y el `.menu-acciones-fila` (`role="menu"` con `.boton-editar`/`.boton-eliminar`, `role="menuitem"`). **Reutilizar el markup y la lógica actuales tal cual** (SVGs, clases, roles); solo se extraen, no se reescriben. El contenedor raíz lleva `.celda-acciones` + `data-fila-id` para que el `manejarClicFuera` del padre (que busca `.celda-acciones[data-fila-id="..."]`) siga funcionando sin cambios.

> Chunk único, NO paralelizable: los dos archivos están fuertemente acoplados (el padre extrae al hijo). Un solo builder.

## Detalle por zona (para no adivinar)

- **`<thead>`:** la tabla de datos queda con 5 `<th>` (Fecha, Descripción, Categoría, Banco, Monto). El header "Acciones" (hoy `<th>` con `<span class="sr-only">`) se muda a la cabecera del `.carril-acciones` como `<span class="sr-only">Acciones</span>`, con la misma altura que la fila del `thead` para alinear.
- **`<tfoot>`:** hoy es `colspan=4` ("N de N") + celda Monto + celda Acciones vacía (`.celda-acciones-total`). Nuevo: `colspan=4` + celda Monto (total 5 columnas). **Se elimina la `<td class="celda-acciones-total">`** y su CSS (ya no hay columna sticky que alinear — ése era su único motivo, según el comentario del propio archivo, líneas 190-196). El carril lleva un espaciador al pie que iguala la altura del `<tfoot>` (recordar: `.fila-totales td` usa `border-top: 2px`, sin `border-bottom`) para que el borde derecho cierre parejo.
- **Menú "⋮":** reusar la lógica existente sin reconstruirla. El menú (`position: absolute; top:100%; right:0`) ahora vive dentro de la celda del carril, que debe ser `position: relative` y **sin `overflow: hidden`** — al estar fuera del `.envoltorio-datos` (que sí tiene `overflow-x`), el desplegable ya no corre riesgo de recorte (mejora respecto a hoy). Ancho del carril ~56px < 150px del menú → el menú se despliega hacia la izquierda desde el botón (correcto).
- **Accesibilidad:** los datos conservan `<table>` nativa (lectores la anuncian como tabla, sin ARIA manual). Como en escritorio el control sale de la tabla, se pierde su asociación con la fila en el árbol de accesibilidad → **enriquecer el `aria-label` del botón para incluir contexto de fila**, p. ej. `Más acciones para {descripcion}` (el padre pasa `etiquetaFila` al hijo). Mantener `aria-haspopup`, `aria-expanded`, `role="menu"`/`menuitem` y los `aria-label` de Editar/Eliminar. En mobile el control va dentro del `<tr>` → asociación nativa intacta.

## Plan de pruebas

### Tests existentes que ROMPEN y hay que actualizar (`TablaMovimientos.spec.ts`)
- `columnas de encabezado ... toEqual([...,'Monto','Acciones'])`: ahora `thead th` = 5. Cambiar a los 5 de datos + assert aparte de que la cabecera sr-only "Acciones" existe en el carril.
- `responsive: cada celda lleva data-etiqueta ... toEqual([...,'Monto','Acciones'])`: en escritorio (default jsdom) el `tbody td[data-etiqueta]` = 5 (Acciones ya no es `td`). Ajustar a 5.
- `acción editar` / `acción eliminar` / `abrir el menú de una fila cierra el de otra`: usan `filaTaxi.find('.boton-menu-acciones')` **scopeado a `tbody tr`**. El botón se mudó al carril (fuera del `tr`) → localizarlo por `.celda-acciones[data-fila-id="m2"]` a nivel `wrapper`. Igual para verificar `.menu-acciones-fila` abierto/cerrado (buscar por `data-fila-id`, no dentro del `tr`).
- `accesibilidad: aria-label ... toBe('Más acciones')`: al enriquecer el label, cambiar a `toContain('Más acciones')` o al texto nuevo con contexto.

### Tests existentes que NO deberían romper (verificar, no tocar)
- `TablaMovimientos.spec.ts`: camino feliz, `tfoot` "N de N" + totales por moneda, "N de N sin filtrar", sin filas (no `tfoot`, 0 `tbody tr`), toggle del menú, "no está en el DOM hasta clic", cierre tras seleccionar. Siguen válidos (la `<table>` de datos y el `tfoot` persisten).
- **Integración** (`HistorialView.integracion`, `IngresosView.integracion`, `HistorialView.spec`, `IngresosView.spec`): cuentan `findAll('tbody tr')` (sobrevive: solo cuenta filas de datos, el carril NO usa `tr`) y disparan `wrapper.find('.boton-menu-acciones')` / `.boton-editar` / `.boton-eliminar` **sin scoping** (primer match, sigue existiendo). **Expectativa: pasan sin cambios.** Verificarlo explícitamente es parte del gate.

### Verificación NUEVA del problema resuelto (cierra el "compila y pasa no bastó")
- **Invariante estructural (vitest, sí verificable):** afirmar que el control de acciones **NO es descendiente del contenedor con scroll**: `wrapper.find('.envoltorio-datos').find('.boton-menu-acciones').exists()` debe ser `false`, y `wrapper.find('.carril-acciones .boton-menu-acciones').exists()` debe ser `true`. Garantiza por construcción que ningún `scrollLeft` puede tapar ni desplazar el botón — es el proxy honesto de "fuera del área de scroll" que jsdom sí puede comprobar.
- **Honestidad sobre `getBoundingClientRect`:** jsdom **no calcula layout** (rects en 0), así que la comprobación geométrica real (rect del botón no intersecta el rect de "Monto" en `scrollLeft=0`) **no es fiable en vitest**. Se deja como verificación de QA/manual en navegador real (o Playwright si se automatiza): con datos que fuercen scroll horizontal, confirmar en escritorio que "⋮" está siempre visible y que "Monto" nunca queda cubierto, en `scrollLeft=0` y con scroll al máximo. Anotar para Demoleitor/QA; no darlo por cerrado solo con vitest.

### Casos de prueba (mantener/añadir)
- Camino feliz: 1 fila por movimiento con fecha/descr/categoría/banco/monto formateado (existente).
- Borde: sin filas → sin `tfoot`, 0 `tbody tr` (existente); "N de N" con filtrado (existente).
- Acciones: abrir "⋮" → Editar emite `editar` con id; → Eliminar emite `eliminar` con id; toggle; abrir una fila cierra otra (existentes, re-localizados al carril).
- Nuevo: invariante estructural "acciones fuera de `.envoltorio-datos`".

## Sugerencias fuera de alcance (no implementar en este build)
- Unificar el breakpoint de este componente (640px) con el global de la app (900px) es una decisión de UX aparte; hoy se respeta el 640px existente para no cambiar comportamiento.
- Automatizar la verificación geométrica del overlap con Playwright sería un buen refuerzo permanente, pero excede este refactor y la infra de tests actual (vitest/jsdom).

## Lo que no pude verificar / supuestos
- No corrí `npm run build` ni `npm run test:run`; las referencias a líneas de tests son de lectura estática y deben reconfirmarse al editar.
- El comportamiento de `matchMedia` en el entorno de test (jsdom) se asume ausente o `false` por defecto → render de escritorio (carril). Si el setup de vitest lo stubbea distinto, el builder/tester debe ajustar (guardar con `typeof window.matchMedia === 'function'`).
