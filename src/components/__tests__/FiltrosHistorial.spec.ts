import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import FiltrosHistorial from '@/components/FiltrosHistorial.vue'
import type { Categoria } from '@/types/gasto'
import type { Banco } from '@/types/ingreso'

/**
 * Pruebas del presentacional de filtros del historial: chips de moneda
 * (uno activo a la vez) y dropdowns de categoría/banco/mes. Se testea por
 * emisión, igual que `ToggleMoneda`.
 */
const categoriasFalsas: Categoria[] = [
  { id: 'c1', usuario_id: 'u1', nombre: 'Comida', predefinida: true, activa: true, creado_en: '', abreviatura: 'C' },
  { id: 'c2', usuario_id: 'u1', nombre: 'Ocio', predefinida: true, activa: true, creado_en: '', abreviatura: 'O' },
]

const bancosFalsos: Banco[] = [
  { id: 'b1', usuario_id: 'u1', nombre: 'BCP', created_at: '' },
  { id: 'b2', usuario_id: 'u1', nombre: 'Interbank', created_at: '' },
]

function montar(props: Partial<Record<string, unknown>> = {}) {
  return mount(FiltrosHistorial, {
    props: {
      moneda: 'todos',
      categoriaId: '',
      bancoId: '',
      mes: '',
      categorias: categoriasFalsas,
      bancos: bancosFalsos,
      mesesDisponibles: ['2026-07', '2026-06'],
      ...props,
    },
  })
}

describe('FiltrosHistorial', () => {
  it('camino feliz: click en el chip "S/ Soles" emite update:moneda con "PEN"', async () => {
    const wrapper = montar()

    const chips = wrapper.findAll('.chip-moneda')
    await chips[1].trigger('click')

    expect(wrapper.emitted('update:moneda')).toEqual([['PEN']])
  })

  it('camino feliz: click en el chip "$ Dólares" emite update:moneda con "USD"', async () => {
    const wrapper = montar()

    const chips = wrapper.findAll('.chip-moneda')
    await chips[2].trigger('click')

    expect(wrapper.emitted('update:moneda')).toEqual([['USD']])
  })

  it('camino feliz: click en "Todos" emite update:moneda con "todos"', async () => {
    const wrapper = montar({ moneda: 'PEN' })

    const chips = wrapper.findAll('.chip-moneda')
    await chips[0].trigger('click')

    expect(wrapper.emitted('update:moneda')).toEqual([['todos']])
  })

  it('solo el chip correspondiente a la moneda activa tiene la clase "activo"', () => {
    const wrapper = montar({ moneda: 'PEN' })

    const chips = wrapper.findAll('.chip-moneda')
    expect(chips[0].classes()).not.toContain('activo')
    expect(chips[1].classes()).toContain('activo')
    expect(chips[2].classes()).not.toContain('activo')
  })

  it('camino feliz: elegir una categoría en el dropdown emite update:categoriaId', async () => {
    const wrapper = montar()

    const select = wrapper.find('select[aria-label="Filtrar por categoría"]')
    await select.setValue('c2')

    expect(wrapper.emitted('update:categoriaId')).toEqual([['c2']])
  })

  it('camino feliz: elegir un mes en el dropdown emite update:mes', async () => {
    const wrapper = montar()

    const select = wrapper.find('select[aria-label="Filtrar por mes"]')
    await select.setValue('2026-06')

    expect(wrapper.emitted('update:mes')).toEqual([['2026-06']])
  })

  it('retrofit banco (Épica 3): "Todos los bancos" es la opción por defecto y elegir un banco emite update:bancoId', async () => {
    const wrapper = montar()

    const select = wrapper.find('select[aria-label="Filtrar por banco"]')
    expect(select.find('option').text()).toBe('Todos los bancos')

    await select.setValue('b2')

    expect(wrapper.emitted('update:bancoId')).toEqual([['b2']])
  })
})
