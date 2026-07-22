import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ListaGastoPorCategoria from '@/components/ListaGastoPorCategoria.vue'

describe('ListaGastoPorCategoria (HU-7.2)', () => {
  it('camino feliz: una barra por categoría, en el orden ya provisto (desc), con nombre y monto', () => {
    const wrapper = mount(ListaGastoPorCategoria, {
      props: {
        items: [
          { categoria_id: 'transporte', nombre: 'Transporte', total: 200 },
          { categoria_id: 'comida', nombre: 'Comida', total: 80 },
          { categoria_id: 'ocio', nombre: 'Ocio', total: 10 },
        ],
        moneda: 'PEN',
      },
    })

    const items = wrapper.findAll('.item-categoria')
    expect(items).toHaveLength(3)
    expect(items[0].text()).toContain('Transporte')
    expect(items[1].text()).toContain('Comida')
    expect(items[2].text()).toContain('Ocio')
  })

  it('la barra de mayor total ocupa 100% de ancho y las demás son proporcionales', () => {
    const wrapper = mount(ListaGastoPorCategoria, {
      props: {
        items: [
          { categoria_id: 'transporte', nombre: 'Transporte', total: 200 },
          { categoria_id: 'comida', nombre: 'Comida', total: 100 },
        ],
        moneda: 'PEN',
      },
    })

    const barras = wrapper.findAll('.barra-categoria')
    expect(barras[0].attributes('style')).toContain('width: 100%')
    expect(barras[1].attributes('style')).toContain('width: 50%')
  })

  it('cada categoría muestra un color (punto) resuelto por su nombre', () => {
    const wrapper = mount(ListaGastoPorCategoria, {
      props: {
        items: [{ categoria_id: 'comida', nombre: 'Alimentación', total: 50 }],
        moneda: 'PEN',
      },
    })

    const punto = wrapper.find('.punto-categoria')
    expect(punto.attributes('style')).toContain('var(--color-categoria-alimentacion)')
  })

  it('borde: sin items muestra el estado vacío, sin barras', () => {
    const wrapper = mount(ListaGastoPorCategoria, { props: { items: [], moneda: 'PEN' } })

    expect(wrapper.find('.mensaje-vacio-seccion').text()).toBe('Sin gastos este mes.')
    expect(wrapper.findAll('.item-categoria')).toHaveLength(0)
  })
})
