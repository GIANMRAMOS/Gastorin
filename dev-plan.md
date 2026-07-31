# Micro-plan — Banco editable con sugerencia por historial de comercio en el panel de revisión (Bandeja)

> Sobrescribe el `dev-plan.md` anterior (carril de acciones de `TablaMovimientos.vue`, ya construido).
> Migración `supabase/migrations/012_reglas_comercio_banco.sql` verificada: existe como archivo (línea 21-22, `add column banco_id uuid references bancos(id) on delete set null`) y está declarada como aplicada a producción. No hay migración nueva en este build.

## Patrón arquitectónico detectado

Todo lo que pide la HU ya tiene un precedente literal en el mismo código, en la misma capa:

- **Capas (CLAUDE.md):** `types/*.ts` espejo de tablas → `composables/use*.ts` única puerta a Supabase → `stores/*.ts` verdad en memoria → `views/`+`components/`. `PanelDetalleBorrador.vue` es la excepción declarada y ya vigente: su propio comentario de cabecera (líneas 11-22) dice *"el componente es responsable de su propia IO"* y llama directo a `useBandeja()`/`useReglasComercio()` (líneas 36-37). No inventa nada: solo consume composables, nunca `supabase.from()`.
- **Mecanismo de sugerencia por comercio (a extender, no a copiar):** `useReglasComercio.ts` → `buscarReglaPorComercio` (líneas 53-68), `contarCargosComercio` (77-90), `guardarRegla` (98-116). El panel lo consume en `onMounted` (líneas 65-78) para preseleccionar, y en `confirmar()` (líneas 159-165) para hacer el upsert **después** de que el gasto ya se confirmó. Regla de oro documentada del composable (líneas 15-21): **ninguna acción de este dominio escribe en `store.error`** — un fallo degrada a "sin sugerencia", nunca dispara el banner global de la Bandeja.
- **Estado local transitorio del panel:** un `ref` por campo, inicializado desde la prop (`montoEditado` 44, `monedaEditada` 45, `categoriaSeleccionadaId` 52), persistido **solo al confirmar** en un único UPDATE (líneas 147-153). El aislamiento entre borradores lo garantiza `:key="borradorSeleccionado.id"` en `BandejaView.vue` línea 122 (remount completo), ya cubierto por test.
- **Patrón de `<select>` de banco (referencia pedida):** `FormularioGasto.vue` líneas 196-205 — `<label for>` + `<select class="entrada" :disabled="sinBancos">` + `v-for="banco in storeIngresos.bancos"`, con `sinBancos` computed en línea 84 y el store importado directo en el componente (líneas 6 y 49). **Ése es el patrón exacto a replicar.**
- **Catálogo de bancos:** vive en `stores/ingresos.ts` (`bancos`, línea 13), lo carga `useBancos.cargarBancos()`. `BandejaView.onMounted` ya lo dispara (línea 32). El panel **no** debe volver a cargarlo.

## Desviación de arquitectura

**¿Se necesita desviarse? NO.** Confirmo tu expectativa: es extender un mecanismo existente en su misma capa. No cambia el modelo de datos (la migración 012 ya está), no introduce patrón nuevo, no toca RLS ni Edge Functions, no agrega composable ni store. **No dispara GATE 1.**

Dos matices menores, declarados por transparencia (ninguno es estructural):

1. **`PanelDetalleBorrador.vue` pasa a leer `useIngresosStore()` directo** para poblar el `<select>`, en vez de recibir el dato por prop. No es desviación: precedente idéntico en `FormularioGasto.vue` (líneas 6, 49, 201), y la regla dura del proyecto ("nunca `supabase.from()` en un `.vue`") se sigue respetando. Es además *menos* acoplamiento que hoy: se elimina una prop.
2. **Hay un 5.º archivo fuera del alcance que enunciaste: `src/types/reglaComercio.ts`.** La HU es imposible sin agregarle `banco_id` al tipo `ReglaComercio` (línea 9-15) — hoy no existe y `regla.banco_id` no compilaría. Lo incluyo; es una línea.

## Archivos a crear/modificar

> **Orden obligatorio: Bloque A → Bloque B.** NO son chunks paralelizables: `PanelDetalleBorrador.vue` no typechequea sin `BorradorInput.banco_id` ni sin la 3.ª firma de `guardarRegla`. Un solo builder, secuencial. Los tests son un chunk aparte, después de GATE 2.

