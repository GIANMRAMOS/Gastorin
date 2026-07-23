# Micro-plan — Resolver banco por nombre (`banco_nombre`) en `importar-borrador`

## Patrón arquitectónico detectado
Edge Function de Supabase (Deno) con separación clara en dos archivos:

- `index.ts`: handler HTTP (auth por bearer, parseo, orquestación de queries a
  Supabase, inserción). Contiene la lógica que toca red/DB.
- `logica.ts`: helpers **puros** (`validarPayload`, `resolverEstado`) y el tipo
  `PayloadImportarBorrador`. No importa Deno ni supabase-js — testeable con Vitest sin runtime.
- `__tests__/index.spec.ts`: mockea `createClient` y `Deno`, captura el handler y
  ejercita el flujo completo con builders de query encadenados (`select().eq().eq().single()`).

Convenciones ya establecidas que esta tarea debe seguir:
- Resolución de FK "opcional": *tomar el id del payload si viene; si no, buscar por nombre
  el registro de respaldo del usuario fijo*. Ya se aplica idéntico para `categoria_id` →
  "Otros" (líneas 83-99) y para `banco_id` → "No especificado" (líneas 101-119).
- Los nombres de respaldo son constantes al tope del archivo (`NOMBRE_BANCO_NO_ESPECIFICADO`).
- Validación de tipos de opcionales centralizada en `validarPayload`:
  `if (payload.x != null && typeof payload.x !== 'string') return { valido:false, motivo:'validación' }`.
- El `usuario_id` SIEMPRE es el fijo del servidor (`GASTORIN_USUARIO_ID`).

Esta feature encaja exactamente en el patrón: extiende el bloque de resolución de banco
existente (líneas 101-119 de `index.ts`), sin tocar capas ni introducir estructuras nuevas.

## Desviación de arquitectura
- ¿Se necesita desviarse? **NO.**
- La feature reutiliza el patrón de resolución de FK opcional. Solo agrega un paso intermedio
  (buscar por nombre) antes del respaldo ya existente. No cambia el modelo de datos
  (`banco_nombre` NO se persiste; es solo entrada del payload para resolver `banco_id`), no
  afecta a otros módulos, no introduce un patrón nuevo. **No dispara GATE 1.**

## Archivos a crear/modificar
- `supabase/functions/importar-borrador/logica.ts` — modificar — agregar `banco_nombre?: unknown`
  al interface `PayloadImportarBorrador` y su validación de tipo en `validarPayload`.
- `supabase/functions/importar-borrador/index.ts` — modificar — reemplazar el bloque de
  resolución de banco (líneas 101-119) por el bloque de "Código exacto" de abajo.
- `supabase/functions/importar-borrador/__tests__/index.spec.ts` — modificar — extender el
  mock de `bancos` para soportar `.ilike().maybeSingle()` y llamadas secuenciales, y agregar
  los casos nuevos.

Los tres archivos son la misma feature; **no** paralelizar. Orden: logica.ts → index.ts → tests.

## Código exacto

### 1. `logica.ts`

En el interface `PayloadImportarBorrador`, junto a `banco_id?: unknown`:
```ts
  banco_id?: unknown
  banco_nombre?: unknown
```

En `validarPayload`, justo después del bloque de `banco_id` (tras la línea 65):
```ts
  if (payload.banco_nombre != null && typeof payload.banco_nombre !== 'string') {
    return { valido: false, motivo: 'validación' }
  }
```

