# Micro-plan — Retoque visual (tokens de diseño) + safe-area del bottom nav móvil

## Patrón arquitectónico detectado
- App Vue 3 + Vite. El sistema de diseño vive en un único archivo global de tokens: `src/assets/estilos-base.css`, bloque `:root` (líneas 1-54). Todas las variables CSS de color, tipografía, espaciado y radios están centralizadas ahí.
- Los componentes/layouts consumen esos tokens vía `var(--...)` en sus `<style scoped>`. Cambiar el valor de una variable en `:root` propaga automáticamente a todo consumidor que use `var(--...)`, sin tocar componentes.
- El bottom nav móvil es una regla `.navegacion-inferior` dentro del `<style scoped>` de `src/layouts/AppShellLayout.vue` (líneas 480-497). Actualmente su padding vertical es `padding: var(--espacio-2) var(--espacio-4)`.
- Este cambio encaja de forma natural en el patrón: es exactamente el uso previsto de los tokens centralizados. El safe-area es un ajuste local de una sola clase ya existente.

## Desviación de arquitectura
- ¿Se necesita desviarse? **NO.**
- No es estructural: no afecta al modelo de datos, no introduce patrones nuevos, no cambia contratos entre módulos. Es (a) sustitución de valores de variables ya existentes en un único `:root`, y (b) sumar una propiedad `padding-bottom` a una clase ya existente en un único layout. **No dispara GATE 1.**

## Archivos a crear/modificar

### Chunk A — Tokens (independiente)
- `src/assets/estilos-base.css` — modificar — reemplazar SOLO el valor de estas 14 variables en el bloque `:root` (mismos nombres, sin agregar ni renombrar):
  - `--color-fondo-app` (L8): `#f6f7f7` → `#f5f5f7`
  - `--color-texto` (L4): `#151a18` → `#1d1d1f`
  - `--color-texto-secundario` (L5): `#5c6663` → `#6e6e73`
  - `--color-texto-terciario` (L6): `#8b938f` → `#86868b`
  - `--color-primario` (L2): `#0e9384` → `#0071e3`
  - `--color-primario-hover` (L3): `#0b7a6e` → `#0077ed`
  - `--color-borde` (L9): `#dbe0de` → `#d2d2d7`
  - `--color-borde-tarjeta` (L10): `#ecefee` → `#e8e8ed`
  - `--sombra-foco` (L12): `0 0 0 3px rgba(14, 147, 132, 0.14)` → `0 0 0 3px rgba(0, 113, 227, 0.14)`
  - `--color-error` (L13): `#b91c1c` → `#ff3b30`
  - `--color-exito` (L15): `#15803d` → `#34c759`
  - `--color-advertencia` (L19): `#d97706` → `#ff9500`
  - `--fuente-base` (L38): `'Plus Jakarta Sans', system-ui, sans-serif` → `-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif`
  - `--radio-tarjeta` (L52): `22px` → `18px`
  - NO tocar: `--color-borde-foco` (ya es `var(--color-primario)`, hereda el azul solo), ni `--color-error-fondo`/`--color-exito-fondo`/`--color-advertencia-fondo` (fondos claros; el ajuste de matiz es opcional y NO se hace en este plan para no arriesgar contraste con el texto encima — ver Sugerencias fuera de alcance).

### Chunk B — Safe-area del bottom nav (independiente del Chunk A)
- `src/layouts/AppShellLayout.vue` — modificar — en la regla `.navegacion-inferior` (L480-497), sumar el safe-area SIN reemplazar el padding vertical existente. El padding actual es `padding: var(--espacio-2) var(--espacio-4)` (top/bottom = `--espacio-2` = 8px). Para sumar el inset del home indicator al padding inferior manteniendo los 8px como mínimo, añadir una línea:
  ```css
  padding-bottom: calc(var(--espacio-2) + env(safe-area-inset-bottom));
  ```
  Colocarla DESPUÉS del shorthand `padding` (para que gane por orden de cascada) y ANTES del bloque `overflow-x`. Así en un iPhone con home indicator el nav queda separado del borde, y en pantallas sin inset `env()` resuelve a 0 y conserva los 8px originales (comportamiento idéntico al actual). Nota: el `.contenido` ya reserva `padding-bottom: 88px` (L477), no se toca.

Chunks A y B no se solapan (archivos distintos) → el build puede paralelizarse.

## Plan de pruebas

