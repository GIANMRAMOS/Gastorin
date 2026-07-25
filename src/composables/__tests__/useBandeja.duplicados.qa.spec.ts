import { describe, expect, it } from 'vitest'
import { calcularPosiblesDuplicados } from '@/composables/useBandeja'
import type { Gasto } from '@/types/gasto'

/**
 * QA independiente de HU-14.2 (`calcularPosiblesDuplicados`), enfocado en tres
 * huecos NO cubiertos por `useBandeja.spec.ts`:
 *  - la ventana de ±3 días cruzando fin de mes/año (diferencia de fecha real,
 *    no de string),
 *  - que un grupo de 3+ borradores no marque de más ni de menos (evita falsos
 *    positivos por comparación transitiva incorrecta),
 *  - que un borrador nunca se compare consigo mismo (no debería poder
 *    "duplicarse de sí mismo").
 */
const base: Gasto = {
  id: 'x',
  usuario_id: 'u1',
  categoria_id: 'c1',
  banco_id: 'banco-1',
  monto: 50,
  moneda: 'PEN',
  fecha: '2026-06-30',
  descripcion: 'Comercio X',
  origen: 'correo',
  estado: 'borrador',
  gmail_message_id: 'msg-x',
  gmail_fragmento: null,
  creado_en: '2026-06-30T00:00:00Z',
  actualizado_en: '2026-06-30T00:00:00Z',
}

describe('calcularPosiblesDuplicados — QA independiente (HU-14.2)', () => {
  it('cruce de mes: 30 de junio vs 2 de julio (2 días de diferencia real) SÍ se marca como posible duplicado', () => {
    const a = { ...base, id: 'd1', fecha: '2026-06-30' }
    const b = { ...base, id: 'd2', fecha: '2026-07-02' }

    const resultado = calcularPosiblesDuplicados([a, b])

    expect(resultado.has('d1')).toBe(true)
    expect(resultado.has('d2')).toBe(true)
  })

  it('cruce de mes: si la diferencia real supera 3 días (28 jun vs 2 jul = 4 días) NO se marca, pese a cruzar de mes', () => {
    const a = { ...base, id: 'd1', fecha: '2026-06-28' }
    const b = { ...base, id: 'd2', fecha: '2026-07-02' }

    const resultado = calcularPosiblesDuplicados([a, b])

    expect(resultado.size).toBe(0)
  })

  it('cruce de año: 30 de diciembre 2026 vs 1 de enero 2027 (2 días) SÍ se marca', () => {
    const a = { ...base, id: 'd1', fecha: '2026-12-30' }
    const b = { ...base, id: 'd2', fecha: '2027-01-01' }

    const resultado = calcularPosiblesDuplicados([a, b])

    expect(resultado.has('d1')).toBe(true)
    expect(resultado.has('d2')).toBe(true)
  })

  it('grupo de 3: A-B duplicados entre sí, C con otro monto NO se marca ni contamina el resultado', () => {
    const a = { ...base, id: 'd1', monto: 100, fecha: '2026-07-20' }
    const b = { ...base, id: 'd2', monto: 100, fecha: '2026-07-21' }
    const c = { ...base, id: 'd3', monto: 999, fecha: '2026-07-20' }

    const resultado = calcularPosiblesDuplicados([a, b, c])

    expect(resultado.has('d1')).toBe(true)
    expect(resultado.has('d2')).toBe(true)
    expect(resultado.has('d3')).toBe(false)
    expect(resultado.size).toBe(2)
  })

  it('un único borrador en la lista nunca se marca como "duplicado de sí mismo"', () => {
    const a = { ...base, id: 'd1' }

    const resultado = calcularPosiblesDuplicados([a])

    expect(resultado.size).toBe(0)
  })

  it('tres borradores idénticos (mismo monto/banco/fecha) se marcan los tres, sin ids fuera del propio grupo', () => {
    const a = { ...base, id: 'd1', fecha: '2026-07-20' }
    const b = { ...base, id: 'd2', fecha: '2026-07-20' }
    const c = { ...base, id: 'd3', fecha: '2026-07-21' }

    const resultado = calcularPosiblesDuplicados([a, b, c])

    expect(resultado).toEqual(new Set(['d1', 'd2', 'd3']))
  })
})
