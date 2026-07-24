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

describe('useMoneda — resumenMonedaPredominante', () => {
  it('mayoría PEN: suma solo los montos en PEN, ignora el USD', () => {
    const { resumenMonedaPredominante } = useMoneda()
    const resumen = resumenMonedaPredominante([
      { moneda: 'PEN', monto: 10 },
      { moneda: 'PEN', monto: 20 },
      { moneda: 'USD', monto: 100 },
    ])
    expect(resumen).toEqual({ moneda: 'PEN', total: 30 })
  })

  it('mayoría USD: suma solo los montos en USD, ignora el PEN', () => {
    const { resumenMonedaPredominante } = useMoneda()
    const resumen = resumenMonedaPredominante([
      { moneda: 'USD', monto: 10 },
      { moneda: 'USD', monto: 5 },
      { moneda: 'PEN', monto: 100 },
    ])
    expect(resumen).toEqual({ moneda: 'USD', total: 15 })
  })

  it('predomina por CONTEO, no por monto: 3 gastos pequeños en USD vs. 1 gasto grande en PEN da predominante USD', () => {
    const { resumenMonedaPredominante } = useMoneda()
    const resumen = resumenMonedaPredominante([
      { moneda: 'USD', monto: 5 },
      { moneda: 'USD', monto: 3 },
      { moneda: 'USD', monto: 2 },
      { moneda: 'PEN', monto: 1000 },
    ])
    // Si la implementación sumara montos en vez de contar movimientos, el
    // resultado sería PEN (1000 > 10). El criterio correcto es conteo:
    // 3 movimientos USD > 1 movimiento PEN → predomina USD, total = 10.
    expect(resumen).toEqual({ moneda: 'USD', total: 10 })
  })

  it('empate (1 PEN y 1 USD): PEN gana y el total es solo el del PEN', () => {
    const { resumenMonedaPredominante } = useMoneda()
    const resumen = resumenMonedaPredominante([
      { moneda: 'PEN', monto: 40 },
      { moneda: 'USD', monto: 99 },
    ])
    expect(resumen).toEqual({ moneda: 'PEN', total: 40 })
  })

  it('un solo ítem: la moneda predominante es la de ese ítem', () => {
    const { resumenMonedaPredominante } = useMoneda()
    const resumen = resumenMonedaPredominante([{ moneda: 'USD', monto: 7.5 }])
    expect(resumen).toEqual({ moneda: 'USD', total: 7.5 })
  })

  it('array vacío devuelve null (nada que totalizar)', () => {
    const { resumenMonedaPredominante } = useMoneda()
    expect(resumenMonedaPredominante([])).toBeNull()
  })

  it('conjunto homogéneo (ya filtrado a una sola moneda) se resuelve sin caso especial', () => {
    const { resumenMonedaPredominante } = useMoneda()
    const resumen = resumenMonedaPredominante([
      { moneda: 'USD', monto: 10 },
      { moneda: 'USD', monto: 20 },
    ])
    expect(resumen).toEqual({ moneda: 'USD', total: 30 })
  })

  it('borde: monto 0 y montos decimales suman correctamente (el 0 no se descarta)', () => {
    const { resumenMonedaPredominante } = useMoneda()
    const resumen = resumenMonedaPredominante([
      { moneda: 'PEN', monto: 0 },
      { moneda: 'PEN', monto: 15.75 },
    ])
    expect(resumen).toEqual({ moneda: 'PEN', total: 15.75 })
  })
})

