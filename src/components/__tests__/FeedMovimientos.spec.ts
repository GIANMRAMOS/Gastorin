import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import FeedMovimientos, { type MovimientoFeed } from '@/components/FeedMovimientos.vue'

function movimientoDe(datos: Partial<MovimientoFeed>): MovimientoFeed {
  return {
    tipo: 'gasto',
    fecha: '2026-07-15',
    monto: 100,
    descripcion: 'Almuerzo',
    moneda: 'PEN',
    id: `m-${Math.random()}`,
    categoriaId: 'c1',
    bancoId: 'b1',
    nombreCategoria: 'Comida',
    nombreBanco: 'BCP',
    creadoEn: '2026-07-10T10:00:00.000Z',
    ...datos,
  }
}

describe('FeedMovimientos (Fase 0 "Caudal")', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 15)) // 15 jul 2026: fija "Hoy"/"Ayer"
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('agrupa por fecha con encabezados "Hoy" y "Ayer"', () => {
    const wrapper = mount(FeedMovimientos, {
      props: {
        movimientos: [
          movimientoDe({ id: 'hoy1', fecha: '2026-07-15' }),
          movimientoDe({ id: 'ayer1', fecha: '2026-07-14' }),
        ],
      },
    })

    const etiquetas = wrapper.findAll('.etiqueta-grupo-feed').map((e) => e.text())
    expect(etiquetas).toEqual(['Hoy', 'Ayer'])
  })

  it('un gasto muestra concepto y "categoría · banco"', () => {
    const wrapper = mount(FeedMovimientos, {
      props: {
        movimientos: [
          movimientoDe({
            tipo: 'gasto',
            descripcion: 'Taxi',
            nombreCategoria: 'Transporte',
            nombreBanco: 'BBVA',
          }),
        ],
      },
    })

    expect(wrapper.find('.concepto-feed').text()).toBe('Taxi')
    expect(wrapper.find('.subtitulo-feed').text()).toBe('Transporte · BBVA')
  })

  it('borde: un gasto sin categoría resuelta (nombreCategoria null) usa el fallback "Categoría", no queda vacío ni "null"', () => {
    const wrapper = mount(FeedMovimientos, {
      props: {
        movimientos: [
          movimientoDe({
            tipo: 'gasto',
            descripcion: 'Compra suelta',
            categoriaId: null,
            nombreCategoria: null,
            nombreBanco: 'BCP',
          }),
        ],
      },
    })

    expect(wrapper.find('.subtitulo-feed').text()).toBe('Categoría · BCP')
  })

  it('un ingreso NO muestra categoría: solo el banco en la línea secundaria', () => {
    const wrapper = mount(FeedMovimientos, {
      props: {
        movimientos: [
          movimientoDe({
            tipo: 'ingreso',
            descripcion: 'Sueldo',
            categoriaId: null,
            nombreCategoria: null,
            nombreBanco: 'Interbank',
          }),
        ],
      },
    })

    expect(wrapper.find('.subtitulo-feed').text()).toBe('Interbank')
    expect(wrapper.find('.subtitulo-feed').text()).not.toContain('·')
  })

  it('monto de un gasto: signo "−" y color coral', () => {
    const wrapper = mount(FeedMovimientos, {
      props: { movimientos: [movimientoDe({ tipo: 'gasto', monto: 80 })] },
    })

    const monto = wrapper.find('.monto-feed')
    expect(monto.classes()).toContain('monto-feed-egreso')
    expect(monto.text()).toContain('−')
    expect(monto.text()).toContain('80.00')
  })

  it('monto de un ingreso: signo "+" y color verde', () => {
    const wrapper = mount(FeedMovimientos, {
      props: { movimientos: [movimientoDe({ tipo: 'ingreso', monto: 500 })] },
    })

    const monto = wrapper.find('.monto-feed')
    expect(monto.classes()).toContain('monto-feed-ingreso')
    expect(monto.text()).toContain('+')
    expect(monto.text()).toContain('500.00')
  })

  it('cambiar el filtro (prop movimientos) cambia la lista renderizada', async () => {
    const wrapper = mount(FeedMovimientos, {
      props: { movimientos: [movimientoDe({ id: 'g1', tipo: 'gasto' }), movimientoDe({ id: 'i1', tipo: 'ingreso' })] },
    })

    expect(wrapper.findAll('.item-feed')).toHaveLength(2)

    await wrapper.setProps({ movimientos: [movimientoDe({ id: 'i1', tipo: 'ingreso' })] })

    expect(wrapper.findAll('.item-feed')).toHaveLength(1)
  })

  it('estado vacío: "Ningún movimiento con estos filtros."', () => {
    const wrapper = mount(FeedMovimientos, { props: { movimientos: [] } })

    expect(wrapper.text()).toContain('Ningún movimiento con estos filtros.')
    expect(wrapper.findAll('.item-feed')).toHaveLength(0)
  })
})