### Bloque A — tipos y composables

**1. `src/types/gasto.ts` — modificar**
- Insertar `banco_id?: string` en `BorradorInput` **después de la línea 100** (`categoria_id?: string`).
- Actualizar el bloque de comentario de líneas 91-96: hoy dice que solo `revision_manual` necesita completar campos; agregar que desde la migración 012 `banco_id` también viaja en el payload cuando el usuario cambia (o acepta la sugerencia de) el banco en el panel de revisión, para cualquier estado de borrador.

**2. `src/types/reglaComercio.ts` — modificar**
- Insertar **después de la línea 13** (`categoria_id: string`):
  ```ts
  /** Banco recordado del comercio (migración 012). `null` en reglas creadas antes de esa migración. */
  banco_id: string | null
  ```
- **Requerido pero nullable**, no opcional (`?`): la columna siempre viene en el `select()` de `buscarReglaPorComercio` (línea 57 usa `.select()` sin lista de columnas), y hacerlo requerido obliga a los fixtures de test a declarar explícitamente el caso "regla vieja sin banco", que es justo el criterio 4.
- Actualizar el comentario de cabecera (líneas 1-6) para mencionar que la regla ahora recuerda categoría **y** banco.

**3. `src/composables/useReglasComercio.ts` — modificar**
- Cabecera del composable (líneas 6-22, en particular 8-9): mencionar que recuerda categoría **y** banco.
- **Línea 98**, firma: `async function guardarRegla(comercio: string, categoriaId: string, bancoId?: string | null): Promise<boolean>`. Tercer parámetro opcional para no romper a ningún caller existente.
- **Línea 109**, payload del upsert:
  ```ts
  { usuario_id: usuarioId, comercio: normalizarComercio(comercio), categoria_id: categoriaId, banco_id: bancoId || null }
  ```
  El `|| null` (no `?? null`) es deliberado y **crítico**: convierte también el string vacío `''` a `null`. Un `banco_id: ''` llegaría a Postgres como `invalid input syntax for type uuid` (22P02) y tumbaría el upsert en silencio. Documentarlo con un comentario de una línea.
- **Línea 110**: `onConflict: 'usuario_id,comercio'` se mantiene tal cual (la PK compuesta no cambia).
- Actualizar el doc-comment de `guardarRegla` (líneas 92-97): explicitar que el upsert **siempre refleja la última confirmación**, es decir, que confirmar sin banco elegido dejaría la regla con `banco_id = null`. En la práctica no ocurre (un borrador siempre trae `banco_id NOT NULL`, ver `types/gasto.ts` líneas 63-68), pero es la semántica y hay que dejarla escrita.
- `buscarReglaPorComercio` / `contarCargosComercio` / `normalizarComercio` / `escaparPatronLike`: **sin cambios**.

**4. `src/composables/useBandeja.ts` — modificar (solo comentarios)**
- **Sé honesto con esto: funcionalmente no requiere ni una línea de código.** La línea 111 ya hace `.update({ ...datosCompletar, estado: 'confirmado' })`; en cuanto `BorradorInput` tenga `banco_id`, el campo viaja solo. Cualquier cosa más que agregar acá es scope creep.
- Único cambio: actualizar el doc-comment de `confirmarBorrador` (líneas 83-91) para que mencione que el payload ahora puede traer `banco_id`.
- **NO agregar validación de `banco_id`** al bloque de guarda de líneas 102-107 (que hoy solo valida monto/moneda en `revision_manual`). Un borrador siempre tiene `banco_id` válido en base de datos; validarlo acá solo agregaría una forma nueva de bloquear una confirmación que hoy funciona. La guarda contra `''` va en el panel (ver Bloque B).
- `editarCategoriaBorrador` (líneas 154-173): **no tocar**. Verifiqué que hoy es código muerto en la app (solo lo usa su propio test); limpiarlo es otra tarea.

### Bloque B — UI

**5. `src/components/PanelDetalleBorrador.vue` — modificar**

