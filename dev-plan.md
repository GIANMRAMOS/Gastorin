# Micro-plan — Rediseño Dashboard: fila única de 3 tarjetas con insignia USD

## Patrón arquitectónico detectado
- **Capas.** `DashboardView.vue` es el contenedor con estado: consume `useDashboard`, `useCategorias`, `useGastosStore` y los helpers puros `cargarResumenPorMoneda` / `cargarBalancePorMoneda` (en `composables/useDashboard`). Calcula todo vía `computed` y pasa datos ya listos por props. `TarjetaResumenMoneda.vue` y `TarjetaBalanceMoneda.vue` son **presentacionales puros**: reciben números formateables y no tocan store ni composables de datos (solo `useMoneda` para formatear).
- **Formateo de moneda.** Centralizado en `useMoneda().formatearMonto(monto, moneda)`. `Moneda` es un tipo (`'PEN' | 'USD'`) en `@/types/gasto`. El proyecto hoy solo maneja esas dos monedas.
- **Estilos.** CSS scoped por componente + tokens globales en `src/assets/estilos-base.css` (`--espacio-*`, `--tamano-pequeno`, `--color-texto-terciario`, `--color-borde-tarjeta`, `--color-fondo`, `--color-primario`, `--color-error`, `--color-exito`). Las tarjetas usan `.tarjeta-*` con `display:flex; flex-direction:column`. El grid contenedor vive en la vista (`.seccion-resumen`), no en las tarjetas.
- **Convenciones.** Nombres en español; props con `defineProps<>()`; comentarios JSDoc por prop/computed; tests con Vitest + `@vue/test-utils`, consultando por `findAllComponents({ name })` y `props(...)`.

## Desviación de arquitectura
- ¿Se necesita desviarse? **NO.**
- Son cambios de **props + template + CSS** en 2 componentes presentacionales ya existentes, más la **reestructuración del grid contenedor** en la vista. No se tocan composables, store, tipos, ni el modelo de datos. `cargarResumenPorMoneda` y `cargarBalancePorMoneda` ya devuelven ambos montos (PEN y USD): solo cambia cómo la vista los reparte a las tarjetas (antes 6 instancias, ahora 3). No dispara GATE 1.

## Decisión sobre los props (pregunta 2)
**Preservar la genericidad, no hardcodear PEN/USD.** Razones:
- Los componentes hoy son genéricos por `moneda` y sus tests lo verifican (formateo `S/` vs `$`, separación de monedas). Hardcodear PEN adentro rompería esa genericidad por una ganancia nula: pasar `moneda="PEN"` desde la vista cuesta una línea.
- La insignia secundaria debe formatearse con `formatearMonto`, que ya necesita una `Moneda`. Pasar `monedaSecundaria="USD"` reusa la misma ruta de formateo sin casos especiales. Hardcodear `USD` en el template ataría el componente al par PEN/USD justo cuando su única dependencia real es `formatearMonto`.

**Contrato de props resultante (aditivo, retrocompatible):**

`TarjetaResumenMoneda`:
- Mantiene `moneda: Moneda` (= la principal, `'PEN'` en este uso), `total`, `variacionPct`, `etiqueta?`.
- Añade `montoSecundario?: number` y `monedaSecundaria?: Moneda` (ambos opcionales). La insignia se renderiza solo si `monedaSecundaria` está definida (o `montoSecundario !== undefined`). Así los tests/usos sin insignia no se rompen.

`TarjetaBalanceMoneda`:
- Mantiene `moneda`, `ingresos`, `gastos`, `balance`.
- Añade `montoSecundario?: number` y `monedaSecundaria?: Moneda` (= balance en la moneda secundaria). Misma regla de render condicional.

La insignia es **informativa y sin interacción**: un `<span>`/`<p>` con texto formateado, sin `router-link`, `button` ni handlers; subordinada visualmente (menor tamaño, color secundario/terciario, tipo "chip").

## Archivos a crear/modificar
- `src/components/TarjetaResumenMoneda.vue` — **modificar** — añadir props `montoSecundario?`, `monedaSecundaria?`; computed `montoSecundarioFormateado`; bloque insignia en template (abajo-derecha) con render condicional; CSS `.insignia-secundaria`. **Chunk independiente A.**
- `src/components/TarjetaBalanceMoneda.vue` — **modificar** — mismos props secundarios; computed de formateo; insignia abajo-derecha junto/bajo el enlace "Ver ingresos"; conservar triángulo y clases `balance-positivo`/`balance-negativo`. **Chunk independiente B.**
- `src/views/DashboardView.vue` — **modificar** — reemplazar las 3 `<section class="seccion-resumen">` (6 tarjetas) por **una** `<section class="seccion-resumen">` con 3 tarjetas: 1 `TarjetaResumenMoneda` "Gastado" (`total`=PEN, `montoSecundario`=USD), 1 `TarjetaResumenMoneda` "Ingresos", 1 `TarjetaBalanceMoneda` (`balance`=PEN + `montoSecundario`=USD). CSS: `grid-template-columns: 1fr 1fr 1fr` + media query de apilado móvil. **Depende de A y B** (usa sus props nuevos); hacer al final.
- `src/components/__tests__/TarjetaResumenMoneda.spec.ts` — **modificar** — añadir tests de insignia (ver plan de pruebas). Independiente.
- `src/components/__tests__/TarjetaBalanceMoneda.spec.ts` — **modificar** — añadir tests de insignia; conservar los de color/signo/enlace. Independiente.
- `src/views/__tests__/DashboardView.spec.ts` — **modificar** — reescribir los 3-4 tests acoplados a "2 instancias por fila" y a los `aria-label` de sección. Depende de la nueva estructura de la vista.

