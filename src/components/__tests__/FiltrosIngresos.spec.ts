import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import FiltrosIngresos from '@/components/FiltrosIngresos.vue'
import type { Categoria } from '@/types/gasto'
import type { Banco } from '@/types/ingreso'

/**
 * Pruebas del presentacional de filtros de Ingresos (rediseño "Caudal", Fase
 * 2): chips de moneda (uno activo a la vez), buscador de texto libre y
 * dropdowns de categoría/banco/mes. Desde la migración 008 (Épica 12),
 * Ingreso SÍ tiene su propio catálogo de categorías: a diferencia de la Fase
 * 1, este componente ahora ofrece el mismo dropdown de categoría que
 * `FiltrosHistorial`.
 */
const categoriasFalsas: Categoria[] = [
  { id: 'ci1', usuario_id: 'u1', nombre: 'Sueldo', tipo: 'ingreso', predefinida: true, activa: true, creado_en: '', abreviatura: 'S' },
  { id: 'ci2', usuario_id: 'u1', nombre: 'Freelance', tipo: 'ingreso', predefinida: false, activa: true, creado_en: '', abreviatura: 'F' },
]

const bancosFalsos: Banco[] = [
  { id: 'b1', usuario_id: 'u1', nombre: 'BCP', created_at: '' },
  { id: 'b2', usuario_id: 'u1', nombre: 'Interbank', created_at: '' },
]

function montar(props: Partial<Record<string, unknown>> = {}) {
  return mount(FiltrosIngresos, {
    props: {
      moneda: 'todos',
      categoriaId: '',
      bancoId: '',
      mes: '',
      busqueda: '',
      categorias: categoriasFalsas,
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

  it('el selector de mes rotula cada opción como "Julio 2026", no el prefijo crudo "2026-07"', () => {
    const wrapper = montar()

    const select = wrapper.find('select[aria-label="Filtrar por mes"]')
    const opciones = select.findAll('option')
    expect(opciones.map((o) => o.text())).toEqual(['Todos los meses', 'Julio 2026', 'Junio 2026'])
  })

  it('"Todos los bancos" es la opción por defecto y elegir un banco emite update:bancoId', async () => {
    const wrapper = montar()

    const select = wrapper.find('select[aria-label="Filtrar por banco"]')
    expect(select.find('option').text()).toBe('Todos los bancos')

    await select.setValue('b2')

    expect(wrapper.emitted('update:bancoId')).toEqual([['b2']])
  })

  it('retrofit Épica 12: ahora SÍ existe un select de categoría, con "Todas las categorías" por defecto', async () => {
    const wrapper = montar()

    const select = wrapper.find('select[aria-label="Filtrar por categoría"]')
    expect(select.exists()).toBe(true)
    expect(select.find('option').text()).toBe('Todas las categorías')

    await select.setValue('ci2')

    expect(wrapper.emitted('update:categoriaId')).toEqual([['ci2']])
  })

  it('buscador de texto libre: escribir en el campo emite update:busqueda', async () => {
    const wrapper = montar()

    const buscador = wrapper.find('input[aria-label="Buscar por concepto"]')
    await buscador.setValue('sueldo')

    expect(wrapper.emitted('update:busqueda')).toEqual([['sueldo']])
  })
})
