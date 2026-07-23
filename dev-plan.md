# Micro-plan — Modales y hoja del FAB solo cierran por botón explícito (no backdrop, no Escape)

## Patrón arquitectónico detectado
Overlays construidos como componentes de un solo archivo `.vue` (`<script setup lang="ts">` + `<template>` + `<style scoped>`), controlados por el padre con `v-if`. No son rutas. El cierre se comunica hacia arriba con `emit('cerrar')` (o `emit('cancelar')` en `DialogoConfirmacion`). El padre decide qué hacer con ese evento; el componente nunca se auto-desmonta.

Patrón de cierre uniforme en 6 de los 7 componentes (los 5 modales + la hoja del FAB):
1. `@click.self="emit('cerrar')"` en el div de fondo (`.modal-fondo` / `.hoja-fondo`).
2. Función `manejarTecla(evento: KeyboardEvent)` que hace `emit('cerrar')` si `evento.key === 'Escape'`.
3. Registro/desregistro de esa función: `window.addEventListener('keydown', manejarTecla)` en `onMounted` y `window.removeEventListener(...)` en `onUnmounted`.
4. Botón X (`button.modal-cerrar`, `@click="emit('cerrar')"`) — solo en los 5 modales, NO en la hoja del FAB.
5. `storeUi.abrirModal()` / `storeUi.cerrarModal()` en `onMounted`/`onUnmounted` (oculta el bottom nav). ESTO NO SE TOCA.

`DialogoConfirmacion.vue` es la excepción: NO tiene `manejarTecla`, NO tiene `onMounted`/`onUnmounted`, NO tiene botón X ni usa `storeUi`. Solo tiene `@click.self="emit('cancelar')"` en `.modal-fondo` y botones "Confirmar"/"Cancelar". Emite `cancelar` (no `cerrar`).

El cambio pedido encaja de lleno en este patrón: se remueve el mecanismo de cierre por backdrop y por Escape, dejando solo el botón explícito (X / Cancelar), que ya funciona vía `emit`.

## Desviación de arquitectura
- ¿Se necesita desviarse? **NO.**
- Es la eliminación de dos manejadores de evento (click en backdrop y keydown/Escape) en componentes ya construidos, con patrón uniforme. No cambia estructura de carpetas, ni capas, ni modelo de datos, ni el contrato de eventos (`cerrar`/`cancelar` se siguen emitiendo desde el botón). No afecta a los padres (siguen escuchando el mismo evento). NO dispara GATE 1.

## Archivos a crear/modificar

### Componentes (todos son chunks independientes — no se solapan, el build puede paralelizarse)

- `src/components/ModalGasto.vue` — modificar:
  - Template L41: `<div class="modal-fondo" @click.self="emit('cerrar')">` → `<div class="modal-fondo">` (quitar solo el handler; conservar la clase para el estilo del overlay).
  - Script: borrar la función `manejarTecla` completa (L23-28, incluido su JSDoc L23).
  - `onMounted` (L30-33): quitar L31 `window.addEventListener('keydown', manejarTecla)`; conservar `storeUi.abrirModal()`.
  - `onUnmounted` (L34-37): quitar L35 `window.removeEventListener('keydown', manejarTecla)`; conservar `storeUi.cerrarModal()`.
  - `onMounted`/`onUnmounted` siguen usándose (por `storeUi`), así que el import de L2 se mantiene.
  - Actualizar el JSDoc del componente (L9-10): "Cierra con clic en el backdrop, la tecla Escape o el botón de cierre." → "Cierra solo con el botón de cierre (X)."

- `src/components/ModalIngreso.vue` — modificar: idéntico a ModalGasto. Template L36 (quitar `@click.self`), función `manejarTecla` L18-23, `addEventListener` L26, `removeEventListener` L31, JSDoc L8-9. Mantener `storeUi` y el import de L2.

- `src/components/ModalCategoria.vue` — modificar: idéntico. Template L42, función L24-29, `addEventListener` L32, `removeEventListener` L36, JSDoc L9-10. Ojo: este emite además `pedir-desactivar` — NO tocar.

- `src/components/ModalBanco.vue` — modificar: idéntico a ModalIngreso. Template L36, función L18-23, `addEventListener` L26, `removeEventListener` L31, JSDoc L8-9.

- `src/components/ModalPresupuesto.vue` — modificar: idéntico. Template L42, función L24-29, `addEventListener` L32, `removeEventListener` L36, JSDoc L9-10. Emite además `pedir-eliminar` — NO tocar.

- `src/components/HojaAccionesFab.vue` — modificar:
  - Template L37: `<div class="hoja-fondo" @click.self="emit('cerrar')">` → `<div class="hoja-fondo">`.
  - Borrar función `manejarTecla` L19-24.
  - `onMounted` L26-29: quitar L27 `addEventListener`; conservar `storeUi.abrirModal()`.
  - `onUnmounted` L30-33: quitar L31 `removeEventListener`; conservar `storeUi.cerrarModal()`.
  - Conservar el botón "Cancelar" (`.boton-cancelar-hoja`, L45-47) que emite `cerrar` — es ahora la ÚNICA vía de cierre (esta hoja no tiene X).
  - Actualizar JSDoc L5-9 que menciona "(backdrop/Escape)".

