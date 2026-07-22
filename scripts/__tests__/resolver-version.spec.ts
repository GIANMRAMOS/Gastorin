import { describe, expect, it } from 'vitest'
import { resolverCommitDesdeEnv, resolverCommitDesdeGit } from '../resolver-version'

describe('resolverCommitDesdeEnv', () => {
  it('camino feliz: con VERCEL_GIT_COMMIT_SHA recorta a 7 caracteres', () => {
    expect(resolverCommitDesdeEnv({ VERCEL_GIT_COMMIT_SHA: '1234567890abcdef' })).toBe('1234567')
  })

  it('borde: sin la variable de entorno devuelve null', () => {
    expect(resolverCommitDesdeEnv({})).toBe(null)
  })
})

describe('resolverCommitDesdeGit', () => {
  it('camino feliz: recorta espacios/saltos de línea de la salida de git', () => {
    const ejecutar = () => 'abcdef1\n'
    expect(resolverCommitDesdeGit(ejecutar)).toBe('abcdef1')
  })

  it('borde: salida vacía o solo espacios devuelve null', () => {
    const ejecutar = () => '   \n'
    expect(resolverCommitDesdeGit(ejecutar)).toBe(null)
  })

  it('error: si "ejecutar" lanza excepción, devuelve null sin propagarla', () => {
    const ejecutar = () => {
      throw new Error('no es un repositorio git')
    }
    expect(resolverCommitDesdeGit(ejecutar)).toBe(null)
  })
})
