# Micro-plan — Fix: selector de Banco muestra "No hay bancos" al abrir Nuevo gasto desde el Dashboard

## Patrón arquitectónico detectado

- **Carga de datos vía composables que hidratan stores Pinia.** Ninguna vista/componente llama a Supabase directo: siempre a través de un composable `useX` (`useBancos.cargarBancos`, `useCategorias.cargarCategorias`, etc.). Cada `cargar*` hace `establecerCargando(true)` → fetch a Supabase → `establecer*(data)` en el store → `establecerCargando(false)`. Devuelve `true`/`false`; **es fire-and-forget** (ninguna vista lo `await`ea en `onMounted`).
- **La hidratación se dispara en `onMounted` de la vista contenedora.** Cada vista carga en su `onMounted` lo que su template necesita: `HistorialView`/`IngresosView`/`BancosView` → `cargarBancos()`; `DashboardView`/`CategoriasView`/`BandejaView`/`PresupuestosView` → `cargarCategorias()`.
- **El catálogo de bancos vive en `stores/ingresos.ts`** (decisión de Architect: catálogo compartido entre dominios Ingresos y Gastos). `FormularioGasto.vue` lo lee reactivamente: `sinBancos = computed(() => storeIngresos.bancos.length === 0)` (línea 82), y asume que "la vista contenedora ya cargó los bancos" (comentario líneas 76-81).
- **`AppShellLayout.vue` es el layout privado padre de TODAS las vistas** (`<router-view />`, línea 199) y el **único** que hospeda `ModalGasto`/`ModalIngreso`/`HojaAccionesFab` (líneas 271-286). Se monta una vez al entrar a la zona privada y permanece montado toda la sesión, independientemente de la ruta hija. Hoy NO tiene `onMounted` ni carga datos.

El fix encaja en este patrón: solo cambia **dónde vive la llamada `cargar*`**, moviéndola al componente que realmente garantiza estar activo antes de que cualquier modal pueda abrirse.

## Desviación de arquitectura

- ¿Se necesita desviarse? **NO.**
- Justificación: el shell ya es un componente Vue con ciclo de vida propio; añadirle un `onMounted` que invoque `cargarBancos()` (y `cargarCategorias()`) usa exactamente el mismo patrón "onMounted → composable → store" que ya usan 7 vistas. No introduce patrón nuevo, no cambia el modelo de datos, no toca el contrato de los stores ni de los composables, no acopla módulos que antes no se conocían (el shell ya importa varios stores/composables). Es una **corrección de ubicación** de una llamada de carga, no un rediseño. **No dispara GATE 1.**

## Decisión 1 — ¿quitar las llamadas `cargarBancos()` redundantes de las vistas?

**Recomendación: MANTENERLAS (no tocarlas en este fix).**

- **No hay dependencia síncrona que se rompa.** Revisé `HistorialView`, `IngresosView` y `BancosView`: en las tres, `cargarBancos()` es fire-and-forget dentro de `onMounted` (no se `await`ea) y el resultado se consume siempre de forma **reactiva** (`storeIngresos.bancos` en templates/computed: `FiltrosHistorial :bancos`, `nombreBanco()`, `v-if="storeIngresos.bancos.length > 0"`). Ninguna vista lee el retorno de `cargarBancos()` inmediatamente después de llamarlo. Es decir, quitarlas sería *correcto*, no rompería nada de forma síncrona.
- **Pero quitarlas está fuera del alcance del bug y amplía el radio de impacto:**
  1. El shell se monta **una sola vez** por sesión, así que su `cargarBancos()` corre una vez. Las llamadas por-vista son hoy el **único** mecanismo de *refresh en sesión* del catálogo (re-fetch al navegar a esas vistas, útil en multi-dispositivo). Eliminarlas cambia esa semántica de frescura.
  2. Los tests de esas vistas hoy asumen/estuban el fetch de bancos en su `onMounted`; quitarlo obligaría a tocar esos specs sin necesidad para cerrar el bug.
- Conclusión: el re-fetch redundante es barato e inofensivo; el ahorro de un fetch por visita no compensa el riesgo/ruido en un cambio cuyo objetivo es corregir un bug. Si se quiere optimizar, hágase como tarea aparte.

## Decisión 2 — ¿aplicar el mismo fix estructural a `cargarCategorias()`?

**Recomendación: SÍ, incluir `cargarCategorias()` en el `onMounted` del shell en este mismo cambio** (marcable como descartable si el orquestador prefiere minimalismo estricto).

