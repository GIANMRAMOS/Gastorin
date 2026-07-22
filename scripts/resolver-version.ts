/**
 * Funciones puras para resolver el commit de build en `vite.config.ts`, con
 * precedencia: variable de entorno de Vercel (recortada a 7 caracteres) →
 * `git rev-parse --short HEAD` → `null` si ninguna de las dos está disponible
 * (por ejemplo, un repo local sin commits todavía).
 */

/** Resuelve el commit corto (7 caracteres) desde la variable de entorno que inyecta Vercel. */
export function resolverCommitDesdeEnv(entorno: Record<string, string | undefined>): string | null {
  const sha = entorno.VERCEL_GIT_COMMIT_SHA
  return sha ? sha.slice(0, 7) : null
}

/**
 * Resuelve el commit corto ejecutando `git rev-parse --short HEAD` mediante la
 * función `ejecutar` inyectada (permite testear sin depender de un repo real).
 * Si el comando falla (por ejemplo, repo sin commits) o devuelve vacío,
 * degrada a `null` sin propagar la excepción.
 */
export function resolverCommitDesdeGit(ejecutar: (comando: string) => string): string | null {
  try {
    const salida = ejecutar('git rev-parse --short HEAD').trim()
    return salida || null
  } catch {
    return null
  }
}
