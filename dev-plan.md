# Micro-plan — HU-5.5: mostrar última ejecución de la ingesta automática en la Bandeja

> Reemplaza el micro-plan de la Épica 9 (Versionado), ya construida.
> Especificación técnica ya decidida por Architect y Data; se aplica tal cual.
> Este documento ordena la ejecución, detecta el patrón vigente y marca las
> discrepancias reales que el builder debe resolver siguiendo el CÓDIGO existente.

## Patrón arquitectónico detectado

Frontend Vue 3 + Vite + TS (strict) + Pinia; composables por sub-dominio:
- `src/composables/useBandeja.ts` encapsula TODAS las llamadas a Supabase del dominio Bandeja (Épica 5). Cada función: pone `cargando`, limpia error, hace `supabase.from(...)`, y ante `error` de Supabase escribe un mensaje en español en `useGastosStore` y devuelve `boolean`. Un resultado vacío NO es error.
- `src/stores/gastos.ts` es la fuente única de verdad; los composables escriben ahí vía acciones. No hay estado de "ingesta" aún.
- `src/views/BandejaView.vue` dispara `cargarCategorias()` + `cargarBorradores()` en `onMounted`, y renderiza banner + lista + estado vacío con clases scoped y variables de `estilos-base.css`.
- Formateo de fechas: `Intl.DateTimeFormat('es-PE', {...})` (ver `GraficoTendenciaMensual.vue:33`) y `new Date(...)` directo. No existe util compartido de "fecha relativa": se formatea inline por vista/componente.