- Justificación: `categorias` sufre **exactamente la misma clase de bug latente**. `FormularioGasto` lee `sinCategorias = computed(() => categoriasActivas.value.length === 0)` (línea 74) y muestra "No hay categorías; créalas primero." (línea 176) bajo el mismo supuesto "la vista ya cargó". Hoy "funciona" solo por accidente: la home (`DashboardView`) llama `cargarCategorias()`. El día que una vista nueva sea home, o que el modal se abra en un flujo donde ninguna vista previa cargó categorías, reaparece el mismo falso negativo.
- Cargarlo desde el shell (misma línea, mismo archivo, mismo patrón) **cierra la clase de bug de raíz** para bancos Y categorías de forma simétrica, con costo marginal cero.
- Igual que con bancos: **mantener** los `cargarCategorias()` existentes en las vistas (mismo argumento de frescura y de no ensanchar el diff).

## Archivos a crear/modificar

- `src/layouts/AppShellLayout.vue` — **modificar** — en `<script setup>`:
  - importar `onMounted` de `vue`, `useBancos` de `@/composables/useBancos` y `useCategorias` de `@/composables/useCategorias`.
  - desestructurar `const { cargarBancos } = useBancos()` y `const { cargarCategorias } = useCategorias()`.
  - añadir `onMounted(() => { cargarBancos(); cargarCategorias() })` (fire-and-forget, igual que las vistas). Documentar con comentario por qué vive aquí (único componente garantizado activo antes de abrir cualquier modal). **No** tocar template ni estilos. **No** quitar nada de las vistas.

- `src/layouts/__tests__/AppShellLayout.spec.ts` — **modificar** — añadir el nuevo `describe` de regresión del bug (ver plan de pruebas). Además, como el shell ahora hace fetch real a Supabase en `onMounted`, hay que **mockear `@/lib/supabaseClient`** en este archivo (stub de `supabase.from(...).select().order()`) para que los tests existentes (bottom nav, orden de menú, HU-9.1) no disparen red real ni promesas colgadas.

- `src/layouts/__tests__/AppShellLayout.independiente.spec.ts` — **modificar** — mismo mock de `@/lib/supabaseClient` (su `montarShell` también monta el shell y ahora dispararía el fetch).

Chunks: los 3 archivos de test tocan puntos independientes pero **todos dependen** del cambio en `AppShellLayout.vue`; hacer primero el `.vue`, luego los specs (los specs pueden ir en paralelo entre sí).

## Plan de pruebas

Test principal (regresión del bug reportado por QA), en `AppShellLayout.spec.ts`:

- **Reproduce el bug / camino feliz del fix:** montar `AppShellLayout` en la ruta `/` (dashboard) **sin** haber montado antes ninguna vista que cargue bancos, con `storeIngresos.bancos` vacío inicialmente y con `supabase.from('bancos')` stubeado para devolver ≥1 banco. Tras el `onMounted` + flush de promesas (`await flushPromises()` / `await vm.$nextTick()`), abrir el modal de gasto (click en `.boton-fab` → `HojaAccionesFab` → registrar gasto, o setear `modalGastoAbierto`) y verificar que:
  - `storeIngresos.bancos.length > 0` (el shell hidrató el store), y
  - el `FormularioGasto` NO muestra el `<p role="alert">` con "No hay bancos; créalos primero." y el `<select#banco>` no está `disabled`.
- **Camino feliz simétrico (categorías):** con `supabase.from('categorias')` devolviendo ≥1 categoría activa, tras montar el shell `storeGastos.categorias.length > 0` y el formulario de gasto no muestra "No hay categorías; créalas primero.".
- **Borde/error:** con `supabase.from('bancos')` devolviendo `[]` (usuario realmente sin bancos), el mensaje "No hay bancos; créalos primero." SÍ debe aparecer (el fix no oculta el estado legítimo vacío) y el submit queda `disabled`.
- **Borde:** el shell llama `cargarBancos`/`cargarCategorias` **exactamente una vez** en su `onMounted` (spy sobre los composables) — documenta que el shell es punto de carga único de sesión.

Criterios de aceptación (no vinieron HU con Gherkin; derivados del reporte de QA):
- Dado un usuario con bancos creados en BD, cuando abre "Nuevo gasto" desde el Dashboard recién cargado sin haber visitado Historial/Bancos/Ingresos, entonces el selector de Banco lista sus bancos y no muestra "No hay bancos; créalos primero.".
- Mismo escenario para categorías (blindaje preventivo).

Nota: no es necesario un test end-to-end con navegación entre vistas; basta montar el shell (que es donde ahora vive la carga) y comprobar el estado del store + el render de `FormularioGasto`.

## Sugerencias fuera de alcance (no incluir en el build)

- Optimización futura: eliminar los `cargarBancos()`/`cargarCategorias()` redundantes de las vistas y centralizar toda la hidratación de catálogos compartidos (bancos, categorías) en el shell, definiendo explícitamente la política de refresh (p. ej. re-fetch on-focus). Requiere ajustar los specs de esas vistas; hacerlo como tarea propia.
