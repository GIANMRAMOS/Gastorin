import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import TarjetaResumenMoneda from '@/components/TarjetaResumenMoneda.vue'

describe('TarjetaResumenMoneda (HU-7.1)', () => {
  it('camino feliz: muestra el monto formateado según la moneda', () => {
    const wrapper = mount(TarjetaResumenMoneda, {
      props: { moneda: 'PEN', total: 1234.5, variacionPct: null },
    })

    expect(wrapper.find('.monto-resumen').text()).toContain('1,234.50')
  })

  it('variación al alza (>0): flecha ▲ con la clase de subida', () => {
    const wrapper = mount(TarjetaResumenMoneda, {
      props: { moneda: 'PEN', total: 150, variacionPct: 50 },
    })

    const variacion = wrapper.find('.variacion-resumen')
    expect(variacion.classes()).toContain('variacion-sube')
    expect(variacion.text()).toContain('▲')
    expect(variacion.text()).toContain('50.0%')
  })

  it('variación a la baja (<0): flecha ▼ con la clase de bajada', () => {
    const wrapper = mount(TarjetaResumenMoneda, {
      props: { moneda: 'USD', total: 40, variacionPct: -60 },
    })

    const variacion = wrapper.find('.variacion-resumen')
    expect(variacion.classes()).toContain('variacion-baja')
    expect(variacion.text()).toContain('▼')
    expect(variacion.text()).toContain('60.0%')
  })

  it('borde: variacionPct null (moneda sin gastos este mes) no muestra flecha, solo "Sin variación"', () => {
    const wrapper = mount(TarjetaResumenMoneda, {
      props: { moneda: 'USD', total: 0, variacionPct: null },
    })

    expect(wrapper.find('.monto-resumen').text()).toContain('0.00')
    expect(wrapper.find('.variacion-sin-dato').exists()).toBe(true)
    expect(wrapper.find('.variacion-sube').exists()).toBe(false)
    expect(wrapper.find('.variacion-baja').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('▲')
    expect(wrapper.text()).not.toContain('▼')
  })
})
