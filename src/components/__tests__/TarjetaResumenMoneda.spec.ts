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

  it('prop etiqueta (Dashboard 3x2): con etiqueta="Ingresos este mes" se muestra ese texto', () => {
    const wrapper = mount(TarjetaResumenMoneda, {
      props: { moneda: 'PEN', total: 500, variacionPct: null, etiqueta: 'Ingresos este mes' },
    })

    expect(wrapper.find('.etiqueta-resumen').text()).toBe('Ingresos este mes')
  })

  it('borde: sin pasar la prop etiqueta, el default sigue siendo "Gastado este mes" (no rompe la fila 1)', () => {
    const wrapper = mount(TarjetaResumenMoneda, {
      props: { moneda: 'PEN', total: 100, variacionPct: null },
    })

    expect(wrapper.find('.etiqueta-resumen').text()).toBe('Gastado este mes')
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

  it('insignia USD (camino feliz): con montoSecundario y monedaSecundaria se muestra el equivalente en $', () => {
    const wrapper = mount(TarjetaResumenMoneda, {
      props: {
        moneda: 'PEN',
        total: 150,
        variacionPct: null,
        montoSecundario: 40,
        monedaSecundaria: 'USD',
      },
    })

    const insignia = wrapper.find('.insignia-secundaria')
    expect(insignia.exists()).toBe(true)
    expect(insignia.text()).toContain('40.00')
    expect(insignia.text()).toContain('$')
    expect(wrapper.find('.monto-resumen').text()).not.toContain('40.00')
  })

  it('borde: sin montoSecundario/monedaSecundaria no se renderiza la insignia', () => {
    const wrapper = mount(TarjetaResumenMoneda, {
      props: { moneda: 'PEN', total: 150, variacionPct: null },
    })

    expect(wrapper.find('.insignia-secundaria').exists()).toBe(false)
  })

  it('la insignia es informativa: no contiene enlaces ni botones', () => {
    const wrapper = mount(TarjetaResumenMoneda, {
      props: {
        moneda: 'PEN',
        total: 150,
        variacionPct: null,
        montoSecundario: 40,
        monedaSecundaria: 'USD',
      },
    })

    const insignia = wrapper.find('.insignia-secundaria')
    expect(insignia.find('a').exists()).toBe(false)
    expect(insignia.find('button').exists()).toBe(false)
    expect(insignia.find('router-link').exists()).toBe(false)
  })
})
