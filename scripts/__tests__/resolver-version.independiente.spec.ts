import { execSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { resolverCommitDesdeEnv, resolverCommitDesdeGit } from '../resolver-version'

/**
 * Validación INDEPENDIENTE del build de Épica 9 (Versionado), separada de
 * `resolver-version.spec.ts` de dev-builder. No mockea `execSync`: ejercita
 * la función real contra el repo real de este proyecto, para corroborar que
 * nunca lanza y siempre devuelve o un hash corto real (repo con commits) o
 * `null` (repo sin commits/sin git) — sin acoplarse al estado transitorio
 * del repo en el momento en que se escribió este test (ver historial: el
 * repo no tenía commits al principio, y sí los tiene desde entonces).
 */
describe('resolverCommitDesdeGit — contra el repo real (sin mocks)', () => {
  it('con execSync real, nunca lanza y devuelve un hash corto válido o null', () => {
    let resultado: string | null = null
    expect(() => {
      resultado = resolverCommitDesdeGit((comando) => execSync(comando, { encoding: 'utf-8' }))
    }).not.toThrow()
    if (resultado !== null) {
      expect(resultado).toMatch(/^[0-9a-f]{4,40}$/)
    }
  })
})

describe('Precedencia Vercel vs. git (orden `??` de vite.config.ts)', () => {
  it('si ambas fuentes están disponibles, gana la de Vercel (no la de git)', () => {
    const entorno = { VERCEL_GIT_COMMIT_SHA: '1234567890abcdef1234567890abcdef12345678' }
    // Simula que git SÍ tiene commits disponibles (a diferencia del repo real
    // de este proyecto) para probar el caso "ambas fuentes disponibles".
    const gitConCommits = () => 'fedcba9\n'

    const commit = resolverCommitDesdeEnv(entorno) ?? resolverCommitDesdeGit(gitConCommits)

    expect(commit).toBe('1234567') // el de Vercel, recortado — NO 'fedcba9'
  })

  it('si Vercel no está disponible mas git sí, usa el de git', () => {
    const entorno = {}
    const gitConCommits = () => 'fedcba9\n'

    const commit = resolverCommitDesdeEnv(entorno) ?? resolverCommitDesdeGit(gitConCommits)

    expect(commit).toBe('fedcba9')
  })
})

describe('Recorte a 7 caracteres', () => {
  it('resolverCommitDesdeEnv siempre recorta un SHA completo (40 chars) a 7', () => {
    const shaCompleto = 'a'.repeat(40)
    expect(resolverCommitDesdeEnv({ VERCEL_GIT_COMMIT_SHA: shaCompleto })).toBe('aaaaaaa')
    expect(resolverCommitDesdeEnv({ VERCEL_GIT_COMMIT_SHA: shaCompleto })!.length).toBe(7)
  })

  it('HALLAZGO: resolverCommitDesdeGit NO recorta explícitamente — confía en que `git --short` ya dé 7', () => {
    // Si por alguna configuración de git (core.abbrev distinto, o un hash
    // ambiguo que obliga a git a alargar el short-sha) `--short` devolviera
    // más de 7 caracteres, esta función los deja pasar tal cual, a
    // diferencia de `resolverCommitDesdeEnv` que sí impone `.slice(0, 7)`.
    const salidaGitMasLarga = () => 'abcdef123\n' // 9 caracteres, hipotético
    const resultado = resolverCommitDesdeGit(salidaGitMasLarga)
    expect(resultado).toBe('abcdef123')
    expect(resultado!.length).not.toBe(7) // documenta la asimetría, no una garantía de 7 siempre
  })
})