Backend Edge Functions (Deno) en `supabase/functions/<nombre>/index.ts`:
- `importar-borrador/index.ts` es la referencia directa. Estructura: helpers `cabecerasJson` + `respuestaJson(cuerpo, status)`; `Deno.serve(async req => {...})`; método != POST → 405; autentica comparando el bearer contra un secreto de env; lee env (`GASTORIN_USUARIO_ID`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`); crea `createClient(url, claveServicio)`; y ante error de escritura responde con motivo genérico SIN filtrar `error.message` (ej. `'no se pudo guardar el gasto'`).

Migraciones versionadas en `supabase/migrations/NNN_*.sql`; se aplican a producción manualmente (Gianmarco), el archivo solo versiona el SQL. Ya existen 001, 002, 003; sigue la 004.

Tests: en `__tests__/` colindante, `*.spec.ts`, Vitest. Mock manual de Supabase en `src/lib/__mocks__/supabaseClient.ts` con `crearConstructorConsulta()` encadenable (cada método es `vi.fn(()=>builder)`; se resuelve un eslabón con `mockResolvedValueOnce({data,error})`). El spec de la Edge Function mockea `createClient` y stubea `globalThis.Deno`.

## Desviación de arquitectura

- ¿Se necesita desviarse? **NO.** Todo encaja en el patrón: migración numerada, Edge Function calcada de `importar-borrador`, función nueva en `useBandeja` con la misma firma/estilo, y bloque de UI en `BandejaView.vue` reusando clases y variables ya definidas. Tabla nueva independiente (no cambia el modelo existente), no acopla >1 módulo, no introduce patrón nuevo. **No dispara GATE 1.**

### Discrepancias a resolver durante el build (ambigüedad de la consigna, NO desviación; el builder sigue el CÓDIGO real)

1. **Nombre del secreto del bearer.** La consigna dice "el mismo `IMPORTAR_BORRADOR_TOKEN` que ya usa `importar-borrador`", pero `importar-borrador/index.ts:37-40` NO usa `IMPORTAR_BORRADOR_TOKEN`: compara el bearer contra `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')`. Para usar "el mismo bearer que importar-borrador" de verdad, la nueva función debe comparar contra **`SUPABASE_SERVICE_ROLE_KEY`** (mismo patrón, mismo secreto real). No inventar una env nueva sin configurar. Si el intent fuera un token dedicado distinto, requeriría añadir el secreto en Supabase → fuera del alcance de código; anotarlo, no asumirlo.
2. **Código "no rows" de PostgREST.** El "no hay fila" de `.single()` en supabase-js llega como `error.code === 'PGRST116'` (no como `data:null, error:null`). `cargarEstadoIngesta` debe tratar ese code específico como caso válido → `null`, y solo considerar fallo un `error` con otro `code`.

## Archivos a crear/modificar

Chunks A, B y C son independientes (no se solapan) → paralelizables. D depende de C.

**Chunk A — Migración (independiente)**
- `supabase/migrations/004_estado_ingesta.sql` — **crear** — SQL exacto provisto por Data (tabla `estado_ingesta`: PK `usuario_id` → `auth.users(id) on delete cascade`, `ultima_ejecucion_en timestamptz not null`; RLS on; policy `estado_ingesta_solo_lectura_propia` for select using `usuario_id = auth.uid()`). Cabecera-comentario al estilo de 003 ("Diseño: Data. Pendiente de aplicar a producción."). NO aplicar a producción.

**Chunk B — Edge Function (independiente)**
- `supabase/functions/registrar-ejecucion-ingesta/index.ts` — **crear** — calcar estructura de `importar-borrador/index.ts`:
  - `respuestaJson` + `cabecerasJson`.
  - método != POST → 405.
  - Auth: bearer vs `SUPABASE_SERVICE_ROLE_KEY` (ver discrepancia #1); no coincide → 401 `{status:'error', motivo:'no autorizado'}`.
  - Sin payload requerido: NO parsear/validar body como obligatorio; no debe fallar si no viene body.
  - Leer `GASTORIN_USUARIO_ID` (500 si falta) y `SUPABASE_URL` (500 si falta).
  - `createClient(url, claveServicio)`; `supabase.from('estado_ingesta').upsert({ usuario_id: usuarioId, ultima_ejecucion_en: new Date().toISOString() })` (upsert sobre PK `usuario_id`).
  - Éxito → 201 `{status:'registrado'}`. Error de escritura → 500 con motivo genérico (sin filtrar `error.message`).
- `supabase/functions/registrar-ejecucion-ingesta/__tests__/index.spec.ts` — **crear** — mismo andamiaje que `importar-borrador/__tests__/index.spec.ts`. Casos: 201 `registrado` en upsert ok (verificar que el `upsert` recibió el `usuario_id` fijo del servidor y un `ultima_ejecucion_en`); 401 con bearer inválido; 405 con GET; 500 si el upsert devuelve `error`.

**Chunk C — Composable (independiente)**
- `src/composables/useBandeja.ts` — **modificar** — añadir y exportar `cargarEstadoIngesta()`:
  - `supabase.from('estado_ingesta').select('ultima_ejecucion_en').eq('usuario_id', <uid>).single()`. Para el `uid`: NO tocar `useAuth`/`stores/auth` (prohibido). Preferir la vía de menor acoplamiento — apoyarse en RLS (que ya restringe a la fila propia) usando el id de la sesión de `supabase.auth` directamente si es necesario para el `.eq`, o mantener el `.eq('usuario_id', ...)` como pide la HU. Documentar la decisión en comentario.
  - Manejo de resultado: `error?.code === 'PGRST116'` (no rows) → devolver `null` SIN marcar error; `error` con otro code → devolver `null` sin romper la vista; ok → `data?.ultima_ejecucion_en ?? null`.
  - Firma sugerida: `async function cargarEstadoIngesta(): Promise<string | null>`. NO ampliar `useGastosStore` para este dato de presentación puntual: la vista guarda el valor en un `ref` local. Añadirla al `return`.
- `src/composables/__tests__/useBandeja.spec.ts` — **modificar** — nuevo `describe('cargarEstadoIngesta')`: (1) feliz → devuelve el timestamp; (2) no rows `error.code='PGRST116'` → `null` sin error; (3) error real (otro code) → `null` sin lanzar. Resolver el `single` con `mockResolvedValueOnce({data,error})`.

**Chunk D — UI (depende de C)**
- `src/views/BandejaView.vue` — **modificar**:
  - `onMounted`: además de las 2 llamadas actuales, `cargarEstadoIngesta()` y guardar el resultado en un `ref<string | null>` local (ej. `ultimaEjecucion`).
  - `computed` para los 3 casos de HU-5.5 comparando con `Date.now()`:
    - `null` → texto neutral "Aún no se ha ejecutado la revisión automática".
    - dentro de 48h → "Última revisión: [fecha formateada]" neutral.
    - > 48h (`Date.now() - Date(ultimaEjecucion) > 48*60*60*1000`) → mismo texto con indicador de advertencia.
  - Formateo con `Intl.DateTimeFormat('es-PE', { dateStyle:'medium', timeStyle:'short' })` (o equivalente), consistente con el uso de `Intl` en el proyecto.
  - Colocar el bloque cerca del `p.banner-bandeja`. Reusar el look de banner; para >48h aplicar `--color-advertencia` / `--color-advertencia-fondo` (ya en `estilos-base.css:19-20`) vía una clase modificadora scoped (ej. `.estado-ingesta--alerta`). Añadir una clase/marca estable para los tests (ej. `.estado-ingesta`).
  - NO tocar la lógica de borradores/banner/estado-vacío existente.
- `src/views/__tests__/BandejaView.spec.ts` — **modificar** — los 3 tests actuales deben seguir pasando: ahora `onMounted` hace una consulta extra a `estado_ingesta`; ajustar el `fromMock.mockImplementation` para contemplar `tabla === 'estado_ingesta'` devolviendo un builder cuyo `single` resuelva lo que cada caso necesite. Añadir 3 casos nuevos (usar `vi.setSystemTime`, precedente `DashboardView.spec.ts:64`): sin ejecución (single → PGRST116 / `data:null`) muestra "Aún no se ha ejecutado…"; ejecución < 48h muestra "Última revisión: …" sin clase de alerta; ejecución > 48h muestra el texto con la clase/indicador de advertencia.

## Plan de pruebas

- **Camino feliz (UI):** fila reciente (< 48h) → "Última revisión: [fecha/hora]" neutral; borradores intactos.
- **Camino feliz (Edge):** POST con bearer correcto → 201 `{status:'registrado'}`; el upsert usa `usuario_id` fijo del servidor + `ultima_ejecucion_en` ≈ ahora.
- **Camino feliz (composable):** `cargarEstadoIngesta` devuelve el `ultima_ejecucion_en` cuando hay fila.
- **Borde/error:**
  - Sin fila (`PGRST116`): composable → `null` sin error; UI muestra "Aún no se ha ejecutado la revisión automática".
  - Ejecución > 48h: UI con indicador `--color-advertencia`.
  - Edge: bearer inválido → 401; GET → 405; error de upsert → 500 con motivo genérico (sin filtrar detalle interno).
  - Error real de Supabase en `cargarEstadoIngesta` (code != PGRST116) → `null` sin romper el render de la Bandeja.
- **Criterios de aceptación HU-5.5 (3 escenarios como casos de `BandejaView.spec.ts`):**
  1. Sin ejecución previa → mensaje neutral "Aún no se ha ejecutado la revisión automática".
  2. Ejecución dentro de 48h → "Última revisión: [fecha]" neutral, sin advertencia.
  3. Ejecución > 48h → mismo texto con indicador visual de advertencia (`--color-advertencia`).

## Notas / fuera de alcance (no meter al build)

- `npm run build` al final; reportar el resultado exacto (lo hace el builder).
- **Falta aplicar la migración 004 a producción** (manual, Gianmarco) — avisar al orquestador al terminar.
- Actualización del prompt de la tarea programada `gastorin-ingesta-diaria` para llamar a la nueva Edge Function: FUERA de alcance (orquestador, herramienta de tareas programadas).
- Sugerencia (fuera de alcance): si a futuro los secretos de Edge Functions deben divergir del service-role key, introducir un token dedicado por función y documentarlo en `.env.example`/config de Supabase. Hoy no aporta y añade superficie de configuración.
