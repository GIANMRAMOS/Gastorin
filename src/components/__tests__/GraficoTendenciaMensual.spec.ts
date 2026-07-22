import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import GraficoTendenciaMensual from '@/components/GraficoTendenciaMensual.vue'

const seisMeses = [
  { mes: '2026-02', total: 0 },
  { mes: '2026-03', total: 50 },
  { mes: '2026-04', total: 0 },
  { mes: '2026-05', total: 30 },
  { mes: '2026-06', total: 0 },
  { mes: '2026-07', total: 100 },
]

describe('GraficoTendenciaMensual (HU-7.3)', () => {
  it('camino feliz: renderiza exactamente 6 barras, una por mes de la ventana', () => {
    const wrapper = mount(GraficoTendenciaMensual, { props: { datos: seisMeses, moneda: 'PEN' } })

    expect(wrapper.findAll('.columna-tendencia')).toHaveLength(6)
  })

  it('el mes actual (último elemento) se resalta con la clase primaria; los anteriores no', () => {
    const wrapper = mount(GraficoTendenciaMensual, { props: { datos: seisMeses, moneda: 'PEN' } })

    const columnas = wrapper.findAll('.columna-tendencia')
    expect(columnas[5].classes()).toContain('columna-actual')
    expect(wrapper.findAll('.barra-actual')).toHaveLength(1)
    expect(wrapper.findAll('.barra-tendencia')[5].classes()).toContain('barra-actual')

    for (let i = 0; i < 5; i++) {
      expect(columnas[i].classes()).not.toContain('columna-actual')
    }
  })

  it('borde: los meses en cero se renderizan igual (sin hueco ni error), con altura 0%', () => {
    const wrapper = mount(GraficoTendenciaMensual, { props: { datos: seisMeses, moneda: 'PEN' } })

    const barras = wrapper.findAll('.barra-tendencia')
    expect(barras).toHaveLength(6)
    expect(barras[0].attributes('style')).toContain('height: 0%') // 2026-02, total 0
    expect(barras[2].attributes('style')).toContain('height: 0%') // 2026-04, total 0
  })

  it('la barra con el total máximo alcanza 100% de altura', () => {
    const wrapper = mount(GraficoTendenciaMensual, { props: { datos: seisMeses, moneda: 'PEN' } })

    const barras = wrapper.findAll('.barra-tendencia')
    expect(barras[5].attributes('style')).toContain('height: 100%') // 2026-07, total 100 (máximo)
  })
})