### 2. `index.ts` — reemplaza el bloque de las líneas 101-119 por:
```ts
  // --- Resuelve el banco. Prioridad de mayor a menor:
  //   1) payload.banco_id explícito: se usa tal cual (se confía; el FK de la BD
  //      lo rechaza si es inválido). Gana sobre banco_nombre si ambos vienen.
  //   2) payload.banco_nombre: busca el banco del usuario fijo por nombre,
  //      case-insensitive (la tabla tiene índice único sobre lower(nombre)).
  //   3) Respaldo "No especificado" del usuario fijo: cuando no vino banco_id, y
  //      además no vino banco_nombre O el nombre pedido no existe en el catálogo.
  // El fallback a "No especificado" es SILENCIOSO a propósito: un proceso
  // automático de ingesta no debe fallar toda la importación de un correo solo
  // porque el usuario aún no creó ese banco en su catálogo.
  let bancoId = typeof payload.banco_id === 'string' ? payload.banco_id : null

  if (!bancoId && typeof payload.banco_nombre === 'string' && payload.banco_nombre.trim() !== '') {
    // `.ilike` con el nombre literal (sin comodines añadidos) => comparación
    // exacta case-insensitive, coherente con el índice único sobre lower(nombre).
    // `.maybeSingle()` para que "no encontrado" devuelva data=null SIN error.
    const { data: bancoPorNombre } = await supabase
      .from('bancos')
      .select('id')
      .eq('usuario_id', usuarioId)
      .ilike('nombre', payload.banco_nombre)
      .maybeSingle()
    if (bancoPorNombre) {
      bancoId = bancoPorNombre.id as string
    }
  }

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

Nota para el builder: `.ilike('nombre', valor)` interpreta `%` y `_` como comodines LIKE.
Los nombres de banco reales ("BCP Debito", "IBK Debito") no los contienen, así que es
aceptable. Escapar comodines queda **fuera de alcance** (ver sugerencias).

## Plan de pruebas
Alineado con el mock de `__tests__/index.spec.ts`.

**Prerrequisito de mocks (ajuste técnico):** `crearBuilderSelect` hoy solo modela
`.select().eq().eq().single()`. Para los casos con `banco_nombre` hay que:
- Extender el builder de `bancos` para soportar también `.select().eq().ilike().maybeSingle()`.
- Permitir dos llamadas secuenciales a `bancos` en un mismo request (primero lookup por
  nombre, luego fallback "No especificado"), resolviendo con `mockResolvedValueOnce` en orden.
- Opción simple: builder de `bancos` que exponga tanto `eq(...).ilike(...).maybeSingle()`
  como `eq(...).eq(...).single()`, con un mock dedicado `selectBancoPorNombreMock` para el
  path `ilike` y el `selectBancoMock` existente para el respaldo.

Casos:

- **Camino feliz — `banco_nombre` encontrado case-insensitive:** payload sin `banco_id`,
  con `banco_nombre: 'ibk debito'`; el lookup por nombre resuelve `{ data: { id: 'banco-ibk-id' } }`.
  Espera 201, `insertArg.banco_id === 'banco-ibk-id'`, y que NO se consultó el fallback
  "No especificado" (una sola resolución de banco).

- **`banco_id` explícito gana sobre `banco_nombre`:** payload con AMBOS `banco_id: 'banco-x'`
  y `banco_nombre: 'BCP Debito'`. Espera 201, `insertArg.banco_id === 'banco-x'`, y que
  `fromMock` NO consultó la tabla `bancos` en absoluto (ni por nombre ni respaldo).

- **Borde — `banco_nombre` NO encontrado cae a "No especificado" sin error:** payload sin
  `banco_id`, con `banco_nombre: 'Banco Inexistente'`; lookup por nombre resuelve
  `{ data: null }` (maybeSingle, sin error) y el fallback resuelve `{ id: 'banco-no-esp-id' }`.
  Espera 201, `insertArg.banco_id === 'banco-no-esp-id'`, `res.status` != 400, y dos
  consultas a `bancos` en orden (ilike, luego eq).

- **Sin cambios — ninguno de los dos viene (comportamiento actual):** ya cubierto por los
  tests existentes "sin banco_id, resuelve el banco No especificado" y "sin banco No
  especificado -> 400". Confirmar que siguen pasando (solo pueden requerir ajuste del builder mock).

- **Validación (nuevo, opcional):** `banco_nombre` de tipo no-string (ej. número) => 400
  `validación`, sin ejecutar insert (espeja el patrón de `banco_id`; test en `logica.spec.ts`).

## Sugerencias fuera de alcance (no incluidas en el plan)
- Escapar comodines LIKE (`% _ \`) en `banco_nombre` antes del `.ilike`, si se quiere robustez
  ante nombres de banco con esos caracteres.
- Persistir el nombre crudo recibido / telemetría de cuántas importaciones cayeron al fallback
  por nombre no encontrado (útil para detectar catálogos incompletos) — decisión de producto.
