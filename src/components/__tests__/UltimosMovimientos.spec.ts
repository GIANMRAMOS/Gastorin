import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import UltimosMovimientos from '@/components/UltimosMovimientos.vue'
import type { MovimientoUnificado } from '@/composables/useDashboard'

function movimientoDe(datos: Partial<MovimientoUnificado>): MovimientoUnificado {
  return {
    tipo: 'gasto',
    fecha: '2026-07-20',
    monto: 50,
    descripcion: 'Almuerzo',
    moneda: 'PEN',
    id: `m-${Math.random()}`,
    ...datos,
  }
}

describe('UltimosMovimientos', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 20)) // "hoy" fijo: 20 jul 2026
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('camino feliz: una fila por movimiento, en el orden recibido (no reordena)', () => {
    const movimientos = [
      movimientoDe({ id: 'm1', descripcion: 'Taxi' }),
      movimientoDe({ id: 'm2', descripcion: 'Sueldo', tipo: 'ingreso' }),
      movimientoDe({ id: 'm3', descripcion: 'Café' }),
    ]

    const wrapper = mount(UltimosMovimientos, { props: { movimientos } })

    const filas = wrapper.findAll('.item-movimiento')
    expect(filas).toHaveLength(3)
    expect(filas[0].text()).toContain('Taxi')
    expect(filas[1].text()).toContain('Sueldo')
    expect(filas[2].text()).toContain('Café')
  })

  it('un gasto se pinta en rojo y un ingreso en verde', () => {
    const movimientos = [
      movimientoDe({ id: 'g1', tipo: 'gasto' }),
      movimientoDe({ id: 'i1', tipo: 'ingreso' }),
    ]

    const wrapper = mount(UltimosMovimientos, { props: { movimientos } })

    const filas = wrapper.findAll('.item-movimiento')
    expect(filas[0].find('.monto-movimiento').classes()).toContain('monto-gasto')
    expect(filas[1].find('.monto-movimiento').classes()).toContain('monto-ingreso')
  })

  it('formatea el monto según la moneda propia de cada movimiento (PEN vs USD)', () => {
    const movimientos = [
      movimientoDe({ id: 'p1', monto: 100, moneda: 'PEN' }),
      movimientoDe({ id: 'u1', monto: 100, moneda: 'USD' }),
    ]

    const wrapper = mount(UltimosMovimientos, { props: { movimientos } })

    const montos = wrapper.findAll('.monto-movimiento')
    expect(montos[0].text()).toContain('S/')
    expect(montos[1].text()).toContain('$')
  })

  it('la fecha se muestra vía etiquetaFecha ("Hoy"/"Ayer"/larga)', () => {
    const movimientos = [
      movimientoDe({ id: 'h1', fecha: '2026-07-20' }),
      movimientoDe({ id: 'a1', fecha: '2026-07-19' }),
      movimientoDe({ id: 'l1', fecha: '2026-07-01' }),
    ]

    const wrapper = mount(UltimosMovimientos, { props: { movimientos } })

    const fechas = wrapper.findAll('.fecha-movimiento')
    expect(fechas[0].text()).toBe('Hoy')
    expect(fechas[1].text()).toBe('Ayer')
    expect(fechas[2].text()).toBe('1 de julio')
  })

  it('el indicador de tipo es accesible (aria-label)', () => {
    const movimientos = [movimientoDe({ id: 'g1', tipo: 'gasto' }), movimientoDe({ id: 'i1', tipo: 'ingreso' })]

    const wrapper = mount(UltimosMovimientos, { props: { movimientos } })

    const indicadores = wrapper.findAll('.indicador-tipo-movimiento')
    expect(indicadores[0].attributes('aria-label')).toBe('Gasto')
    expect(indicadores[1].attributes('aria-label')).toBe('Ingreso')
  })

  it('borde: sin movimientos muestra el estado vacío, sin filas', () => {
    const wrapper = mount(UltimosMovimientos, { props: { movimientos: [] } })

    expect(wrapper.find('.mensaje-vacio-seccion').text()).toBe('Aún no hay movimientos.')
    expect(wrapper.findAll('.item-movimiento')).toHaveLength(0)
  })

  it('no incluye ningún link "Ver todos"', () => {
    const wrapper = mount(UltimosMovimientos, { props: { movimientos: [movimientoDe({})] } })

    expect(wrapper.text().toLowerCase()).not.toContain('ver todos')
    expect(wrapper.findAll('a')).toHaveLength(0)
  })
})