*Script:*
- Agregar `import { useIngresosStore } from '@/stores/ingresos'` en el bloque de imports (entre las líneas 7 y 8, respetando el orden actual componentes → composables → stores → tipos, igual que `FormularioGasto.vue` líneas 5-7).
- **Eliminar las líneas 27-28** (comentario + `nombreBanco: string` de `defineProps`). Queda `{ borrador, categorias }`. Es dead code una vez que el panel lee el catálogo del store.
- Actualizar el comentario de cabecera del componente (líneas 11-22): mencionar que Banco pasó de texto de solo lectura a `<select>` editable con sugerencia por regla de comercio.
- Agregar `const storeIngresos = useIngresosStore()` junto a las demás instancias (después de la línea 39).
- **Después de la línea 52** (`categoriaSeleccionadaId`), agregar el ref hermano, con comentario que explique la precedencia:
  ```ts
  /**
   * Banco elegido para este borrador: nace con el que resolvió la Edge Function
   * `importar-borrador` y lo pisa la regla de comercio si ésta trae `banco_id`
   * (migración 012: la regla pesa más que la heurística de la ingesta).
   * Independiente de `categoriaSeleccionadaId`: tocar uno no afecta al otro,
   * aunque al confirmar compartan la misma fila de `reglas_comercio`.
   */
  const bancoSeleccionadoId = ref(props.borrador.banco_id)
  ```
- **`onMounted` (líneas 65-78)**: insertar el bloque de banco **entre la línea 76 y la 77**, es decir, *después* de la guarda de categoría y *antes* del `await contarCargosComercio`. El orden importa: si se pusiera después del `await`, la preselección del banco llegaría un tick más tarde que la de la categoría y se ampliaría la ventana de la carrera descrita en "Casos borde".
  ```ts
  // Solo pisa el banco si la regla trae uno: una regla anterior a la migración
  // 012 (`banco_id` null) debe dejar intacto el banco resuelto por la ingesta.
  if (regla.banco_id) {
    bancoSeleccionadoId.value = regla.banco_id
  }
  ```
- **`textoBannerRegla` (líneas 86-90)**: el prefijo pasa a depender de la regla, el resto de la frase no cambia (mismo `etiquetaCantidad` singular/plural de la línea 88):
  ```ts
  const prefijo = reglaEncontrada.value?.banco_id ? 'Categoría y banco sugeridos' : 'Categoría sugerida'
  return `${prefijo} por ${cantidad} ${etiquetaCantidad} de ${props.borrador.descripcion}. Al confirmar se guarda la regla.`
  ```
  Ojo con la concordancia: el texto de HU dice literalmente "Categoría y banco **sugeridos**" (plural) vs "Categoría **sugerida**" (femenino singular) — por eso el prefijo se cambia completo y no solo una palabra.
- Agregar computed junto a los demás (después de la línea 94), replicando `FormularioGasto.vue` línea 84:
  ```ts
  /** Catálogo de bancos todavía sin cargar: el select se muestra inerte, pero el banco del borrador sigue vigente. */
  const sinBancos = computed(() => storeIngresos.bancos.length === 0)
  ```
- **`puedeConfirmar` (líneas 97-106): NO tocar.** No bloquear Confirmar por banco. Hoy el banco es de solo lectura y nunca bloquea; introducir un bloqueo sería una regresión funcional pura.
- **`confirmar()` (líneas 142-171)**: después de la línea 147 (`const datosCompletar: BorradorInput = { categoria_id: ... }`), agregar:
  ```ts
  // Guarda contra `''`: si el catálogo no cargó, se prefiere no mandar el campo
  // (el borrador conserva su `banco_id`) antes que romper el UPDATE con un uuid inválido.
  if (bancoSeleccionadoId.value) {
    datosCompletar.banco_id = bancoSeleccionadoId.value
  }
  ```
- **Línea 161**: `await guardarRegla(props.borrador.descripcion, categoriaSeleccionadaId.value, bancoSeleccionadoId.value || null)`.
- La condición de la línea 159 (`props.borrador.descripcion && categoriaSeleccionadaId.value`) **se mantiene igual**: sin descripción no hay regla que guardar, y no se agrega el banco como condición (una regla solo-categoría sigue siendo válida).

