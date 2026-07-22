import { afterEach, describe, expect, it, vi } from 'vitest'
import { useVersion } from '@/composables/useVersion'

/**
 * `useVersion` referencia identificadores "bare" (`__GASTORIN_*__`) que en
 * build resuelve Vite vía `define`, pero en test resuelven contra
 * `globalThis` normal — exactamente lo que `vi.stubGlobal` modifica.
 */
describe('useVersion', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('camino feliz: con commit y build de producción arma "vX.Y.Z · commit"', () => {
    vi.stubGlobal('__GASTORIN_VERSION__', '1.2.3')
    vi.stubGlobal('__GASTORIN_COMMIT__', 'abc1234')
    vi.stubGlobal('__GASTORIN_ES_DEV__', false)

    const { textoVersion, commitCompleto } = useVersion()

    expect(textoVersion).toBe('v1.2.3 · abc1234')
    expect(commitCompleto).toBe('abc1234')
  })

  it('borde: sin commit resuelto, muestra "sin commit" y commitCompleto es null', () => {
    vi.stubGlobal('__GASTORIN_VERSION__', '1.2.3')
    vi.stubGlobal('__GASTORIN_COMMIT__', null)
    vi.stubGlobal('__GASTORIN_ES_DEV__', false)

    const { textoVersion, commitCompleto } = useVersion()

    expect(textoVersion).toContain('sin commit')
    expect(commitCompleto).toBe(null)
  })

  it('camino feliz: en build de desarrollo agrega el sufijo "-dev" a la versión', () => {
    vi.stubGlobal('__GASTORIN_VERSION__', '1.2.3')
    vi.stubGlobal('__GASTORIN_COMMIT__', 'abc1234')
    vi.stubGlobal('__GASTORIN_ES_DEV__', true)

    const { textoVersion } = useVersion()

    expect(textoVersion).toBe('v1.2.3-dev · abc1234')
  })
})
