# Micro-plan — Fix: resolver `banco_id` en importar-borrador (usar banco de respaldo "No especificado")

## Patrón arquitectónico detectado
La Edge Function `supabase/functions/importar-borrador/index.ts` sigue un patrón muy explícito y ya establecido para las FK obligatorias del `insert` en `gastos`:

1. Tomar el id del payload si viene y es `string`; si no, resolver un valor de respaldo por usuario fijo consultando su propia tabla con `.select('id').eq('usuario_id', usuarioId).eq('nombre', <NOMBRE>).single()`.
2. Si la consulta de respaldo falla o no devuelve fila, cortar con `respuestaJson({ status: 'error', motivo: '...' }, 400)` (motivo legible, no 500).
3. Usar el id resuelto en el objeto del `insert`.

Esto ya existe para `categoria_id` (líneas 81-97) usando la categoría `'Otros'` del usuario fijo, con la constante `NOMBRE_CATEGORIA_OTROS`. La resolución de `banco_id` debe ser una copia estructural de ese bloque, apoyada en el banco `'No especificado'` que la migración `006_gastos_banco_id.sql` (paso 1) ya sembró por usuario en la tabla `bancos` (definida en `005_bancos_e_ingresos.sql`).

Los helpers puros (validación, tipos) viven en `logica.ts`; el tipo `PayloadImportarBorrador` declara los campos opcionales del body y `validarPayload` valida tipos de los opcionales (ej. `categoria_id` debe ser `string` si viene). El banco de respaldo se sembró con el literal exacto `'No especificado'`, por lo que `.eq('nombre', 'No especificado')` (match exacto, igual que `'Otros'`) es correcto.

## Desviación de arquitectura
- ¿Se necesita desviarse? **NO.**
- El fix encaja de forma natural en el patrón ya establecido para `categoria_id`. No cambia el modelo de datos, no introduce un patrón nuevo, no afecta a más de un módulo. Es el mínimo para desbloquear la ingesta (los 11 gastos rechazados hoy con HTTP 500). La inferencia real de banco desde el contenido del correo (Épica 5) queda **fuera de alcance** y NO se toca aquí.
- No dispara GATE 1.

## Archivos a crear/modificar

### 1. `supabase/functions/importar-borrador/index.ts` — modificar
Chunk A.

**A.1 — Agregar constante** junto a `NOMBRE_CATEGORIA_OTROS` (tras la línea 26):
```ts
/** Nombre del banco de respaldo cuando el payload no trae `banco_id` (sembrado por la migración 006). */
const NOMBRE_BANCO_NO_ESPECIFICADO = 'No especificado'
```

**A.2 — Insertar el bloque de resolución de banco** justo después de la resolución de categoría (después de la línea 97, antes de `const estado = resolverEstado(payload)`):
```ts
  // --- Resuelve el banco: el del payload, o "No especificado" del usuario fijo. ---
  // Mínimo para desbloquear la ingesta tras la migración 006 (gastos.banco_id NOT NULL).
  // La inferencia de banco desde el correo (Épica 5) queda fuera de alcance.
  let bancoId = typeof payload.banco_id === 'string' ? payload.banco_id : null
  if (!bancoId) {
    const { data: bancoRespaldo, error: errorBanco } = await supabase
      .from('bancos')
      .select('id')
      .eq('usuario_id', usuarioId)
      .eq('nombre', NOMBRE_BANCO_NO_ESPECIFICADO)
      .single()
    if (errorBanco || !bancoRespaldo) {
      return respuestaJson(
        { status: 'error', motivo: 'no existe el banco "No especificado" para el usuario' },
        400,
      )
    }
    bancoId = bancoRespaldo.id as string
  }
```

**A.3 — Añadir `banco_id` al objeto del `insert`** en `.from('gastos').insert({ ... })` (dentro del bloque de las líneas 103-114), junto a `categoria_id`:
```ts
      banco_id: bancoId,
```

### 2. `supabase/functions/importar-borrador/logica.ts` — modificar
Chunk A (mismo cambio lógico que el índice; buildear junto).

**A.4 — Declarar el campo en el tipo** `PayloadImportarBorrador` (tras `categoria_id?: unknown`, línea 22):
```ts
  banco_id?: unknown
```

