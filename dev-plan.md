# Micro-plan — Desglose de saldo NETO por banco en la tarjeta "Balance" del Dashboard

> Sobrescribe un `dev-plan.md` previo (tarea "nota sin banco asignado", ya cerrada).

## Patrón arquitectónico detectado

Arquitectura Vue 3 + TypeScript + Pinia con separación clara de capas:

- **Funciones puras de agregación** viven exportadas a nivel de módulo dentro de los composables de dominio (`cargarResumenPorMoneda`, `cargarGastoPorCategoria`, `cargarBalancePorMoneda`, etc. en `useDashboard.ts`). Reciben datos crudos + `mes`, NO tocan Supabase ni el store, y NO resuelven nombres (nombre de categoría/banco es responsabilidad de la vista). Testeadas de forma aislada en `useDashboard.spec.ts`.
- **`useDashboard()`** es el composable de dominio del Dashboard: hace el fetch de la ventana de 6 meses de `gastos` (confirmados) e `ingresos` en refs locales (`filas`, `filasIngresos`) y no depende de que otra página se haya visitado.
- **`useMoneda.ts`** es un composable puro de formateo + agregación **solo de ingresos** por banco (`saldosPorBanco`, `montoSinBancoPorMoneda`). Documentado explícitamente como "sin estado ni store"; hoy NO conoce gastos.
- **La vista (`DashboardView.vue`)** orquesta: llama a las funciones puras dentro de `computed`, resuelve nombres contra los stores y pasa todo ya calculado como props a componentes presentacionales.
- **Resolución de nombre de banco**: el precedente exacto está en `IngresosView.vue` — un helper local `nombreBanco(bancoId)` que lee `storeIngresos.bancos.find(...)?.nombre ?? 'Sin banco'`, y luego mapea los items añadiendo `nombreBanco` antes de pasarlos a la función pura `saldosPorBanco` (que excluye "No especificado" por nombre, case-insensitive).
- **Componentes presentacionales puros**: `TarjetaBalanceMoneda.vue` ya declara en su docstring "Presentacional puro: recibe ya calculados los totales desde DashboardView". Importa `useMoneda().formatearMonto` (permitido: es formateo puro, no store), y no accede a ningún Pinia store.
- **Ubicación de `banco_id`**: presente y obligatorio tanto en `Gasto` (`types/gasto.ts:52`) como en `Ingreso` (`types/ingreso.ts:23`). El catálogo `bancos` vive en `useIngresosStore().bancos` (compartido gastos+ingresos), se carga con `useBancos().cargarBancos()`.

## Desviación de arquitectura

- **¿Se necesita desviarse? NO.**
- La feature encaja limpiamente en el patrón existente: nueva función pura de agregación en el composable de dominio + resolución de nombres en la vista + render en el componente presentacional vía una prop nueva. No cambia el modelo de datos, no introduce un patrón nuevo, no crea acoplamiento entre módulos. **No dispara GATE 1.**
- Único ajuste transversal menor (dentro del patrón, no desviación): el Dashboard hoy no carga el catálogo de bancos; hay que añadir `useBancos().cargarBancos()` en su `onMounted`, exactamente como ya lo hace `IngresosView.vue`.

## Decisión 1 — Dónde vive la función de agregación nueva

**Va en `useDashboard.ts`**, como función pura exportada `cargarBalanceNetoPorBanco`, junto a `cargarBalancePorMoneda`.

Justificación:
- `cargarBalancePorMoneda` ya vive ahí y ya combina las dos fuentes (`gastos` + `ingresos`) del mes restando una de otra. La nueva función es su hermana natural: misma combinación, pero desagregada por banco.
- La ventana mensual de ambas fuentes (`filas`, `filasIngresos`) se origina en `useDashboard`. Es el dueño del dato.
- `useMoneda.ts` está documentado como "sin estado ni store" y **solo agrega ingresos**; `saldosPorBanco` suma montos de una sola fuente sin signo. Meter lógica gasto-aware (resta con signo) ahí rompería su alcance declarado y su semántica ("saldos de Ingresos").
- **Descartado reutilizar `saldosPorBanco` con montos firmados** (ingresos +, gastos −): funcionaría por coincidencia (el group-by banco+moneda y la exclusión de "No especificado" son idénticos), pero sería un hack semántico oculto — su docstring dice "suma los montos … de Ingresos" y ningún lector futuro esperaría que le pasen gastos negativos. Preferimos una función dedicada y bien nombrada.