- `src/components/DialogoConfirmacion.vue` — modificar:
  - Template L17: `<div class="modal-fondo" @click.self="emit('cancelar')">` → `<div class="modal-fondo">`.
  - No hay `manejarTecla` ni `onMounted`/`onUnmounted` que tocar.
  - Conservar los botones "Confirmar"/"Cancelar" (L21-22).

### Tests
- `src/components/__tests__/DialogoConfirmacion.spec.ts` — modificar (invertir 1 caso).
- `src/components/__tests__/HojaAccionesFab.spec.ts` — modificar (invertir 2 casos, revisar 2).
- `src/components/__tests__/ModalGasto.spec.ts` — **crear**.
- `src/components/__tests__/ModalIngreso.spec.ts` — **crear**.
- `src/components/__tests__/ModalCategoria.spec.ts` — **crear**.
- `src/components/__tests__/ModalBanco.spec.ts` — **crear**.
- `src/components/__tests__/ModalPresupuesto.spec.ts` — **crear**.

Nota: hoy NO existen specs para los 5 modales; solo hay specs para `DialogoConfirmacion` y `HojaAccionesFab`. `CategoriasView.spec.ts` y `PresupuestosView.spec.ts` referencian modales pero NO prueban cierre por backdrop/Escape (grep sin coincidencias), así que no requieren cambios por esta tarea.

## Plan de pruebas

### Tests existentes que verifican HOY que backdrop/Escape SÍ cierran → van a fallar, hay que invertirlos

- `DialogoConfirmacion.spec.ts` L32-39 — `'borde: clic en el fondo del modal también cancela (no confirma)'`: hace `find('.modal-fondo').trigger('click')` y espera `emitted('cancelar')` con longitud 1. **Invertir**: renombrar a "clic en el fondo NO cancela" y esperar que `emitted('cancelar')` sea `undefined` (y `confirmar` siga `undefined`).

- `HojaAccionesFab.spec.ts` L49-56 — `'cierra al hacer clic en el backdrop...'`: espera `emitted('cerrar')` longitud 1. **Invertir**: "NO cierra al hacer clic en el backdrop" → esperar `emitted('cerrar')` `undefined`.

- `HojaAccionesFab.spec.ts` L67-75 — `'cierra al presionar Escape...'`: dispara `keydown` Escape y espera `emitted('cerrar')` longitud 1. **Invertir**: "NO cierra al presionar Escape" → esperar `emitted('cerrar')` `undefined`.

### Tests existentes a revisar (premisa desactualizada, no fallan pero conviene ajustar)

- `HojaAccionesFab.spec.ts` L58-65 — `'NO cierra al hacer clic dentro del contenido...'`: seguirá pasando, pero su descripción dice "(solo el backdrop dispara el cierre)", que ya es falso. Ajustar el texto del `it` (el backdrop ya no dispara cierre en absoluto).
- `HojaAccionesFab.spec.ts` L77-85 — `'otras teclas no disparan el cierre'`: seguirá pasando (ninguna tecla cierra ya). Puede conservarse; opcionalmente reencuadrar como "ninguna tecla cierra la hoja" o eliminarse por redundante con el test de Escape invertido.

### Tests existentes que deben seguir verdes sin cambios (botón explícito sigue cerrando)

- `HojaAccionesFab.spec.ts` L87-94 — `'el botón "Cancelar" también emite cerrar'`.
- `DialogoConfirmacion.spec.ts` L14-30 — Confirmar emite `confirmar`; Cancelar emite `cancelar` y no `confirmar`.

### Tests nuevos (crear specs para los 5 modales)

Para cada uno de `ModalGasto`, `ModalIngreso`, `ModalCategoria`, `ModalBanco`, `ModalPresupuesto` crear un spec con:

- Camino feliz — el botón X cierra: `mount`, `find('button.modal-cerrar').trigger('click')`, esperar `emitted('cerrar')` longitud 1. Envolver en Pinia: `setActivePinia(createPinia())` en `beforeEach` (usan `useUiStore`) y `unmount` en `afterEach`. Para `ModalGasto`, `ModalCategoria` y `ModalPresupuesto` pasar la prop opcional (`gasto`/`categoria`/`presupuesto`) como `null` para el caso alta.
- Borde — clic en el backdrop NO cierra: `find('.modal-fondo').trigger('click')`, esperar `emitted('cerrar')` `undefined`.
- Borde — Escape NO cierra: `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`, `await nextTick`, esperar `emitted('cerrar')` `undefined`.
- (Opcional, refuerza el contrato con el store) al montarse `storeUi.modalAbierto === true` y al `unmount()` vuelve a `false`, como ya hace el spec de `HojaAccionesFab`.

Los formularios hijos (`FormularioGasto`, etc.) pueden dejarse montar normalmente o stubearse; si montarlos requiere dependencias pesadas (stores/servicios), stubearlos con `global.stubs` para aislar la prueba del overlay.

## Sugerencias fuera de alcance (NO incluidas en el build)
- El mecanismo de cierre (backdrop + Escape + botón + `storeUi`) está duplicado casi idéntico en 6 componentes. Un composable `useOverlay()` o un componente base `<ModalBase>` reduciría la duplicación y haría que cambios como este sean de un solo punto. No se aborda ahora para mantener el alcance acotado.
- Accesibilidad: al quitar Escape, un modal con `aria-modal="true"` idealmente debería mantener foco atrapado y foco inicial en la X. Fuera del alcance de esta tarea.
