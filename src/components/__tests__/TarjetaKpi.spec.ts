import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import TarjetaKpi from '@/components/TarjetaKpi.vue'

/**
 * Pruebas de la tarjeta KPI genérica del Dashboard "Caudal" (Fase 1),
 * sucesora de `TarjetaHeroBalance` (que agrupaba las 3 métricas en una sola
 * card). Cada variante (ingreso/egreso/balance) es la misma tarjeta
 * parametrizada.
 */
describe('TarjetaKpi (Fase 1 "Caudal")', () => {
  it('variante ingreso: aplica la clase de la variante y muestra el monto en la clase con --fuente-mono', () => {
    const wrapper = mount(TarjetaKpi, {
      props: { label: 'Ingresos', monto: 1200, moneda: 'PEN', variante: 'ingreso' },
    })

    expect(wrapper.classes()).toContain('tarjeta-kpi-ingreso')
    const monto = wrapper.find('.monto-kpi')
    expect(monto.exists()).toBe(true)
    expect(monto.text()).toContain('1,200.00')
    expect(wrapper.find('.etiqueta-kpi').text()).toBe('Ingresos')
  })

  it('variante egreso: aplica la clase de la variante', () => {
    const wrapper = mount(TarjetaKpi, {
      props: { label: 'Egresos', monto: 450, moneda: 'PEN', variante: 'egreso' },
    })

    expect(wrapper.classes()).toContain('tarjeta-kpi-egreso')
    expect(wrapper.find('.monto-kpi').text()).toContain('450.00')
  })

  it('variante balance con mostrarSigno: positivo muestra signo "+" sin clase negativa', () => {
    const wrapper = mount(TarjetaKpi, {
      props: { label: 'Balance', monto: 700, moneda: 'PEN', variante: 'balance', mostrarSigno: true },
    })

    expect(wrapper.classes()).toContain('tarjeta-kpi-balance')
    const monto = wrapper.find('.monto-kpi')
    expect(monto.classes()).not.toContain('monto-kpi-negativo')
    expect(monto.find('.signo-kpi').text()).toBe('+')
    expect(monto.text()).toContain('700.00')
  })

  it('variante balance con mostrarSigno: negativo muestra signo "−" y clase negativa, monto en valor absoluto', () => {
    const wrapper = mount(TarjetaKpi, {
      props: { label: 'Balance', monto: -300, moneda: 'PEN', variante: 'balance', mostrarSigno: true },
    })

    const monto = wrapper.find('.monto-kpi')
    expect(monto.classes()).toContain('monto-kpi-negativo')
    expect(monto.find('.signo-kpi').text()).toBe('−')
    expect(monto.text()).toContain('300.00')
    expect(monto.text()).not.toContain('-300.00')
  })

  it('borde: balance en cero con mostrarSigno se trata como positivo (signo "+")', () => {
    const wrapper = mount(TarjetaKpi, {
      props: { label: 'Balance', monto: 0, moneda: 'PEN', variante: 'balance', mostrarSigno: true },
    })

    const monto = wrapper.find('.monto-kpi')
    expect(monto.classes()).not.toContain('monto-kpi-negativo')
    expect(monto.find('.signo-kpi').text()).toBe('+')
  })

  it('sin mostrarSigno (default), no se renderiza ningún signo (uso de Ingresos/Egresos)', () => {
    const wrapper = mount(TarjetaKpi, {
      props: { label: 'Egresos', monto: 450, moneda: 'PEN', variante: 'egreso' },
    })

    expect(wrapper.find('.signo-kpi').exists()).toBe(false)
  })

  it('subtitulo opcional: se renderiza solo si se pasa la prop', () => {
    const sinSubtitulo = mount(TarjetaKpi, {
      props: { label: 'Ingresos', monto: 100, moneda: 'PEN', variante: 'ingreso' },
    })
    expect(sinSubtitulo.find('.subtitulo-kpi').exists()).toBe(false)

    const conSubtitulo = mount(TarjetaKpi, {
      props: { label: 'Ingresos', monto: 100, moneda: 'PEN', variante: 'ingreso', subtitulo: '+12% vs mes anterior' },
    })
    expect(conSubtitulo.find('.subtitulo-kpi').text()).toBe('+12% vs mes anterior')
  })
})
