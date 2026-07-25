import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import HeroPresupuesto from '@/components/HeroPresupuesto.vue'

describe('HeroPresupuesto', () => {
  it('no excedido: muestra "Quedan S/X" y la barra en estado normal', () => {
    const wrapper = mount(HeroPresupuesto, {
      props: { gastado: 400, limite: 1000, moneda: 'PEN', ritmoEsperadoPct: 50, diaActual: 15 },
    })

    expect(wrapper.find('.porcentaje-hero').text()).toBe('40%')
    expect(wrapper.find('.nota-restante-hero').text()).toContain('Quedan')
    expect(wrapper.find('.nota-excedido-hero').exists()).toBe(false)
    expect(wrapper.find('.barra-progreso-hero').classes()).toContain('estado-normal')
  })

  it('excedido: muestra "Excedido en S/Y" en la clase de color de error y la barra en sobregiro', () => {
    const wrapper = mount(HeroPresupuesto, {
      props: { gastado: 1200, limite: 1000, moneda: 'PEN', ritmoEsperadoPct: 50, diaActual: 15 },
    })

    const notaExcedido = wrapper.find('.nota-excedido-hero')
    expect(notaExcedido.exists()).toBe(true)
    expect(notaExcedido.text()).toContain('Excedido en')
    expect(wrapper.find('.barra-progreso-hero').classes()).toContain('estado-sobregiro')
    // A11y: el % siempre en su propia clase (blanco), nunca la del estado de la barra.
    expect(wrapper.find('.porcentaje-hero').classes()).not.toContain('estado-sobregiro')
  })

  it('sin límite configurado (0), no divide por cero: 0% y estado normal', () => {
    const wrapper = mount(HeroPresupuesto, {
      props: { gastado: 0, limite: 0, moneda: 'PEN', ritmoEsperadoPct: 0, diaActual: 1 },
    })

    expect(wrapper.find('.porcentaje-hero').text()).toBe('0%')
    expect(wrapper.find('.barra-progreso-hero').classes()).toContain('estado-normal')
  })

  it('muestra el ritmo esperado al día indicado', () => {
    const wrapper = mount(HeroPresupuesto, {
      props: { gastado: 100, limite: 1000, moneda: 'PEN', ritmoEsperadoPct: 48.4, diaActual: 15 },
    })

    expect(wrapper.find('.nota-ritmo-hero').text()).toBe('Ritmo esperado al día 15: 48%')
  })
})
