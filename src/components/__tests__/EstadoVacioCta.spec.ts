import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import EstadoVacioCta from '@/components/EstadoVacioCta.vue'

describe('EstadoVacioCta', () => {
  it('renderiza título, mensaje y la etiqueta del botón', () => {
    const wrapper = mount(EstadoVacioCta, {
      props: {
        titulo: 'Configura tu primer presupuesto',
        mensaje: 'Todavía no tienes presupuestos para este mes.',
        etiquetaBoton: 'Configura tu primer presupuesto',
      },
    })

    expect(wrapper.find('.titulo-estado-vacio').text()).toBe('Configura tu primer presupuesto')
    expect(wrapper.find('.mensaje-estado-vacio').text()).toContain('Todavía no tienes presupuestos')
    expect(wrapper.find('button').text()).toBe('Configura tu primer presupuesto')
  })

  it('emite "accion" al hacer click en el botón', async () => {
    const wrapper = mount(EstadoVacioCta, {
      props: { titulo: 't', mensaje: 'm', etiquetaBoton: 'Ir' },
    })

    await wrapper.find('button').trigger('click')

    expect(wrapper.emitted('accion')).toHaveLength(1)
  })
})
