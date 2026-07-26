import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AccionesFila from '@/components/AccionesFila.vue'

/**
 * Pruebas unitarias en aislamiento del control "⋮" (Editar/Eliminar) de una
 * fila, extraído de `TablaMovimientos` para reutilizarse tanto en el carril
 * lateral de escritorio como dentro de cada `<tr>` en mobile. El componente
 * es puramente controlado: `abierto` decide si el menú se muestra, y los
 * emits son la única forma de comunicar intención al padre.
 */
describe('AccionesFila', () => {
  it('con `abierto: false` el menú no está en el DOM', () => {
    const wrapper = mount(AccionesFila, { props: { filaId: 'm1', abierto: false } })

    expect(wrapper.find('.menu-acciones-fila').exists()).toBe(false)
  })

  it('con `abierto: true` el menú sí está en el DOM', () => {
    const wrapper = mount(AccionesFila, { props: { filaId: 'm1', abierto: true } })

    expect(wrapper.find('.menu-acciones-fila').exists()).toBe(true)
  })

  it('clic en el botón "⋮" emite alternar con el id de la fila', async () => {
    const wrapper = mount(AccionesFila, { props: { filaId: 'm1', abierto: false } })

    await wrapper.find('.boton-menu-acciones').trigger('click')

    expect(wrapper.emitted('alternar')).toEqual([['m1']])
  })

  it('clic en "Editar" emite editar con el id de la fila', async () => {
    const wrapper = mount(AccionesFila, { props: { filaId: 'm2', abierto: true } })

    await wrapper.find('.boton-editar').trigger('click')

    expect(wrapper.emitted('editar')).toEqual([['m2']])
  })

  it('clic en "Eliminar" emite eliminar con el id de la fila', async () => {
    const wrapper = mount(AccionesFila, { props: { filaId: 'm2', abierto: true } })

    await wrapper.find('.boton-eliminar').trigger('click')

    expect(wrapper.emitted('eliminar')).toEqual([['m2']])
  })

  it('el contenedor raíz lleva `.celda-acciones` y `data-fila-id` para el cierre por clic afuera del padre', () => {
    const wrapper = mount(AccionesFila, { props: { filaId: 'm3', abierto: false } })

    const raiz = wrapper.find('.celda-acciones')
    expect(raiz.exists()).toBe(true)
    expect(raiz.attributes('data-fila-id')).toBe('m3')
  })

  it('sin `etiquetaFila` el aria-label es genérico "Más acciones"', () => {
    const wrapper = mount(AccionesFila, { props: { filaId: 'm1', abierto: false } })

    expect(wrapper.find('.boton-menu-acciones').attributes('aria-label')).toBe('Más acciones')
  })

  it('con `etiquetaFila` el aria-label incluye el contexto de la fila', () => {
    const wrapper = mount(AccionesFila, {
      props: { filaId: 'm1', abierto: false, etiquetaFila: 'Almuerzo' },
    })

    expect(wrapper.find('.boton-menu-acciones').attributes('aria-label')).toBe(
      'Más acciones para Almuerzo',
    )
  })
})
