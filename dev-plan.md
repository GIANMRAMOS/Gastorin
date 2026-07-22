# Micro-plan — Épica 9: Versionado y trazabilidad (HU-9.1, HU-9.2)

> Reemplaza el micro-plan de la Épica 7 (Dashboard), ya construida.
> La especificación técnica ya fue decidida por Architect y se aplica tal cual (no se rediseña).
> Este documento solo ordena la ejecución, detecta el patrón vigente y marca dos riesgos de build
> reales que el builder debe resolver.

## Patrón arquitectónico detectado

Proyecto Vue 3 + Vite 5 + TypeScript (strict) + Pinia + vue-router. Convenciones observadas:

- **Composables** en `src/composables/*.ts`, exportan `useXxx()` y devuelven un objeto. Los "puros"
  (sin estado ni store) siguen el estilo de `useMoneda.ts` / `useColorCategoria.ts`: cero dependencias
  de red/store, fáciles de testear. `useVersion` encaja exactamente en ese molde.
- **Tests** en `__tests__/` colindante al archivo, nombre `*.spec.ts`, Vitest con `globals: true`
  (las specs existentes igual importan `describe/it/expect` de `vitest` explícitamente — seguir ese
  estilo). `environment: jsdom`, `pool: 'forks'`, setup global en `src/test/setup.ts` (mockea
  supabaseClient; no afecta a esta épica).
- **Estilos**: CSS `scoped` por componente + design tokens en `src/assets/estilos-base.css`
  (`--color-texto-terciario`, `--color-texto-secundario`, `--tamano-pequeno: 0.875rem`, `--espacio-*`,
  `--radio-borde`, `--fuente-base`). No hay librería de UI; todo con vars.
- **Layout**: `src/layouts/AppShellLayout.vue` — `<aside class="barra-lateral">` (sidebar,
  `display:none` por defecto, `display:flex` solo en `@media (min-width: 900px)`) y
  `<nav class="navegacion-inferior">` (bottom-nav, se oculta en ≥900px). El bloque de cuenta es
  `<div class="bloque-cuenta">` (líneas ~115-126), último hijo del `<aside>` con `margin-top:auto`.
  Colocar la versión DENTRO del `<aside>` la deja automáticamente solo en sidebar (≥900px) y nunca en
  el bottom-nav, sin CSS extra de visibilidad.
- **Nomenclatura en español** en identificadores de dominio (funciones, refs, clases CSS).

El cambio encaja de forma natural: composable puro nuevo + inyección de constantes de build vía
`define` de Vite + un bloque de UI en el sidebar existente. Sin stores nuevos, sin rutas, sin tocar
`useAuth`/`stores/auth` ni otros composables/stores.

## Desviación de arquitectura

- ¿Se necesita desviarse? **NO** a nivel de arquitectura de la app. **No dispara GATE 1**: no toca el
  modelo de datos, no cruza >1 módulo de dominio de forma estructural, no introduce un patrón nuevo.
  Es puramente aditivo.

- **PERO hay dos ajustes de configuración de TypeScript** para que `npm run build`
  (`vue-tsc -b && vite build`) no falle. No son desviaciones de arquitectura, pero uno es bloqueante
  del build. Heads-up al builder (no GATE):

  1. **`tsconfig.node.json` necesita `resolveJsonModule: true` (BLOQUEANTE).** El `vite.config.ts` de la
     spec hace `import pkg from './package.json'`. `vite.config.ts` es el único `include` de
     `tsconfig.node.json`, y ese tsconfig NO tiene `resolveJsonModule`. Sin él, `vue-tsc -b` fallará con
     "Cannot find module './package.json'". Acción: añadir `"resolveJsonModule": true` a
     `tsconfig.node.json`. (`scripts/resolver-version.ts`, al ser importado por `vite.config.ts`, entra
     al mismo proyecto `node` y se type-checkea ahí; no usa DOM, así que `types: ["node"]` le basta.)

  2. **`env.d.ts` está en la RAÍZ, no en `src/`.** `tsconfig.app.json` incluye solo `src/**`, así que
     el `env.d.ts` de raíz NO está en el grafo de compilación de la app (hoy "funciona" porque
     `import.meta.env.VITE_*` resuelve por el index signature de `vite/client`). Consecuencia: agregar
     los 3 `declare const __GASTORIN_*__` a `env.d.ts` (raíz) es correcto **según la spec** y no rompe
     nada, pero esas globales NO quedarán visibles para archivos de `src/` en build. Esto NO bloquea el
     build porque `useVersion.ts` **ya declara localmente** las 3 constantes en su cabecera, y ningún
     otro archivo de `src/` las referencia directamente. Acción: aplicar la spec tal cual. (Ver
     Sugerencias fuera de alcance.)