*Template:*
- **Reemplazar las líneas 267-270** (bloque `<div class="dato-panel">` con el `<p class="valor-dato-panel">{{ nombreBanco }}</p>`) por:
  ```html
  <div class="dato-panel">
    <label class="etiqueta-dato-panel" :for="`banco-${borrador.id}`">Banco</label>
    <select
      :id="`banco-${borrador.id}`"
      v-model="bancoSeleccionadoId"
      class="entrada entrada-banco-panel"
      :disabled="sinBancos"
    >
      <!-- Fallback mientras el catálogo no llegó: evita que el select se vea
           vacío/roto sin perder el banco que ya trae el borrador. -->
      <option v-if="sinBancos" :value="bancoSeleccionadoId" disabled>Cargando bancos…</option>
      <option v-for="banco in storeIngresos.bancos" :key="banco.id" :value="banco.id">
        {{ banco.nombre }}
      </option>
    </select>
  </div>
  ```
  Nota: el `id` sigue el patrón ya usado en este archivo para el input de monto (líneas 222-224, `` :id="`monto-${borrador.id}`" ``). **Sin `<option value="" disabled>Selecciona un banco</option>`**: a diferencia de `FormularioGasto` (alta desde cero), acá siempre hay un banco vigente y un placeholder vacío solo permitiría llegar a `''`.
- El resto del template no cambia. La celda de Banco sigue siendo la 2.ª columna del `.fila-datos-panel` (grid `1fr 1fr`, línea 384-388).

*Estilos:*
- Agregar una regla `.entrada-banco-panel { width: 100%; min-width: 0; }` cerca del bloque `.dato-panel` (líneas 390-408) para que el `<select>` no desborde la columna del grid. `.entrada` es global (no scoped), se hereda sin cambios.
- `.etiqueta-dato-panel` (líneas 397-402) aplica igual a un `<label>` que a un `<p>` (es selector de clase). No hace falta tocarla.

**6. `src/views/BandejaView.vue` — modificar (una línea)**
- **Eliminar la línea 125** (`:nombre-banco="nombreBanco(borradorSeleccionado.banco_id)"`) del `<PanelDetalleBorrador>`.
- **Todo lo demás se queda:** la función `nombreBanco` (líneas 51-54) sigue en uso por `FilaBorrador` (línea 112), y con ella los imports de `useIngresosStore` (línea 9) y `storeIngresos` (línea 22). El `:key` de la línea 122 y el `cargarBancos()` de la línea 32 son justamente lo que hace que este cambio no necesite nada más. **La vista no necesita ninguna prop nueva**: tu intuición era correcta, el catálogo ya es accesible directo desde el store.

## Casos borde encontrados leyendo el código (además de los de la HU)

