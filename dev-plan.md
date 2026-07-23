# Micro-plan — Ajustes Épica 11 + Dashboard (defaults de formulario, reorden de menú, Dashboard 3×2)

> Reemplaza el micro-plan anterior (Épica 11 base, ya construida en commit 818b079). Este cubre solo el paquete de ajustes pequeños ya validado por ProductOwner/UX/Architect.

## Patrón arquitectónico detectado
- **Vue 3 `<script setup lang="ts">` + Composition API + Pinia**. Formularios con estado local vía `ref`, validación síncrona en `validarFormulario()` que fija `errorValidacion` y bloquea antes de llamar a Supabase.
- **Componentes presentacionales puros** (`TarjetaResumenMoneda`, `TarjetaBalanceMoneda`): reciben ya calculado por props, sin fetch. La vista (`DashboardView`) hace las agregaciones con funciones puras exportadas de `useDashboard.ts`.
- **`useDashboard()` ya expone** `filas` (gastos) y `filasIngresos` (ingresos) de la ventana de 6 meses. `DashboardView` **ya destructura `filasIngresos` y ya calcula** `balancePorMoneda` con `cargarBalancePorMoneda(...)` → `{ ingresos, gastos, balance }` por moneda. **La fuente de datos de la fila nueva de ingresos ya existe y está cableada; no se toca `useDashboard.ts`.**
- **Layout único `AppShellLayout`** con doble markup: sidebar desktop (`.navegacion` con `.item-nav` router-links y `.item-nav-boton` botones) y bottom nav móvil (`.navegacion-inferior` con `.item-nav-movil` + `.boton-fab`). El FAB abre `HojaAccionesFab`.
- **Convención**: nombres, clases CSS y textos en español; monedas `'PEN'`/`'USD'`.
- **Tests**: Vitest + `@vue/test-utils`, un `.spec.ts` por unidad; vistas/layout montan con router de memoria y stubbean Supabase con `crearConstructorConsulta`.

## Desviación de arquitectura
- **¿Se necesita desviarse? NO.** Todo es reutilización: defaults en los `ref` iniciales, reordenar markup existente, y reusar `TarjetaResumenMoneda` con una prop opcional `etiqueta` (aditiva, con default → no rompe la fila 1). No cambia el modelo de datos, no toca `useDashboard.ts`, no introduce patrón nuevo. **No dispara GATE 1.**

## Ambigüedades a resolver (NO asumir en silencio — confirmar con orquestador)
1. **Enlace de ruta "Ingresos" en el menú.** El orden desktop pedido (8 ítems) y las "6 rutas" del bottom nav **omiten** el router-link a `{ name: 'ingresos' }`, que hoy existe en ambos (sidebar línea 164-169). La lectura coherente con el diseño ya establecido (comentario en `TarjetaBalanceMoneda`: *"Único acceso a Ingresos en móvil, vía el enlace 'Ver ingresos'"*) es **eliminar el router-link 'Ingresos' de la navegación** (queda accesible por la tarjeta de balance). El plan asume esto. La ruta `ingresos` sigue existiendo en el router; solo se quita su ítem de nav. El brief dijo "no crear nada nuevo" pero no habló de eliminar → **confirmar**.
2. **Botón "Salir" del bottom nav móvil.** Hoy el bottom nav termina con un botón "Salir" (línea 267-272). El brief lista solo las 6 rutas + FAB. Asumo **mantener "Salir"** (no hay otro acceso a cerrar sesión en móvil); si se mantiene, entra también en el contenedor con `overflow-x: auto` y necesita `flex-shrink: 0`. **Confirmar.**

## Archivos a crear/modificar

### Chunk A — Defaults de formularios (independiente)
- `src/components/FormularioGasto.vue` — **modificar** — En modo alta (`props.gasto == null`):
  - `moneda`: `ref<Moneda | ''>(props.gasto?.moneda ?? 'PEN')` — en edición sigue tomando el valor del gasto; solo cambia el default de alta.
  - `fecha`: `ref(props.gasto?.fecha ?? hoyISO())`. Para `origen === 'correo'` la fecha viene del gasto (no aplica default). Generar "hoy" con fecha **local** (mismo patrón que `mesActual` en DashboardView: `getFullYear`/`getMonth`+1/`getDate` con padding), NUNCA `toISOString()` (evita corrimiento de zona horaria).
- `src/components/FormularioIngreso.vue` — **modificar** — `moneda`: `ref<Moneda | ''>('PEN')`; `fecha`: `ref(hoyISO())`. Mismo helper de fecha local.
- Ambos campos siguen editables (no `disabled`); solo cambia el valor inicial. No tocar validaciones.

