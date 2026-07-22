import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ToggleMoneda from '@/components/ToggleMoneda.vue'

/**
 * Pruebas del toggle segmentado PEN/USD, componente presentacional puro
 * extraído de `FormularioGasto.vue`.
 */
describe('ToggleMoneda', () => {
  it('camino feliz: click en PEN emite update:modelValue con "PEN"', async () => {
    const wrapper = mount(ToggleMoneda, { props: { modelValue: '' } })

    await wrapper.findAll('button')[0].trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([['PEN']])
  })

  it('camino feliz: click en USD emite update:modelValue con "USD"', async () => {
    const wrapper = mount(ToggleMoneda, { props: { modelValue: '' } })

    await wrapper.findAll('button')[1].trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([['USD']])
  })

  it('borde: con disabled=true, el click en PEN o USD no emite nada', async () => {
    const wrapper = mount(ToggleMoneda, { props: { modelValue: 'PEN', disabled: true } })

    await wrapper.findAll('button')[0].trigger('click')
    await wrapper.findAll('button')[1].trigger('click')

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('el botón activo refleja el modelValue actual (PEN)', () => {
    const wrapper = mount(ToggleMoneda, { props: { modelValue: 'PEN' } })
    const botones = wrapper.findAll('button')

    expect(botones[0].classes()).toContain('activo')
    expect(botones[1].classes()).not.toContain('activo')
  })

  it('el botón activo refleja el modelValue actual (USD)', () => {
    const wrapper = mount(ToggleMoneda, { props: { modelValue: 'USD' } })
    const botones = wrapper.findAll('button')

    expect(botones[0].classes()).not.toContain('activo')
    expect(botones[1].classes()).toContain('activo')
  })

  it('borde: con modelValue vacío, ningún botón está activo', () => {
    const wrapper = mount(ToggleMoneda, { props: { modelValue: '' } })
    const botones = wrapper.findAll('button')

    expect(botones[0].classes()).not.toContain('activo')
    expect(botones[1].classes()).not.toContain('activo')
  })
})