1. **`storeIngresos.bancos` vacío al abrir el panel.** `BandejaView.onMounted` dispara `cargarBancos()` (línea 32) y `cargarBorradores()` (33) **sin `await` entre ellas**: corren en paralelo. En la práctica el panel solo se abre tras un clic (los borradores ya se pintaron), así que el catálogo casi siempre está; pero no está *garantizado*, y en tests que no mockeen `bancos` sí ocurre. Mitigación: el `<option>` de fallback + `:disabled="sinBancos"` + la guarda `if (bancoSeleccionadoId.value)` en `confirmar()`. Clave: **el ref nunca se resetea desde el DOM** — `v-model` en un `<select>` solo escribe modelo→DOM en el render, y no dispara `change` sintético, así que el id del borrador sobrevive y se re-sincroniza solo cuando llegan las `<option>`. Degradación correcta: se comporta exactamente como hoy (banco no editable), sin bloquear la confirmación.
2. **Carrera al cambiar de borrador con el `onMounted` async en vuelo — NO existe filtración entre borradores.** `:key="borradorSeleccionado.id"` (BandejaView línea 122) fuerza remount completo: cada instancia tiene sus propios refs creados en `setup`. Una promesa pendiente de la instancia destruida resuelve dentro de *su* closure y escribe en refs que ya nadie renderiza — inofensivo. Está verificado end-to-end para categoría en `BandejaView.switchDetalle.qa.spec.ts` (test de línea 110). El banco hereda exactamente la misma garantía; hay que agregar el test espejo (ver plan de pruebas), no un `watch` ni un token de cancelación.
3. **Carrera REAL (intra-instancia, preexistente y ahora heredada por banco):** entre el mount y la resolución de `buscarReglaPorComercio` hay una ventana en la que el panel muestra los valores del borrador, no los sugeridos. Si el usuario clickea Confirmar en esa ventana, (a) se confirma con el banco/categoría de la ingesta ignorando la sugerencia, y (b) peor: el `guardarRegla` posterior **pisa la regla existente** con esos valores no sugeridos. Ya pasa hoy con categoría. **Recomiendo NO arreglarlo en este build** (excede la HU y cambiaría el comportamiento de Confirmar); queda anotado abajo como sugerencia.
4. **Desincronía visual lista ↔ panel.** `FilaBorrador` pinta `nombreBanco(borrador.banco_id)` (BandejaView línea 112), o sea el banco **guardado**; el panel mostrará el banco **sugerido**. Cuando la regla sugiere un banco distinto, la fila de la izquierda y el detalle de la derecha muestran bancos distintos hasta confirmar. Es consecuencia directa del criterio 1 de la HU ("la regla pesa más que la Edge Function") y el banner verde lo explica, pero **no está contemplado en la HU** y conviene que UX lo sepa. No lo resuelvo en este plan.
5. **`confirmar()` sigue corriendo con el componente ya desmontado.** `confirmarBorrador` hace `store.quitarBorrador(id)` (useBandeja línea 119) → el computed `borradorSeleccionado` (BandejaView 44-46) pasa a `null` → el `v-if` de la línea 121 desmonta el panel **en medio** de `confirmar()`. El código posterior (líneas 159-165) sigue leyendo `props.borrador` y los refs desde el closure, que siguen vivos. Es el motivo por el que la aserción de upsert de `BandejaView.spec.ts` línea 185 hoy pasa. **El builder no debe "arreglar" esto**, y el tester debe saber que `bancoSeleccionadoId.value` sigue siendo legible ahí.
6. **Borrador sin `descripcion`.** `onMounted` corta en la línea 68 → no hay regla ni sugerencia, pero el `<select>` igual nace con el banco del borrador y es editable; al confirmar, el banco elegido **sí** se guarda en el gasto y **no** se aprende ninguna regla (línea 159 lo impide). Comportamiento correcto y deliberado; hay que testearlo para que nadie lo "corrija".
7. **Regla con `banco_id` apuntando a un banco borrado:** imposible por diseño — `on delete set null` (migración 012 línea 22). La regla degrada sola a "solo categoría" y el banner vuelve al texto viejo. Sin código defensivo extra.
8. **Detección de duplicados no reacciona al banco pendiente.** `calcularPosiblesDuplicados` (useBandeja líneas 22-45) compara `banco_id` de la fila **guardada**; cambiar el banco en el panel no reevalúa los badges hasta confirmar (y al confirmar el borrador sale de la bandeja). Sin acción; solo para que no sorprenda en QA.

## Plan de pruebas

### Tests existentes que ROMPEN (citados, con cómo relocalizarlos)

Ninguno hay que mover de archivo: los 5 se actualizan en su lugar.

1. `src/views/__tests__/BandejaView.spec.ts:157` — `it('camino feliz: al confirmar un borrador sin regla previa, sale de la bandeja y se crea la regla de comercio')`. Rompen dos aserciones:
   - **línea 184**: `builderConfirmar.update` pasa de `{ categoria_id: 'c1', estado: 'confirmado' }` a `{ categoria_id: 'c1', banco_id: 'banco-1', estado: 'confirmado' }` (el `bancoFalso` de la línea 28 es `banco-1`, igual que `borradorFalso.banco_id` línea 34).
   - **líneas 185-188**: `builderRegla.upsert` pasa a `{ usuario_id: 'u1', comercio: 'compra supermercado', categoria_id: 'c1', banco_id: 'banco-1' }`.
2. `src/views/__tests__/BandejaView.spec.ts:73-77` — helper `mockearTablas`: el tipo estructural inline del parámetro `reglaEncontrada` (líneas 75-76) queda desactualizado. Reemplazarlo por `ReglaComercio | null` importando el tipo. **Es un break de compilación (GATE 2), no de aserción.**
3. `src/views/__tests__/BandejaView.spec.ts:193` — `it('HU-14.1: comercio con regla previa muestra el banner verde con la categoría preseleccionada')`. El literal de las líneas 196-201 debe añadir `banco_id: null` (obligatorio tras el cambio 2). La aserción de la línea 211 (`toContain('Categoría sugerida por')`) **sigue siendo correcta y pasa a ser el test de regresión del criterio 4**: renombrarlo a algo como `'HU-14.1 / criterio 4: regla ANTERIOR a la migración 012 (banco_id null) mantiene el texto "Categoría sugerida"'`.
4. `src/composables/__tests__/useReglasComercio.spec.ts:16` — `const reglaBase: ReglaComercio = {...}`: **break de compilación**, falta `banco_id`. Añadir `banco_id: null`. Con eso, el `toEqual(reglaBase)` de `it('camino feliz: encuentra la regla normalizando el comercio de búsqueda')` (línea 37) vuelve a pasar.
5. `src/composables/__tests__/useReglasComercio.spec.ts:111` — `it('camino feliz: hace upsert con onConflict sobre (usuario_id, comercio) normalizado')`. La aserción de líneas 124-127 rompe: llamado sin 3.er argumento, el payload ahora incluye `banco_id: null`. Actualizar el objeto esperado.