### Chunk B — Reorden de menú (independiente de A y C)
- `src/layouts/AppShellLayout.vue` — **modificar**:
  - **Sidebar `.navegacion`**: reordenar el markup ya existente a: Dashboard, botón "Registrar gasto", Historial, Bandeja, Presupuestos, Categorías, Bancos, botón "Registrar ingreso". Quitar el router-link "Ingresos" (ambigüedad #1). Mover bloques `<router-link>`/`<button>` tal cual; no crear íconos nuevos.
  - **Bottom nav `.navegacion-inferior`**: dejar las 6 rutas en orden Dashboard, Historial, Bandeja, Presupuestos, Categorías, Bancos. Hoy **falta "Bancos"** como ítem móvil → copiar el bloque de ícono de Bancos que ya existe en el sidebar (reordenar/copiar markup existente, no diseño nuevo). Swap Presupuestos↔Categorías respecto al orden actual. FAB fijo como está; "Salir" al final (ambigüedad #2).
  - **CSS**: en `.navegacion-inferior` añadir `overflow-x: auto;` y `-webkit-overflow-scrolling: touch;`. En `.item-nav-movil` añadir `flex-shrink: 0;`. El `.boton-fab` debe quedar **fijo, fuera del flujo con scroll** (como hoy); si el `overflow-x` lo afecta, sacarlo del contenedor scrolleable o darle posición propia — validar visualmente. No tocar el `@media (min-width: 900px)`.
- `src/components/HojaAccionesFab.vue` — **verificar (probable no-cambio)** — El orden actual ya es "Registrar gasto" (índice 0) antes de "Registrar ingreso" (índice 1). Ya cumple; dejar como está salvo que falle la verificación.

### Chunk C — Dashboard 3 filas × 2 columnas (independiente de A y B)
- `src/components/TarjetaResumenMoneda.vue` — **modificar** — Añadir prop `etiqueta: string` con default `'Gastado este mes'`. En el template, `.etiqueta-resumen` pasa de texto fijo a `{{ etiqueta }}`. Prop opcional con default → la fila 1 no se rompe aunque no la pase.
- `src/views/DashboardView.vue` — **modificar** — Reestructurar la actual `.seccion-resumen` (hoy 2×2 mezclando resumen+balance) en **tres** secciones de 2 columnas:
  - Fila 1 "Gastado este mes": las 2 `TarjetaResumenMoneda` PEN/USD actuales (con `resumenPorMoneda`), opcionalmente `etiqueta="Gastado este mes"` por claridad. Sin cambio de lógica.
  - Fila 2 "Ingresos este mes" (nueva): 2 `TarjetaResumenMoneda` con `etiqueta="Ingresos este mes"`, `:total="balancePorMoneda.PEN.ingresos"` / `.USD.ingresos`, `:variacion-pct="null"`. NO calcular variación.
  - Fila 3 "Balance este mes": mover aquí las 2 `TarjetaBalanceMoneda` PEN/USD (con `balancePorMoneda`) que hoy cierran la sección 2×2. Componente sin cambios.
  - CSS: un grid de 2 columnas por fila (reutilizar el patrón de `.seccion-resumen`). Todo lo posterior (`ToggleMoneda`, gasto por categoría, tendencia) queda **intacto**.

## Plan de pruebas

### Tests existentes que ROMPEN y hay que actualizar

**`src/components/__tests__/FormularioGasto.spec.ts`**
- Línea 79 (`extracción de ToggleMoneda`): `expect((select).value).toBe('')` en alta → ahora `'PEN'`. **Actualizar** el valor inicial esperado a `'PEN'` (el resto —setValue USD/PEN— sigue válido).
- Línea 178 (`borde: falta moneda → 'Selecciona una moneda.'`): con default `'PEN'` ya no reproduce el caso. **Actualizar**: `await wrapper.find('#moneda').setValue('')` antes de enviar para seguir cubriendo esa validación.
- Bordes monto=0/negativo/no numérico (123-176) y camino feliz (90) setean `#fecha` explícito → siguen pasando.

**`src/components/__tests__/FormularioIngreso.spec.ts`**
- Línea 140 (`borde: sin fecha → 'Selecciona una fecha.'`): con default hoy ya no reproduce el caso. **Actualizar**: `await wrapper.find('#fecha-ingreso').setValue('')` explícito antes de enviar.
- Los demás usan `llenarCamposValidos` (setean todo) → pasan sin cambios.

**`src/views/__tests__/DashboardView.spec.ts`**
- Línea 82-100 (`HU-7.1: exactamente 2 TarjetaResumenMoneda`): al reusar `TarjetaResumenMoneda` en la fila de ingresos habrá **4** instancias y `.find(moneda==='PEN')` se vuelve ambiguo. **Actualizar**: acotar por sección (buscar dentro de la `<section>` "Gastado este mes" vía `aria-label`/selector) o filtrar por la prop `etiqueta`. Verificar la fila de ingresos por separado.
- Línea 151-162 (`estado sin datos`) y 178-193 (`riesgo`): cuentan/filtran `TarjetaResumenMoneda`; revisar que sigan inequívocos (mismo scoping por sección).

**`src/layouts/__tests__/AppShellLayout.spec.ts` y `AppShellLayout.independiente.spec.ts`**
- No afirman el **orden** del menú ni la presencia del link "Ingresos"; sus rutas de router incluyen `ingresos`/`bancos` pero no navegan por ese ítem. Deberían seguir verdes tras el reorden/eliminación. **Verificar** que ningún test dependa del botón "Salir" ni de la posición del FAB (el test del FAB usa `.boton-fab` por clase, no por posición → OK).

**`src/components/__tests__/TarjetaResumenMoneda.spec.ts`**
- No pasa `etiqueta`; con el default `'Gastado este mes'` sigue verde. Añadir 1 caso nuevo para la prop (abajo).

### Tests que NO se tocan
`TarjetaBalanceMoneda.spec.ts`, `useDashboard.spec.ts` / `.riesgo.spec.ts` (composable sin cambios), `HojaAccionesFab.spec.ts` (orden ya correcto, no se cambia el markup) y todo lo ajeno a estos módulos.

### Tests nuevos necesarios (criterios de aceptación)
- **FormularioGasto (alta)**: al montar en modo alta, `#moneda` = `'PEN'` y `#fecha` = fecha de hoy (usar `vi.setSystemTime` para fijar el día y comparar el `YYYY-MM-DD` local); ambos editables (cambiar a USD / otra fecha se envía correctamente). En modo edición, el default NO pisa el valor del gasto.
- **FormularioIngreso**: al montar, `#moneda-ingreso` = `'PEN'` y `#fecha-ingreso` = hoy; editable; camino feliz con defaults (sin setear fecha/moneda) crea el ingreso con `moneda: 'PEN'` y la fecha de hoy.
- **TarjetaResumenMoneda**: con `etiqueta="Ingresos este mes"`, `.etiqueta-resumen` muestra ese texto; sin la prop, muestra `'Gastado este mes'` (default no rompe fila 1).
- **DashboardView (layout 3×2)**: existen 3 secciones en orden — Gastado (2 resumen), Ingresos (2 resumen con `etiqueta="Ingresos este mes"`, `total` = ingresos del mes por moneda, `variacionPct=null` → "Sin variación", nunca flecha), Balance (2 `TarjetaBalanceMoneda`). Montar con ingresos PEN=X/USD=Y y comprobar que las tarjetas de ingresos toman `balancePorMoneda[moneda].ingresos`.
- **AppShellLayout (orden de menú)**: orden desktop exacto Dashboard → Registrar gasto → Historial → Bandeja → Presupuestos → Categorías → Bancos → Registrar ingreso (afirmar por texto en secuencia); no existe ítem de nav "Ingresos". Bottom nav: 6 rutas en orden Dashboard → Historial → Bandeja → Presupuestos → Categorías → Bancos; FAB presente y fuera de la lista. (El `overflow-x`/`flex-shrink` es CSS no verificable en jsdom → verificación visual/manual, no test.)

### Camino feliz / borde (resumen)
- **Feliz**: alta de gasto e ingreso arrancan con PEN + hoy y se guardan tal cual sin tocar esos campos.
- **Borde**: usuario cambia moneda a USD y/o edita la fecha → se guarda el valor editado (los defaults no fuerzan). La validación "falta fecha/moneda" sigue existiendo cuando el campo se vacía explícitamente. Fila de ingresos con ingresos=0 en una moneda → `0.00` + "Sin variación" sin flecha.

## Sugerencias fuera de alcance (NO incluidas en este build)
- Helper de fecha local repetido (`mesActual` en DashboardView, `primerDiaDeMesRelativo` en useDashboard, y ahora "hoy" en dos formularios). Podría extraerse un `hoyISO()` compartido, pero `useDashboard.ts` ya documenta la decisión de no extraer helper compartido en estos builds. Anotado, no se hace aquí.
- Decidir vía UX las ambigüedades #1 (eliminar link "Ingresos") y #2 (botón "Salir" en bottom nav) antes de mergear.
- Variación mes-anterior para ingresos: explícitamente fuera de alcance (`variacion-pct` siempre `null` en la fila de ingresos).
