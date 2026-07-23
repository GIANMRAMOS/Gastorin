import { describe, expect, it } from 'vitest'
import { resolverEstado, validarPayload } from '../logica'

describe('validarPayload', () => {
  it('camino feliz: gmail_message_id y fecha válidos, sin más campos, es válido', () => {
    const resultado = validarPayload({ gmail_message_id: 'msg-1', fecha: '2026-07-20' })
    expect(resultado).toEqual({ valido: true })
  })

  it('borde: sin gmail_message_id responde inválido con motivo "validación"', () => {
    const resultado = validarPayload({ fecha: '2026-07-20' })
    expect(resultado).toEqual({ valido: false, motivo: 'validación' })
  })

  it('borde: gmail_message_id vacío es inválido', () => {
    const resultado = validarPayload({ gmail_message_id: '   ', fecha: '2026-07-20' })
    expect(resultado.valido).toBe(false)
  })

  it('borde: sin fecha responde inválido', () => {
    const resultado = validarPayload({ gmail_message_id: 'msg-1' })
    expect(resultado).toEqual({ valido: false, motivo: 'validación' })
  })

  it('borde: fecha con formato incorrecto es inválida', () => {
    const resultado = validarPayload({ gmail_message_id: 'msg-1', fecha: '20/07/2026' })
    expect(resultado.valido).toBe(false)
  })

  it('borde: monto negativo o cero es inválido', () => {
    expect(validarPayload({ gmail_message_id: 'm', fecha: '2026-07-20', monto: 0 }).valido).toBe(false)
    expect(validarPayload({ gmail_message_id: 'm', fecha: '2026-07-20', monto: -5 }).valido).toBe(false)
  })

  it('borde: moneda fuera de PEN/USD es inválida', () => {
    const resultado = validarPayload({ gmail_message_id: 'm', fecha: '2026-07-20', moneda: 'EUR' })
    expect(resultado.valido).toBe(false)
  })

  it('camino feliz: monto y moneda válidos junto a los requeridos son válidos', () => {
    const resultado = validarPayload({
      gmail_message_id: 'm',
      fecha: '2026-07-20',
      monto: 45.5,
      moneda: 'PEN',
    })
    expect(resultado).toEqual({ valido: true })
  })

  it('borde: banco_nombre de tipo no-string (ej. número) es inválido', () => {
    const resultado = validarPayload({
      gmail_message_id: 'm',
      fecha: '2026-07-20',
      banco_nombre: 12345,
    })
    expect(resultado).toEqual({ valido: false, motivo: 'validación' })
  })

  it('camino feliz: banco_nombre como string junto a los requeridos es válido', () => {
    const resultado = validarPayload({
      gmail_message_id: 'm',
      fecha: '2026-07-20',
      banco_nombre: 'BCP Debito',
    })
    expect(resultado).toEqual({ valido: true })
  })
})

describe('resolverEstado', () => {
  it('camino feliz: con monto, moneda y ambiguo:false, el estado es "borrador"', () => {
    const estado = resolverEstado({
      gmail_message_id: 'm',
      fecha: '2026-07-20',
      monto: 45.5,
      moneda: 'PEN',
      ambiguo: false,
    })
    expect(estado).toBe('borrador')
  })

  it('borde: ambiguo:true fuerza "revision_manual" aunque monto y moneda estén completos', () => {
    const estado = resolverEstado({
      gmail_message_id: 'm',
      fecha: '2026-07-20',
      monto: 45.5,
      moneda: 'PEN',
      ambiguo: true,
    })
    expect(estado).toBe('revision_manual')
  })

  it('borde: falta el monto fuerza "revision_manual"', () => {
    const estado = resolverEstado({ gmail_message_id: 'm', fecha: '2026-07-20', moneda: 'PEN' })
    expect(estado).toBe('revision_manual')
  })

  it('borde: falta la moneda fuerza "revision_manual"', () => {
    const estado = resolverEstado({ gmail_message_id: 'm', fecha: '2026-07-20', monto: 45.5 })
    expect(estado).toBe('revision_manual')
  })
})