### Tests que NO deberían romper (verificar explícitamente, no tocar)

- `src/composables/__tests__/useBandeja.spec.ts`: líneas 108 (`{ estado: 'confirmado' }`) y 140 (`{ monto: 30, moneda: 'USD', estado: 'confirmado' }`) siguen exactas — `confirmarBorrador` no cambia de lógica y esos casos no pasan `banco_id`.
- `src/views/__tests__/BandejaView.switchDetalle.qa.spec.ts`: los 3 tests son sobre chips de categoría; el `<select>` nuevo lista **nombres de banco**, no de categoría, así que las aserciones de texto (líneas 120, 130, 139-140, 165) no se contaminan. El `bancoFalso` ya está mockeado (línea 78).
- `src/views/__tests__/BandejaView.umbral48h.qa.spec.ts` (bandeja vacía, el panel nunca monta), `src/composables/__tests__/useBandeja.duplicados.qa.spec.ts` (función pura), `src/composables/__tests__/useReglasComercio.ilike.qa.spec.ts` (`contarCargosComercio`, intacto), `src/components/__tests__/FormularioGasto.spec.ts`.

### Tests nuevos

**No existe `PanelDetalleBorrador.spec.ts`** — hoy el panel se prueba solo por integración desde `BandejaView.spec.ts`. Reparto propuesto: los criterios de payload (3 y 4) donde ya viven sus hermanos, y el resto en un archivo nuevo enfocado, montando el panel directo (ahora es trivial: lee el catálogo del store, que se siembra con `useIngresosStore().establecerBancos([...])`).

**Archivo nuevo: `src/components/__tests__/PanelDetalleBorrador.banco.spec.ts`** — mockear `fromMock.mockImplementation((tabla) => ...)` por nombre de tabla (`reglas_comercio` → `maybeSingle`, `gastos` → `single`/`ilike`), nunca por posición.

- **CA1-a (camino feliz):** regla con `banco_id: 'banco-2'` y borrador con `banco_id: 'banco-1'` → el `<select>` queda en `'banco-2'` (la regla pesa más que la Edge Function).
- **CA1-b:** sin regla (`maybeSingle` → `null`) → el `<select>` queda en `'banco-1'` (el del borrador).
- **CA1-c (borde):** regla con `banco_id: null` (regla vieja) → el `<select>` **conserva** `'banco-1'`, no se limpia ni queda vacío.
- **CA2:** `setValue('banco-2')` en el `<select>` deja el valor cambiado y **no dispara ningún UPDATE** sobre `gastos` (assert: `builder.update` no fue llamado). Persistencia solo al confirmar.
- **CA5-a:** cambiar el banco no altera `.chip-categoria-tocable` (sigue mostrando la categoría original) y el payload de confirmación conserva `categoria_id` original.
- **CA5-b:** elegir otro chip de categoría no altera el valor del `<select>` de banco.
- **Borde-1 (`storeIngresos.bancos` vacío):** el `<select>` se renderiza `disabled`, y al confirmar el payload lleva `banco_id: 'banco-1'` (el del borrador) — **nunca `''`**. Es el guard del error 22P02.
- **Borde-2 (borrador sin `descripcion`):** no se consulta `reglas_comercio` ni se hace upsert, pero el banco cambiado a mano **sí** viaja en el UPDATE del gasto.
- **Borde-3 (revisión manual):** un borrador `revision_manual` con monto/moneda completados a mano confirma con `{ monto, moneda, categoria_id, banco_id }` en el mismo UPDATE.

