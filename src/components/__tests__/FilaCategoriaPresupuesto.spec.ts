import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import FilaCategoriaPresupuesto from '@/components/FilaCategoriaPresupuesto.vue'
import type { DesgloseSemanal } from '@/composables/usePresupuestos'

const desgloseBase: DesgloseSemanal[] = [
  { semana: 1, total: 100 },
  { semana: 2, total: 0 },
  { semana: 3, total: 50 },
  { semana: 4, total: 0 },
]

function montarFila(expandida: boolean, extra: Partial<Record<string, unknown>> = {}) {
  return mount(FilaCategoriaPresupuesto, {
    props: {
      categoriaId: 'c1',
      nombreCategoria: 'Comida',
      gastado: 150,
      limite: 500,
      moneda: 'PEN',
      desglose: desgloseBase,
      movimientos: 3,
      restante: 350,
      expandida,
      ...extra,
    },
  })
}

describe('FilaCategoriaPresupuesto', () => {
  it('colapsada: aria-expanded=false y no muestra el panel de desglose', () => {
    const wrapper = montarFila(false)

    const cabecera = wrapper.find('[role="button"]')
    expect(cabecera.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('[role="region"]').exists()).toBe(false)
  })

  it('expandida: aria-expanded=true, muestra las 4 semanas (incluida la de total 0) y la nota de movimientos/restante', () => {
    const wrapper = montarFila(true)

    const cabecera = wrapper.find('[role="button"]')
    expect(cabecera.attributes('aria-expanded')).toBe('true')

    const celdas = wrapper.findAll('.celda-semana-desglose')
    expect(celdas).toHaveLength(4)
    // `Intl.NumberFormat` usa un espacio de no separación entre "S/" y el monto.
    expect(celdas[1].text()).toContain('0.00')

    expect(wrapper.find('.nota-desglose-categoria').text()).toContain('3 movimientos')
    expect(wrapper.find('.nota-desglose-categoria').text()).toContain('te quedan')
  })

  it('click en la cabecera emite "alternar" con el categoriaId', async () => {
    const wrapper = montarFila(false)

    await wrapper.find('[role="button"]').trigger('click')

    expect(wrapper.emitted('alternar')).toEqual([['c1']])
  })

  it('Enter en la cabecera (teclado) emite "alternar"', async () => {
    const wrapper = montarFila(false)

    await wrapper.find('[role="button"]').trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('alternar')).toEqual([['c1']])
  })

  it('Espacio en la cabecera (teclado) emite "alternar"', async () => {
    const wrapper = montarFila(false)

    await wrapper.find('[role="button"]').trigger('keydown', { key: ' ' })

    expect(wrapper.emitted('alternar')).toEqual([['c1']])
  })

  it('click en "Editar" emite "editar" sin alternar la expansión (stopPropagation)', async () => {
    const wrapper = montarFila(false)

    await wrapper.find('.boton-editar-fila-categoria').trigger('click')

    expect(wrapper.emitted('editar')).toEqual([['c1']])
    expect(wrapper.emitted('alternar')).toBeUndefined()
  })

  it('excedido (restante negativo): la nota muestra "excedido en" en vez de "te quedan"', () => {
    const wrapper = montarFila(true, { gastado: 600, restante: -100 })

    const nota = wrapper.find('.nota-desglose-categoria')
    expect(nota.text()).toContain('excedido en')
    expect(nota.classes()).toContain('nota-excedido-desglose')
  })

  /**
   * REGRESIÓN (QA independiente, bug encontrado y corregido): el `<button>`
   * "Editar" NO está anidado dentro de otro `<button>` real (`role="button"`
   * es un `<div>`, así que la anidación es válida a nivel de HTML), pero el
   * manejador `@keydown` del `role="button"` padre está en el `<div>`
   * cabecera, y `keydown` SÍ hace bubbling desde el botón "Editar" hasta ese
   * `<div>`. Antes del fix, solo el `click` tenía `.stop`; el `keydown` no,
   * así que presionar Enter/Espacio con el foco en "Editar" disparaba TAMBIÉN
   * `alternar` del padre (colapsaba/expandía la fila sin que el usuario lo
   * pidiera). Corregido con `@keydown.stop` en el botón "Editar".
   */
  it('regresión: Enter en el botón "Editar" (foco por teclado) NO dispara "alternar" (el keydown ya no hace bubbling)', async () => {
    const wrapper = montarFila(false)

    await wrapper.find('.boton-editar-fila-categoria').trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('alternar')).toBeUndefined()
  })

  it('regresión: Espacio en el botón "Editar" (foco por teclado) NO dispara "alternar"', async () => {
    const wrapper = montarFila(false)

    await wrapper.find('.boton-editar-fila-categoria').trigger('keydown', { key: ' ' })

    expect(wrapper.emitted('alternar')).toBeUndefined()
  })
})
