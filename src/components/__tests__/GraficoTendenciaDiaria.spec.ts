import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import GraficoTendenciaDiaria from '@/components/GraficoTendenciaDiaria.vue'

function generarTreintaDias(totalesNoNulos: Record<number, number> = {}): Array<{ dia: string; total: number }> {
  const dias: Array<{ dia: string; total: number }> = []
  for (let i = 0; i < 30; i++) {
    dias.push({ dia: `2026-06-${String(i + 16).padStart(2, '0')}`, total: totalesNoNulos[i] ?? 0 })
  }
  return dias
}

describe('GraficoTendenciaDiaria (Cambio 2)', () => {
  it('camino feliz: con 30 puntos renderiza 30 elementos/puntos', () => {
    const datos = generarTreintaDias({ 29: 100 })
    const wrapper = mount(GraficoTendenciaDiaria, { props: { datos, moneda: 'PEN' } })

    expect(wrapper.findAll('.punto-tendencia-diaria')).toHaveLength(30)
  })

  it('el último punto (hoy) se resalta con la clase de destacado; los anteriores no', () => {
    const datos = generarTreintaDias({ 29: 100 })
    const wrapper = mount(GraficoTendenciaDiaria, { props: { datos, moneda: 'PEN' } })

    const puntos = wrapper.findAll('.punto-tendencia-diaria')
    expect(puntos.at(-1)?.classes()).toContain('punto-actual')
    expect(wrapper.findAll('.punto-actual')).toHaveLength(1)
    for (let i = 0; i < 29; i++) {
      expect(puntos[i].classes()).not.toContain('punto-actual')
    }
  })

  it('borde: puntos con total 0 se renderizan sin error, con posición/altura en el piso de la escala', () => {
    const datos = generarTreintaDias({ 29: 100 })
    const wrapper = mount(GraficoTendenciaDiaria, { props: { datos, moneda: 'PEN' } })

    const puntos = wrapper.findAll('.punto-tendencia-diaria')
    expect(puntos).toHaveLength(30)
    // El primer día está en total 0: su Y debe estar en el piso del viewBox (100).
    expect(puntos[0].attributes('cy')).toBe('100')
  })

  it('el punto de total máximo alcanza el tope de la escala (Y = 0)', () => {
    const datos = generarTreintaDias({ 15: 100 })
    const wrapper = mount(GraficoTendenciaDiaria, { props: { datos, moneda: 'PEN' } })

    const puntos = wrapper.findAll('.punto-tendencia-diaria')
    expect(puntos[15].attributes('cy')).toBe('0')
  })
})