**En `src/views/__tests__/BandejaView.spec.ts` (nuevos, junto a los existentes):**
- **CA3:** con regla previa `{ categoria_id: 'c1', banco_id: 'banco-2' }` y catálogo de 2 bancos, confirmar sin tocar nada → `builderConfirmar.update` con `banco_id: 'banco-2'` **y** `builderRegla.upsert` con `{ ..., categoria_id: 'c1', banco_id: 'banco-2' }` (los dos campos en la misma fila de `reglas_comercio`).
- **CA3-bis:** el usuario cambia el `<select>` a `'banco-2'` sobre un borrador cuyo `banco_id` es `'banco-1'` y sin regla previa → UPDATE con `banco_id: 'banco-2'` y upsert que **crea** la regla con ese banco.
- **CA4-a:** regla con `banco_id` no nulo → el banner contiene `'Categoría y banco sugeridos por'` (y respeta singular/plural de `cargo anterior`/`cargos anteriores`).
- **CA4-b:** ya cubierto por el test 3 de la lista de rotos, renombrado (regla con `banco_id: null` → `'Categoría sugerida por'`).

**En `src/views/__tests__/BandejaView.switchDetalle.qa.spec.ts` (regresión de aislamiento):**
- Espejo exacto del test de línea 110, pero con banco: cambiar el `<select>` del borrador A a `'banco-2'` sin confirmar, saltar a B → el panel de B muestra **su** banco (`'banco-1'`), no el de A; y volver a A lo muestra de nuevo en `'banco-1'` (el cambio no persistido se perdió, sin rastro). Requiere agregar un `bancoSecundario` al mock de `bancos` (hoy línea 78 devuelve un solo banco).

**En `src/composables/__tests__/useReglasComercio.spec.ts` (dentro de `describe('guardarRegla')`):**
- `guardarRegla('  Primax Surco  ', 'c1', 'banco-2')` → upsert `{ usuario_id: 'u1', comercio: 'primax surco', categoria_id: 'c1', banco_id: 'banco-2' }` con el mismo `onConflict`.
- **Borde:** `guardarRegla('primax surco', 'c1', '')` y `guardarRegla('primax surco', 'c1', undefined)` → ambos envían `banco_id: null`, **nunca `''`** (protege contra `invalid input syntax for type uuid`).
- Las 2 aserciones de "no marca `store.error`" (líneas 130-141 y 143-157) siguen aplicando sin cambio.

### Gates
- **GATE 2:** `npm run build` (`vue-tsc -b`) **antes de tocar tests** — los breaks 2 y 4 de la lista son de compilación y saldrán ahí.
- Cierre: `npm run test:run` completo en verde, no solo los archivos tocados.

## Sugerencias fuera de alcance (NO implementar en este build)

- **Carrera del punto 3 de casos borde:** deshabilitar Confirmar mientras la consulta de regla está en vuelo (o descartar la sugerencia si el usuario ya interactuó). Afecta también a categoría; es un cambio de comportamiento del botón principal y merece decisión de UX/PO aparte.
- **Desincronía lista ↔ panel (punto 4):** mostrar en `FilaBorrador` un indicio de que el banco puede cambiar por regla, o refrescar la fila con el banco sugerido. Decisión de UX.
- **`editarCategoriaBorrador` (useBandeja líneas 154-173) es código muerto en la app** (solo lo consume su propio test). Candidato a borrado en una limpieza aparte.
- **Momento del banner:** hoy `reglaEncontrada` se setea (línea 73) antes de resolver `contarCargosComercio` (línea 77), así que el banner aparece un tick diciendo "por **0** cargos anteriores". Preexistente, no lo introduce esta HU; se arregla invirtiendo el orden o mostrando el banner solo con el count resuelto.

## Lo que no pude verificar / supuestos

- No corrí `npm run build` ni `npm run test:run`: las líneas citadas son de lectura estática del código actual y hay que reconfirmarlas al editar (sobre todo las de test, que se desplazan al insertar casos).
- Asumo que la migración 012 está efectivamente aplicada en producción (así lo indica el enunciado); no ejecuté `npx supabase db query` para comprobar que la columna existe.
- No leí `FilaBorrador.vue` completo: asumo que su prop `nombre-banco` (BandejaView línea 112) sigue siendo la única consumidora de la función `nombreBanco`, según el grep de usos.
- No revisé si la Edge Function `importar-borrador` debería empezar a consultar `reglas_comercio.banco_id` al crear el borrador (sería la alternativa "sugerir desde el servidor"). Está fuera del alcance de esta HU, que resuelve la sugerencia en el cliente.