Firma propuesta (pura, sin store, siguiendo el precedente de `saldosPorBanco` en cuanto a exclusión por nombre):

```ts
export function cargarBalanceNetoPorBanco(
  gastos: Gasto[],
  ingresos: Ingreso[],
  mes: string,                                // prefijo YYYY-MM del mes actual
  nombreBanco: (bancoId: string) => string,   // resolver inyectado por la vista
): Array<{ bancoId: string; nombreBanco: string; montosPorMoneda: Partial<Record<Moneda, number>> }>
```

Comportamiento (idéntico en convenciones a `saldosPorBanco`):
- Filtra ambas fuentes a `mes.slice(0,7)`.
- Acumula neto por `(bancoId, moneda)`: ingreso suma `+importe`, gasto resta `−(monto ?? 0)`. **Nunca mezcla PEN con USD.**
- Excluye el banco cuyo `nombreBanco(bancoId).toLowerCase() === 'no especificado'` (mismo criterio, case-insensitive).
- **Omite la combinación banco+moneda cuyo neto sea exactamente `0`** (clave ausente, no `0`) — igual que `saldosPorBanco`. OJO: aquí se **conservan los netos negativos** (a diferencia de `montoSinBancoPorMoneda` que descarta ≤0), porque un balance negativo debe mostrarse. La condición es `!== 0`, no `> 0`.
- Descarta el banco entero si no le queda ninguna moneda.

Nota sobre la constante `NOMBRE_BANCO_NO_ESPECIFICADO`: hoy es privada en `useMoneda.ts`. Para no duplicar el literal, **exportarla** desde `useMoneda.ts` e importarla en `useDashboard.ts` (fuente única de verdad). Alternativa aceptable si el builder prefiere no tocar `useMoneda`: redeclarar el literal local con un comentario que apunte a la migración 006 — pero la exportación es preferible.

## Decisión 2 — Cómo resolver el nombre del banco en `TarjetaBalanceMoneda.vue`

**La vista resuelve los nombres antes de pasarlos como prop. El componente sigue siendo presentacional puro (NO inyecta store de bancos).**

- Se mantiene el patrón ya establecido en `TarjetaBalanceMoneda` (props ya calculadas) y en `IngresosView` (la vista mapea `nombreBanco` antes de llamar a la función pura).
- `DashboardView` gana un helper `nombreBanco(bancoId)` idéntico al de `IngresosView` (leyendo `useIngresosStore().bancos`), lo inyecta a `cargarBalanceNetoPorBanco`, y el resultado ya trae `nombreBanco` resuelto por fila.
- `TarjetaBalanceMoneda` recibe una prop nueva `desglosePorBanco` (array `{ bancoId, nombreBanco, montosPorMoneda }`) y solo la renderiza. Para formatear cada monto ya dispone de `formatearMonto` (import puro existente) — una fila por cada `(banco, moneda)` con su propia moneda, de modo que "S/ ..." y "$..." nunca se mezclan en la misma línea (esto es lo que produce las dos filas de "Interbank" de la captura).

## Archivos a crear/modificar

Chunks marcados; A y B no se solapan y pueden construirse en paralelo. C depende de A y B.

- **[Chunk A]** `src/composables/useMoneda.ts` — modificar — exportar la constante `NOMBRE_BANCO_NO_ESPECIFICADO` (cambiar de `const` privado a `export const`). Sin otros cambios funcionales.
- **[Chunk A]** `src/composables/useDashboard.ts` — modificar — añadir función pura exportada `cargarBalanceNetoPorBanco` (ver firma arriba); importar `NOMBRE_BANCO_NO_ESPECIFICADO` desde `useMoneda`.
- **[Chunk B]** `src/components/TarjetaBalanceMoneda.vue` — modificar — nueva prop opcional `desglosePorBanco: Array<{ bancoId: string; nombreBanco: string; montosPorMoneda: Partial<Record<Moneda, number>> }>` (default `[]`); markup: línea divisoria + lista `v-if="desglosePorBanco.length > 0"`, una fila por banco iterando `Object.entries(banco.montosPorMoneda)` con `formatearMonto(monto, moneda)`; color rojo/verde por signo del monto (reutilizar criterio `< 0`). Estilos scoped para el divisor y las filas.
- **[Chunk C — depende de A y B]** `src/views/DashboardView.vue` — modificar —
  1. importar `useBancos` y `useIngresosStore`; en `onMounted` añadir `cargarBancos()`.
  2. helper `nombreBanco(bancoId)` (copia del de `IngresosView`).
  3. `computed` `desgloseBalancePorBanco` que llama a `cargarBalanceNetoPorBanco(filas.value, filasIngresos.value, mesActual.value, nombreBanco)`.
  4. pasar `:desglose-por-banco="desgloseBalancePorBanco"` a `<TarjetaBalanceMoneda>`.
  5. **CSS del grid**: en `.seccion-resumen` añadir `align-items: start;` para que solo la tarjeta Balance crezca sin estirar las otras dos (hoy el grid no fija `align-items`, por lo que usa el `stretch` por defecto y las 3 columnas igualan altura).