Paralelizable: chunks A y B (componentes + sus specs) no se solapan. La vista y su spec van después.

## Plan de pruebas

### TarjetaResumenMoneda.spec.ts
- **Conservar** los 6 tests actuales: siguen pasando porque los props nuevos son opcionales y la insignia no se renderiza sin ellos (el test "borde: sin etiqueta" ya cubre que el default no rompe la fila 1).
- **Nuevo — camino feliz insignia:** con `montoSecundario: 40, monedaSecundaria: 'USD'`, se renderiza la insignia con `$40.00` (formato USD) y el monto principal sigue en `S/` (PEN). El monto principal (`.monto-resumen`) NO contiene el valor USD.
- **Nuevo — borde:** sin props secundarios, la insignia no existe en el DOM.
- **Nuevo — no interacción:** la insignia no contiene `a`, `button` ni `router-link` (es informativa).

### TarjetaBalanceMoneda.spec.ts
- **Conservar** los 6 tests actuales (color/signo/icono/cero/separación de monedas/enlace): no cambian, props secundarios opcionales.
- **Nuevo — insignia USD:** con `montoSecundario` + `monedaSecundaria:'USD'`, se muestra el balance secundario formateado en `$`; el triángulo y la clase de signo del monto principal PEN se mantienen (probar positivo y negativo con insignia presente).
- **Nuevo — borde:** sin props secundarios, sin insignia.

### DashboardView.spec.ts — tests que SE ROMPEN (reescribir)
1. `HU-7.1: muestra SIEMPRE las dos tarjetas de resumen...` (línea 97) — asumía 2 instancias en `section[aria-label="Gastado este mes"]`. Ahora hay **1** `TarjetaResumenMoneda` "Gastado" con `moneda='PEN'`, `total`=150, `montoSecundario`=40. Reescribir: localizar por `etiqueta`/orden, aserciones sobre `total` (PEN) y `montoSecundario` (USD).
2. `Dashboard 3x2: fila "Ingresos este mes"...` (línea 120) — asumía 2 `TarjetaResumenMoneda` + `section[aria-label="Balance este mes"]` con 2 `TarjetaBalanceMoneda`. Ahora: 1 tarjeta Ingresos (`total`=500 PEN, `montoSecundario`=80 USD, `variacionPct`=null) y **1** `TarjetaBalanceMoneda`.
3. `Dashboard 3x2 con datos reales de ambas fuentes...` (línea 154) — asumía 2 por sección en Gastado/Ingresos/Balance. Reescribir: Gastado → `total`=300, `montoSecundario`=25; Ingresos → `total`=1200, `montoSecundario`=50 (y `!=` los de gastos, conservando la protección anti copy-paste); Balance → `balance`=900 (PEN) y `montoSecundario`=25 (USD). Verificar que PEN y USD no se mezclan usando principal vs secundario de la MISMA tarjeta.
4. Selectores `section[aria-label="..."]` desaparecen al colapsar a una sola sección. Nueva estrategia de consulta: `findAllComponents({ name: 'TarjetaResumenMoneda' })` + localizar por `props('etiqueta')` ('Gastado este mes' / 'Ingresos este mes'); Balance por `findComponent({ name: 'TarjetaBalanceMoneda' })`.

### DashboardView.spec.ts — tests que probablemente SOBREVIVEN (verificar)
- `estado sin datos` (línea 266) — `tarjetas.every(t => t.props('total') === 0)` sigue cierto (2 tarjetas resumen, ambas total 0). **Añadir** aserción de `montoSecundario === 0`.
- `riesgo: no reusa store.gastos` (línea 364) — busca la tarjeta resumen con `moneda='PEN'` y `total===100`; ahora ambas resumen tienen `moneda='PEN'`, así que hay que localizar la de "Gastado" por `etiqueta` en vez de por `moneda` (ajuste menor para evitar fragilidad).
- Toggle / tendencia mensual / tendencia diaria / error store / onMounted / count de fetch: **no se afectan** (no dependen de la fila de resumen).

### DashboardView.spec.ts — tests NUEVOS
- **Estructura:** existe **una sola** `section.seccion-resumen`; contiene exactamente 2 `TarjetaResumenMoneda` (Gastado + Ingresos) y 1 `TarjetaBalanceMoneda` (3 tarjetas en la fila).
- **Cableado de insignia:** cada tarjeta recibe `monedaSecundaria='USD'` y su `montoSecundario` correcto (gasto USD, ingreso USD, balance USD).

### Responsive (fila de 3 → apilado en móvil ~375px)
- **CSS:** `.seccion-resumen` usa `grid-template-columns: 1fr 1fr 1fr` en desktop y una media query (p. ej. `@media (max-width: 640px) { grid-template-columns: 1fr; }`) para apilar; validar además que la insignia (abajo-derecha) no desborde ni empuje el monto en ancho estrecho.
- **Limitación de test:** jsdom (entorno de Vitest) **no evalúa media queries** ni layout real, por lo que el apilado no es asegurable con un test unitario fiable. Recomendación: verificación **visual/manual** a 375px (o e2e si existe ese tramo). Anotarlo así en el PR; no forzar un test frágil que "lea" el CSS.

## Sugerencias fuera de alcance (no incluidas en el build)
- `useMoneda` podría exponer un helper "formato compacto/insignia" si la insignia se reutiliza en otras vistas; hoy no hace falta.
- Si en el futuro entra una 3ª moneda, `monedaSecundaria` ya lo soporta sin refactor (razón extra para no hardcodear USD).
