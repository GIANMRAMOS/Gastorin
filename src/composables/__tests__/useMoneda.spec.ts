import { describe, expect, it } from 'vitest'
import { useMoneda } from '@/composables/useMoneda'

// `Intl.NumberFormat('es-PE', ...)` separa el símbolo del monto con un
// espacio duro (U+00A0), no un espacio normal (U+0020).
const ESPACIO_DURO = '\u00A0'

describe('useMoneda', () => {
  it('camino feliz: formatea un monto en PEN con locale es-PE (símbolo S/)', () => {
    const { formatearMonto } = useMoneda()
    expect(formatearMonto(45.5, 'PEN')).toBe(`S/${ESPACIO_DURO}45.50`)
  })

  it('camino feliz: formatea un monto en USD con locale en-US (símbolo $)', () => {
    const { formatearMonto } = useMoneda()
    expect(formatearMonto(45.5, 'USD')).toBe('$45.50')
  })

  it('borde: monto 0 se formatea correctamente (no se trata como vacío/nulo)', () => {
    const { formatearMonto } = useMoneda()
    expect(formatearMonto(0, 'PEN')).toBe(`S/${ESPACIO_DURO}0.00`)
  })
})
