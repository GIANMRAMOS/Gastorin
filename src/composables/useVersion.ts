/**
 * Constantes de build inyectadas por `vite.config.ts` (bloque `define`).
 * Declaradas localmente (además de en `env.d.ts`) para que el type-check de
 * `src/` las resuelva sin depender de que la raíz esté en su grafo de
 * compilación (ver Épica 9, riesgo de configuración #2).
 */
declare const __GASTORIN_VERSION__: string
declare const __GASTORIN_COMMIT__: string | null
declare const __GASTORIN_ES_DEV__: boolean

/**
 * Composable puro (sin estado ni store) que expone la versión de build de la
 * app y el commit resuelto, para mostrarlos en el sidebar y permitir copiar
 * el hash completo (trazabilidad build → runtime, HU-9.1/HU-9.2).
 */
export function useVersion() {
  const commitCompleto = __GASTORIN_COMMIT__

  /** Texto legible: `vX.Y.Z[-dev] · <commit|sin commit>`. */
  const sufijoDev = __GASTORIN_ES_DEV__ ? '-dev' : ''
  const textoCommit = commitCompleto ?? 'sin commit'
  const textoVersion = `v${__GASTORIN_VERSION__}${sufijoDev} · ${textoCommit}`

  return { textoVersion, commitCompleto }
}