describe('useMoneda — saldosPorBanco', () => {
  it('camino feliz: un banco, una sola moneda (PEN) → la clave USD no está presente', () => {
    const { saldosPorBanco } = useMoneda()
    const resultado = saldosPorBanco([
      { bancoId: 'b1', nombreBanco: 'BCP Debito', moneda: 'PEN', monto: 10 },
      { bancoId: 'b1', nombreBanco: 'BCP Debito', moneda: 'PEN', monto: 20 },
    ])
    expect(resultado).toEqual([
      { bancoId: 'b1', nombreBanco: 'BCP Debito', montosPorMoneda: { PEN: 30 } },
    ])
    expect(resultado[0].montosPorMoneda).not.toHaveProperty('USD')
  })

  it('un banco con ambas monedas: PEN y USD se acumulan por separado, sin sumarse entre sí', () => {
    const { saldosPorBanco } = useMoneda()
    const resultado = saldosPorBanco([
      { bancoId: 'b1', nombreBanco: 'BCP Debito', moneda: 'PEN', monto: 10 },
      { bancoId: 'b1', nombreBanco: 'BCP Debito', moneda: 'USD', monto: 5 },
      { bancoId: 'b1', nombreBanco: 'BCP Debito', moneda: 'USD', monto: 2 },
    ])
    expect(resultado).toEqual([
      { bancoId: 'b1', nombreBanco: 'BCP Debito', montosPorMoneda: { PEN: 10, USD: 7 } },
    ])
  })

  it('varios bancos: cada uno genera su propia entrada con su propio montosPorMoneda', () => {
    const { saldosPorBanco } = useMoneda()
    const resultado = saldosPorBanco([
      { bancoId: 'b1', nombreBanco: 'BCP', moneda: 'PEN', monto: 100 },
      { bancoId: 'b2', nombreBanco: 'Interbank', moneda: 'USD', monto: 20 },
    ])
    expect(resultado).toEqual([
      { bancoId: 'b1', nombreBanco: 'BCP', montosPorMoneda: { PEN: 100 } },
      { bancoId: 'b2', nombreBanco: 'Interbank', montosPorMoneda: { USD: 20 } },
    ])
  })

  it('excluye el banco "No especificado" de forma case-insensitive, el resto sí aparece', () => {
    const { saldosPorBanco } = useMoneda()
    const resultado = saldosPorBanco([
      { bancoId: 'b0', nombreBanco: 'No especificado', moneda: 'PEN', monto: 50 },
      { bancoId: 'b0b', nombreBanco: 'no especificado', moneda: 'USD', monto: 15 },
      { bancoId: 'b1', nombreBanco: 'BCP', moneda: 'PEN', monto: 100 },
    ])
    expect(resultado).toEqual([{ bancoId: 'b1', nombreBanco: 'BCP', montosPorMoneda: { PEN: 100 } }])
  })

  it('omite las combinaciones banco+moneda en 0: la clave USD no aparece (no "USD: 0")', () => {
    const { saldosPorBanco } = useMoneda()
    const resultado = saldosPorBanco([{ bancoId: 'b1', nombreBanco: 'BCP', moneda: 'PEN', monto: 40 }])
    expect(resultado).toEqual([{ bancoId: 'b1', nombreBanco: 'BCP', montosPorMoneda: { PEN: 40 } }])
    expect(resultado[0].montosPorMoneda).not.toHaveProperty('USD')
  })

  it('conjunto vacío devuelve un array vacío', () => {
    const { saldosPorBanco } = useMoneda()
    expect(saldosPorBanco([])).toEqual([])
  })

  it('borde: el total de una moneda suma 0 → esa combinación se omite (no se muestra $ 0.00)', () => {
    const { saldosPorBanco } = useMoneda()
    // Decisión documentada en el plan: un banco con movimientos en USD que se
    // cancelan entre sí (+10 y -10) no debe mostrar "USD: $0.00"; la clave
    // simplemente no aparece, igual que si no hubiera habido movimientos.
    const resultado = saldosPorBanco([
      { bancoId: 'b1', nombreBanco: 'BCP', moneda: 'USD', monto: 10 },
      { bancoId: 'b1', nombreBanco: 'BCP', moneda: 'USD', monto: -10 },
      { bancoId: 'b1', nombreBanco: 'BCP', moneda: 'PEN', monto: 50 },
    ])
    expect(resultado).toEqual([{ bancoId: 'b1', nombreBanco: 'BCP', montosPorMoneda: { PEN: 50 } }])
  })
})

describe('useMoneda — montoSinBancoPorMoneda', () => {
  it('camino feliz: monto excluido en UNA sola moneda (PEN), sin clave USD', () => {
    const { montoSinBancoPorMoneda } = useMoneda()
    const resultado = montoSinBancoPorMoneda([
      { nombreBanco: 'No especificado', moneda: 'PEN', monto: 1460.53 },
      { nombreBanco: 'No especificado', moneda: 'PEN', monto: 1000 },
      { nombreBanco: 'BCP', moneda: 'PEN', monto: 200 },
    ])
    expect(resultado.PEN).toBeCloseTo(2460.53, 2)
    expect(resultado).not.toHaveProperty('USD')
  })

  it('monto excluido en AMBAS monedas: se suman por separado', () => {
    const { montoSinBancoPorMoneda } = useMoneda()
    const resultado = montoSinBancoPorMoneda([
      { nombreBanco: 'No especificado', moneda: 'PEN', monto: 100 },
      { nombreBanco: 'No especificado', moneda: 'USD', monto: 30 },
      { nombreBanco: 'No especificado', moneda: 'USD', monto: 20 },
    ])
    expect(resultado).toEqual({ PEN: 100, USD: 50 })
  })

  it('sin ningún ítem "No especificado": devuelve objeto vacío', () => {
    const { montoSinBancoPorMoneda } = useMoneda()
    const resultado = montoSinBancoPorMoneda([
      { nombreBanco: 'BCP', moneda: 'PEN', monto: 100 },
      { nombreBanco: 'Interbank', moneda: 'USD', monto: 20 },
    ])
    expect(resultado).toEqual({})
  })

  it('case-insensitive: "no especificado" y "No Especificado" cuentan igual que "No especificado"', () => {
    const { montoSinBancoPorMoneda } = useMoneda()
    const resultado = montoSinBancoPorMoneda([
      { nombreBanco: 'no especificado', moneda: 'PEN', monto: 10 },
      { nombreBanco: 'No Especificado', moneda: 'PEN', monto: 5 },
    ])
    expect(resultado).toEqual({ PEN: 15 })
  })

  it('borde: total exacto 0 no se muestra; si hay otra moneda > 0 solo esa aparece', () => {
    const { montoSinBancoPorMoneda } = useMoneda()
    const resultado = montoSinBancoPorMoneda([
      { nombreBanco: 'No especificado', moneda: 'USD', monto: 10 },
      { nombreBanco: 'No especificado', moneda: 'USD', monto: -10 },
      { nombreBanco: 'No especificado', moneda: 'PEN', monto: 40 },
    ])
    expect(resultado).toEqual({ PEN: 40 })
    expect(resultado).not.toHaveProperty('USD')
  })

  it('conjunto vacío devuelve objeto vacío', () => {
    const { montoSinBancoPorMoneda } = useMoneda()
    expect(montoSinBancoPorMoneda([])).toEqual({})
  })

  it('aislamiento: los montos de bancos reales no se cuentan aquí', () => {
    const { montoSinBancoPorMoneda } = useMoneda()
    const resultado = montoSinBancoPorMoneda([
      { nombreBanco: 'BCP', moneda: 'PEN', monto: 500 },
      { nombreBanco: 'Interbank', moneda: 'USD', monto: 300 },
      { nombreBanco: 'No especificado', moneda: 'PEN', monto: 25 },
    ])
    expect(resultado).toEqual({ PEN: 25 })
  })
})
