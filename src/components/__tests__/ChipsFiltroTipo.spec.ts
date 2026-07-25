import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ChipsFiltroTipo from '@/components/ChipsFiltroTipo.vue'

describe('ChipsFiltroTipo (Fase 0 "Caudal")', () => {
  it('click en "Todos" emite update:modelValue con "todos"', async () => {
    const wrapper = mount(ChipsFiltroTipo, { props: { modelValue: 'egresos' } })

    await wrapper.findAll('button')[0].trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([['todos']])
  })

  it('click en "Ingresos" emite update:modelValue con "ingresos"', async () => {
    const wrapper = mount(ChipsFiltroTipo, { props: { modelValue: 'todos' } })

    await wrapper.findAll('button')[1].trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([['ingresos']])
  })

  it('click en "Egresos" emite update:modelValue con "egresos"', async () => {
    const wrapper = mount(ChipsFiltroTipo, { props: { modelValue: 'todos' } })

    await wrapper.findAll('button')[2].trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([['egresos']])
  })

  it('el chip activo refleja el modelValue actual', () => {
    const wrapper = mount(ChipsFiltroTipo, { props: { modelValue: 'ingresos' } })
    const chips = wrapper.findAll('button')

    expect(chips[0].classes()).not.toContain('activo')
    expect(chips[1].classes()).toContain('activo')
    expect(chips[2].classes()).not.toContain('activo')
  })

  it('borde: click en el chip ya activo no vuelve a emitir', async () => {
    const wrapper = mount(ChipsFiltroTipo, { props: { modelValue: 'todos' } })

    await wrapper.findAll('button')[0].trigger('click')

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})
