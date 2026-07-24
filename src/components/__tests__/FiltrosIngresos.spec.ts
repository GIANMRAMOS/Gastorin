import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import FiltrosIngresos from '@/components/FiltrosIngresos.vue'
import type { Banco } from '@/types/ingreso'

/**
 * Pruebas del presentacional de filtros de Ingresos: chips de moneda (uno
 * activo a la vez) y dropdowns de banco/mes. Espejo reducido de
 * `FiltrosHistorial.spec.ts`, sin casos de categoría (Ingresos no tiene ese
 * concepto).
 */
const bancosFalsos: Banco[] = [
  { id: 'b1', usuario_id: 'u1', nombre: 'BCP', created_at: '' },
  { id: 'b2', usuario_id: 'u1', nombre: 'Interbank', created_at: '' },
]

function montar(props: Partial<Record<string, unknown>> = {}) {
  return mount(FiltrosIngresos, {
    props: {
      moneda: 'todos',
      bancoId: '',
      mes: '',
      bancos: bancosFalsos,
      mesesDisponibles: ['2026-07', '2026-06'],
      ...props,
    },
  })
}

describe('FiltrosIngresos', () => {
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

  it('camino feliz: elegir un mes en el dropdown emite update:mes', async () => {
    const wrapper = montar()

    const select = wrapper.find('select[aria-label="Filtrar por mes"]')
    await select.setValue('2026-06')

    expect(wrapper.emitted('update:mes')).toEqual([['2026-06']])
  })

  it('"Todos los bancos" es la opción por defecto y elegir un banco emite update:bancoId', async () => {
    const wrapper = montar()

    const select = wrapper.find('select[aria-label="Filtrar por banco"]')
    expect(select.find('option').text()).toBe('Todos los bancos')

    await select.setValue('b2')

    expect(wrapper.emitted('update:bancoId')).toEqual([['b2']])
  })

  it('no existe ningún select de categoría (Ingresos no tiene ese concepto)', () => {
    const wrapper = montar()

    expect(wrapper.find('select[aria-label="Filtrar por categoría"]').exists()).toBe(false)
  })
})