### Impacto en tests existentes (verificado)
- **Ningún test se rompe.** Búsqueda en toda la carpeta de tests (`src/**/__tests__/**`): no existe ningún `toHaveStyle`, ni comparación contra hex hardcodeado (`#0e9384`, `#0b7a6e`, `#151a18`, etc.), ni assertion sobre `--radio-tarjeta` ni sobre `font-family`/`--fuente-base` con el valor viejo.
- Los tests que sí tocan color lo hacen contra el **nombre de la variable**, no su valor, y solo sobre variables de categoría que NO cambian:
  - `useColorCategoria.spec.ts`, `HistorialView.integracion.spec.ts`, `ListaGastoPorCategoria.spec.ts` → comparan contra `var(--color-categoria-*)` (tokens fuera de la tabla de cambios). Sin impacto.
  - `TarjetaPresupuesto.spec.ts`, `TarjetaBalanceMoneda.spec.ts` → validan uso de clase / nombre de variable (`--color-texto`, `--color-primario`, `--color-error`), no el hex. Sin impacto.
- No hace falta actualizar ningún test por el cambio de tokens.

### Camino feliz (validación manual/visual, ya aprobada por UX)
- La app renderiza con la paleta azul Apple: fondo `#f5f5f7`, primario `#0071e3` en botones/logo/FAB/enlaces, tipografía del sistema (`-apple-system`), tarjetas con radio 18px. Verificar que hover de botón primario pasa a `#0077ed` y que el foco de inputs muestra el halo azul (`--sombra-foco` + `--color-borde-foco` heredado).

### Borde / error
- Estados de error/éxito/advertencia: confirmar contraste legible del texto (`--color-error` `#ff3b30`, `--color-exito` `#34c759`, `--color-advertencia` `#ff9500`) sobre sus fondos claros SIN cambiar (`*-fondo`). Punto de atención: `#34c759` sobre `#f0fdf4` y `#ff9500` sobre `#fffbeb` son combinaciones de bajo contraste; validar visualmente que el texto sigue siendo legible (es el motivo por el que este plan NO ajusta los fondos).

### Safe-area (`env(safe-area-inset-bottom)`)
- **jsdom NO soporta `env()` ni evalúa CSS scoped a estilo computado** — el propio test `AppShellLayout.spec.ts` (comentario L209-214) documenta que `getComputedStyle` devuelve `''` para reglas del `<style scoped>` como `overflow-x`/`flex-shrink`. Por tanto **no es verificable por cálculo de estilo en unit test**; un assertion tipo `getComputedStyle(nav).paddingBottom` daría `''` y sería un falso indicador.
- Recomendación: **verificación por inspección del CSS fuente**, no por estilo computado. Opciones:
  1. (Preferida, mínima) Revisión manual del diff: confirmar que `.navegacion-inferior` contiene `padding-bottom: calc(var(--espacio-2) + env(safe-area-inset-bottom))`. No agregar unit test frágil.
  2. (Opcional) Test de humo que lea el `<style>` fuente del SFC y afirme que la cadena `env(safe-area-inset-bottom)` está presente en la regla del bottom nav (assertion sobre texto fuente, no sobre estilo renderizado). Solo si el equipo quiere un guard automatizado.
- Validación real del comportamiento: dispositivo/emulador iPhone con home indicator (ej. iPhone 16 Pro) o DevTools con viewport que simule safe-area → el nav no debe quedar pegado al borde inferior; en desktop/pantallas sin inset el layout debe verse idéntico al actual.

---

## Sugerencias fuera de alcance (NO incluidas en el plan; requieren decisión aparte)
Detectadas al leer el código. NO forman parte de esta tarea porque implican tocar componentes/selectores, lo cual está explícitamente vedado. Se anotan para coherencia visual futura:
- `AppShellLayout.vue` tiene colores del teal viejo **hardcodeados** (no usan variables), por lo que NO se actualizarán solos con este cambio y quedarán inconsistentes con el nuevo azul:
  - L379 `.item-nav.router-link-active { color: #0b7a6e }` y L377 `background: #e2f4f1`
  - L516 `.item-nav-movil.router-link-active { color: #0b7a6e }`
  - L530 `.boton-fab { box-shadow: 0 4px 12px rgba(14, 147, 132, 0.35) }`
  - También `#f1f3f2` (hover de items, L374/L470) y `rgba(21,26,24,0.06)` (sombra de `.tarjeta-auth`, L94 de estilos-base.css) siguen atados al gris/verde viejo.
- Si UX quiere coherencia total con la paleta Apple, habría que migrar esos literales a `var(--color-primario)` / `var(--color-primario-hover)` / un token de estado activo. Eso SÍ toca selectores y componentes → tarea separada, fuera de este retoque.