## Archivos a crear/modificar

**Chunk A (independiente)**
- `scripts/resolver-version.ts` — **crear** — las dos funciones puras `resolverCommitDesdeEnv` y
  `resolverCommitDesdeGit`, exactamente como en la spec de Architect.
- `scripts/__tests__/resolver-version.spec.ts` — **crear** — ver Plan de pruebas.

**Chunk B (independiente)**
- `src/composables/useVersion.ts` — **crear** — con las 3 `declare const` locales y `useVersion()`
  según spec. (El directorio `src/composables/__tests__/` ya existe.)
- `src/composables/__tests__/useVersion.spec.ts` — **crear** — ver Plan de pruebas.

**Chunk C (config — escribible en paralelo; su validación real depende de A y B ya presentes)**
- `vite.config.ts` — **modificar** — añadir imports (`execSync` de `node:child_process`, las dos
  funciones de `./scripts/resolver-version`, `pkg from './package.json'`), calcular `esDev` y `commit`,
  y agregar el bloque `define: { __GASTORIN_VERSION__, __GASTORIN_COMMIT__, __GASTORIN_ES_DEV__ }`
  DENTRO de `defineConfig({...})` sin tocar `plugins`, `resolve.alias` ni `test`.
- `tsconfig.node.json` — **modificar** — añadir `"resolveJsonModule": true` (ver riesgo #1).
- `env.d.ts` — **modificar** — añadir las 3 `declare const __GASTORIN_VERSION__ / __GASTORIN_COMMIT__ /
  __GASTORIN_ES_DEV__` (ver riesgo #2; aplicar según spec).

**Chunk D (depende de Chunk B: importa `useVersion`)**
- `src/layouts/AppShellLayout.vue` — **modificar** — en `<script setup>` importar y usar `useVersion()`
  (`textoVersion`, `commitCompleto`); añadir un `ref` de confirmación "Copiado" y una función
  `copiarCommit()` que llame a `navigator.clipboard.writeText(commitCompleto)` SOLO si `commitCompleto`
  no es null, y active la confirmación breve (ref true + `setTimeout` para limpiarla). En `<template>`,
  debajo del `<div class="bloque-cuenta">` y aún DENTRO del `<aside class="barra-lateral">`, renderizar
  `textoVersion`. El hash de commit es el elemento tocable que dispara `copiarCommit`; si
  `commitCompleto` es null, NO debe ser interactivo. Añadir clases scoped mínimas (`.texto-version` con
  `font-size: var(--tamano-pequeno)` o menor y `color: var(--color-texto-terciario)`) reusando tokens.
  NO tocar la lógica de cuenta/salir/nav existente.
- `src/layouts/__tests__/AppShellLayout.spec.ts` — **modificar** (añadir un `describe` nuevo para
  HU-9.1; NO tocar el bloque HU-8.5 existente) — ver Plan de pruebas.

Orden sugerido de build paralelo: A y B en paralelo → C → D. Validación final (build + tests) secuencial.

## Plan de pruebas

### `scripts/__tests__/resolver-version.spec.ts`
- Camino feliz `resolverCommitDesdeEnv`: con `{ VERCEL_GIT_COMMIT_SHA: '1234567890abcdef' }` → `'1234567'`
  (recorta a 7).
- Borde `resolverCommitDesdeEnv`: sin la var (`{}`) → `null`.
- Camino feliz `resolverCommitDesdeGit`: `ejecutar` que devuelve `'abcdef1\n'` → `'abcdef1'` (trim).
- Borde `resolverCommitDesdeGit`: `ejecutar` que devuelve `''`/whitespace → `null` (por `|| null`).
- Error `resolverCommitDesdeGit`: `ejecutar` que lanza → `null`, sin propagar la excepción.

### `src/composables/__tests__/useVersion.spec.ts`
Usar `vi.stubGlobal('__GASTORIN_VERSION__', ...)` etc. sobre las 3 constantes; `vi.unstubAllGlobals()`
en `afterEach`. (Los identificadores bare de `useVersion.ts` resuelven contra `globalThis`, que es lo
que modifica `vi.stubGlobal`.)
- Con commit + prod: version `'1.2.3'`, commit `'abc1234'`, esDev `false` →
  `textoVersion === 'v1.2.3 · abc1234'` (separador `·`), `commitCompleto === 'abc1234'`.
- Sin commit: commit `null` → `textoVersion` contiene `'sin commit'`, `commitCompleto === null`.
- Dev: esDev `true` → `textoVersion` incluye el sufijo `-dev` (ej. `'v1.2.3-dev · ...'`).

### `src/layouts/__tests__/AppShellLayout.spec.ts` (nuevo describe — HU-9.1)
Reutilizar el helper `montarShell` existente (router en memoria + authStore). Para aislar del build,
preferible `vi.mock('@/composables/useVersion', ...)` y controlar `textoVersion`/`commitCompleto` por
caso (alternativa: `vi.stubGlobal` de las 3 globales).
- Camino feliz: `textoVersion` aparece renderizado dentro del `<aside class="barra-lateral">` (buscar
  por `.texto-version` o el texto).
- Copia: mockear `navigator.clipboard.writeText` (`vi.fn()` vía `Object.defineProperty`/`vi.stubGlobal`);
  al hacer click en el elemento del hash se llama con `commitCompleto` completo y aparece "Copiado".
- Borde: con `commitCompleto === null`, el hash no es tocable / no hay elemento interactivo → assert
  que `writeText` NO fue llamado.

### Criterios de aceptación (HU)

**HU-9.1 — Versión visible y hash copiable**
```gherkin
Escenario: Versión visible en el sidebar de escritorio
  Dado que estoy autenticado en una vista privada
  Cuando veo el sidebar (≥900px)
  Entonces bajo el bloque de cuenta veo el texto de versión (vX.Y.Z[-dev] · <commit|sin commit>)
  Y ese texto NO aparece en el bottom-nav móvil

Escenario: Copiar el hash de commit
  Dado que el commit se resolvió en build (commitCompleto no es null)
  Cuando toco el hash de commit
  Entonces se copia el commit completo al portapapeles
  Y veo una confirmación breve "Copiado"

Escenario: Sin commit disponible
  Dado que el build no resolvió commit (commitCompleto es null)
  Cuando veo la versión
  Entonces muestra "sin commit" y el hash no es tocable (no intenta copiar nada)
```

**HU-9.2 — Trazabilidad build → runtime**
- El commit se resuelve en build con precedencia: Vercel env (`VERCEL_GIT_COMMIT_SHA`, recortado a 7) →
  `git rev-parse --short HEAD` → `null`. Cubierto por `resolver-version.spec` y el caso "sin commit" de
  `useVersion.spec`.
- **Caso real de este repo**: no hay commits, así que `git rev-parse` fallará y el build debe producir
  `__GASTORIN_COMMIT__ = null`, con la UI mostrando "sin commit". Es la degradación esperada a verificar
  en el `npm run build` final (el build NO debe fallar por esto).

## Verificación final (a cargo del builder)
- `npm run build` (`vue-tsc -b && vite build`): debe pasar. Prerrequisito: aplicar el ajuste
  `resolveJsonModule: true` en `tsconfig.node.json` (riesgo #1), o fallará el type-check. Confirmar que
  con git sin commits el commit degrada a `null` sin romper el build.
- `npm run test:run` (`vitest run`): toda la suite verde, incluidas las 3 specs nuevas y el describe
  añadido a `AppShellLayout.spec.ts`.

## Sugerencias fuera de alcance (NO incluir en este build)
- Considerar mover `env.d.ts` a `src/` (o incluir la raíz en `tsconfig.app.json`) para que las globales
  de build y `ImportMetaEnv` estén realmente en el grafo de tipos de la app. Hoy es un no-op inofensivo;
  fuera del alcance de esta épica.