**A.5 — Validar su tipo si viene** en `validarPayload`, análogo a `categoria_id` (tras la línea 61):
```ts
  if (payload.banco_id != null && typeof payload.banco_id !== 'string') {
    return { valido: false, motivo: 'validación' }
  }
```

### 3. `supabase/functions/importar-borrador/__tests__/index.spec.ts` — modificar
Chunk B (depende de A: escribir después de que exista el nuevo comportamiento).

El mock de Supabase hoy solo conoce `categorias` (select por doble `eq` -> `single`, vía `selectSingleMock`) y todo lo demás lo trata como builder de `insert`. Con el fix, **todo insert de `gastos` sin `banco_id` disparará ahora una consulta a `bancos`** con la misma forma que la de `categorias`. Hay que:

- **Generalizar** `crearBuilderSelectCategoria()` a `crearBuilderSelect(singleMock)` (misma cadena `select -> eq -> eq -> single`, pero recibiendo el mock a usar).
- Renombrar `selectSingleMock` -> `selectCategoriaMock` y **agregar** `const selectBancoMock = vi.fn()`.
- En `fromMock`: `if (tabla === 'categorias') return crearBuilderSelect(selectCategoriaMock); if (tabla === 'bancos') return crearBuilderSelect(selectBancoMock); return crearBuilderInsert()`.
- En **cada test del flujo feliz que llega al insert** (los 5: "usuario_id se ignora", "idempotencia", "no-23505 -> 500", "sin categoria_id", "ambiguo") agregar `selectBancoMock.mockResolvedValueOnce({ data: { id: 'banco-no-esp-id' }, error: null })`. Los tests 401 y "400 payload inválido" NO llegan al banco y no cambian.
- El test "sin categoria_id" pasa a usar `selectCategoriaMock` para la categoría y `selectBancoMock` para el banco (ya no comparten el mismo `vi.fn`).

**Nuevos casos a agregar:**
- Test: "sin banco_id, resuelve el banco 'No especificado' del usuario FIJO" — provee `categoria_id` pero no `banco_id`; `selectBancoMock` devuelve `{ id: 'banco-no-esp-id' }`; assertar `insertArg.banco_id === 'banco-no-esp-id'` y que `fromMock` fue llamado con `'bancos'`.
- Test: "sin banco 'No especificado' para el usuario -> 400 con motivo claro" — `selectBancoMock.mockResolvedValueOnce({ data: null, error: { message: 'no rows' } })`; assertar `res.status === 400`, `cuerpo.motivo` contiene `No especificado`, y `insertMock` NO fue llamado. Análogo al patrón de la categoría faltante.

## Plan de pruebas
- **Camino feliz (payload con banco_id):** el `insert` usa el `banco_id` del payload tal cual; devuelve 201 `creado`.
- **Camino feliz (payload sin banco_id):** resuelve el banco `'No especificado'` del usuario fijo y lo usa en el `insert` -> 201 `creado` con `banco_id` = id del banco de respaldo. (Nuevo test).
- **Borde/error — banco de respaldo ausente:** no existe banco `'No especificado'` para el usuario -> 400 con motivo `no existe el banco "No especificado" para el usuario`, sin ejecutar el `insert`. (Nuevo test).
- **Regresión — categoría de respaldo:** el flujo existente de `'Otros'` sigue funcionando (test "sin categoria_id" ya presente, ajustado por el mock de `bancos`).
- **Regresión — idempotencia:** reimporte (23505) sigue devolviendo 200 `omitido` (con banco resuelto antes del insert).
- **Regresión — error no-unicidad:** un error de Postgres distinto de 23505 sigue propagándose como 500.
- **Regresión — auth y validación:** 401 con bearer inválido y 400 con payload sin `gmail_message_id` no cambian (no llegan al lookup de banco).
- **Validación de tipo:** si `banco_id` viene con tipo no-string, `validarPayload` responde 400 `validación` (cubierto por A.5; opcional añadir test en `logica.spec.ts`).

## Notas / sugerencias fuera de alcance (no implementar aquí)
- Inferencia real del banco desde el contenido del correo (Épica 5) — pendiente, decisión de Architect.
- El `heartbeat` (`registrar-ejecucion-ingesta`) no toca `gastos`; confirmado que NO se ve afectado por este bug ni por este fix.