Tests (extender los specs existentes, mismo estilo con helpers `gastoDe`/`ingresoDe`):
- `src/composables/__tests__/useDashboard.spec.ts` — casos de `cargarBalanceNetoPorBanco` (ver Plan de pruebas).
- `src/components/__tests__/TarjetaBalanceMoneda.spec.ts` — render del desglose (filas por banco+moneda, negativos en rojo, lista ausente si vacío).
- `src/views/__tests__/DashboardView.spec.ts` — que el desglose se pasa a la tarjeta con nombres resueltos y que se llama `cargarBancos`.

## Plan de pruebas

### Función pura `cargarBalanceNetoPorBanco` (unit, `useDashboard.spec.ts`)
- **Un banco con una sola moneda**: 1 ingreso + 1 gasto mismo banco/moneda → una fila, neto = ingreso − gasto.
- **Un banco con ambas monedas por separado**: movimientos PEN y USD del mismo banco → una entrada con `montosPorMoneda` de dos claves, cada una neta e independiente (nunca sumadas entre sí).
- **Varios bancos**: netos correctos por banco, sin fugas cruzadas entre bancos.
- **Exclusión de "No especificado"**: item cuyo `nombreBanco(...)` es "No especificado" (probar también "no especificado"/"NO ESPECIFICADO" para el case-insensitive) NO aparece.
- **Banco con solo ingresos** → neto positivo = importe. **Banco con solo gastos** → neto negativo = −monto (se conserva, no se descarta).
- **Saldo neto negativo**: gastos > ingresos → fila presente con valor negativo.
- **Neto exactamente 0**: ingresos == gastos en esa moneda → esa moneda se omite; si es la única, el banco desaparece.
- **Conjunto vacío**: `gastos=[]`, `ingresos=[]` → `[]`.
- **Filtro de mes**: movimientos de otro mes dentro de la ventana de 6 meses NO cuentan.
- **Monto nulo**: gasto con `monto: null` tratado como 0 (`?? 0`), no rompe.

### Componente `TarjetaBalanceMoneda` (`TarjetaBalanceMoneda.spec.ts`)
- Camino feliz: dado `desglosePorBanco` con un banco de dos monedas, renderiza dos filas con nombre repetido y montos formateados con símbolo correcto (S/ vs $).
- Borde: `desglosePorBanco` vacío/omitido → no renderiza la lista ni el divisor (no regresión de la tarjeta actual).
- Neto negativo → fila con clase/color de error.

### Vista + grid (`DashboardView.spec.ts` + verificación visual manual)
- La vista pasa a `TarjetaBalanceMoneda` el desglose con nombres ya resueltos desde `bancos`; se invoca `cargarBancos` en `onMounted`.
- **Grid no estira "Gastado"/"Ingresos"**: con `align-items: start`, al crecer la tarjeta Balance las otras dos conservan su altura de contenido (no se estiran a la más alta). Verificar en desktop (3 columnas) y que en móvil (`max-width: 640px`, 1 columna) sigue apilado sin cambios.

## Sugerencias fuera de alcance (NO incluir en este build)
- Podría extraerse un helper compartido `nombreBanco(bancoId)` (hoy duplicado entre `IngresosView` y ahora `DashboardView`) — pero mantener el precedente local evita ampliar el alcance.
- Igual que `saldosPorBanco` tiene su contraparte `montoSinBancoPorMoneda` ("Incluye … sin banco asignado"), el Dashboard podría más adelante mostrar el neto de "No especificado" como nota. No pedido aquí.
