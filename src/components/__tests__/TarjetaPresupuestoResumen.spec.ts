import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import TarjetaPresupuestoResumen from '@/components/TarjetaPresupuestoResumen.vue'

describe('TarjetaPresupuestoResumen (Fase 0 "Caudal")', () => {
  it('camino feliz: % consumido correcto y línea "proyecta S/ X" con la proyección recibida', () => {
    const wrapper = mount(TarjetaPresupuestoResumen, {
      props: { gastado: 450, limite: 900, proyeccion: 900, moneda: 'PEN' },
    })

    expect(wrapper.find('.porcentaje-presupuesto-resumen').text()).toBe('50%')
    expect(wrapper.find('.monto-gastado-presupuesto-resumen').text()).toContain('450.00')
    expect(wrapper.find('.monto-limite-presupuesto-resumen').text()).toContain('900.00')
    expect(wrapper.find('.proyeccion-presupuesto-resumen').text().toLowerCase()).toContain('proyecta')
    expect(wrapper.find('.proyeccion-presupuesto-resumen').text()).toContain('900.00')
  })

  it('borde: sin límite (0) no divide por cero: 0% y estado normal', () => {
    const wrapper = mount(TarjetaPresupuestoResumen, {
      props: { gastado: 300, limite: 0, proyeccion: 0, moneda: 'PEN' },
    })

    expect(wrapper.find('.porcentaje-presupuesto-resumen').text()).toBe('0%')
    expect(wrapper.find('.barra-progreso').classes()).toContain('estado-normal')
  })

  it('estado "cerca del límite" (>=85%) usa la clase estado-cerca', () => {
    const wrapper = mount(TarjetaPresupuestoResumen, {
      props: { gastado: 90, limite: 100, proyeccion: 120, moneda: 'PEN' },
    })

    expect(wrapper.find('.barra-progreso').classes()).toContain('estado-cerca')
  })

  it('sobregiro (>100%) usa la clase estado-sobregiro y el porcentaje real puede superar 100', () => {
    const wrapper = mount(TarjetaPresupuestoResumen, {
      props: { gastado: 150, limite: 100, proyeccion: 200, moneda: 'PEN' },
    })

    expect(wrapper.find('.barra-progreso').classes()).toContain('estado-sobregiro')
    expect(wrapper.find('.porcentaje-presupuesto-resumen').text()).toBe('150%')
  })

  it('sin topCategorias (default vacío), no renderiza la sección de top categorías (compatibilidad con el uso anterior)', () => {
    const wrapper = mount(TarjetaPresupuestoResumen, {
      props: { gastado: 450, limite: 900, proyeccion: 900, moneda: 'PEN' },
    })

    expect(wrapper.find('.top-categorias-presupuesto-resumen').exists()).toBe(false)
  })

  it('con topCategorias, renderiza el top-3 con nombre y monto formateado, ordenado como llegó', () => {
    const wrapper = mount(TarjetaPresupuestoResumen, {
      props: {
        gastado: 450,
        limite: 900,
        proyeccion: 900,
        moneda: 'PEN',
        topCategorias: [
          { nombre: 'Comida', total: 200 },
          { nombre: 'Transporte', total: 150 },
          { nombre: 'Ocio', total: 100 },
        ],
      },
    })

    const filas = wrapper.findAll('.fila-top-categoria-presupuesto-resumen')
    expect(filas).toHaveLength(3)
    expect(filas[0].find('.nombre-top-categoria-presupuesto-resumen').text()).toBe('Comida')
    expect(filas[0].find('.monto-top-categoria-presupuesto-resumen').text()).toContain('200.00')
    expect(filas[2].find('.nombre-top-categoria-presupuesto-resumen').text()).toBe('Ocio')
  })
})
