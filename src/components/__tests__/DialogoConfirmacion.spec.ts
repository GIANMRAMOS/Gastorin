import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DialogoConfirmacion from '@/components/DialogoConfirmacion.vue'

describe('DialogoConfirmacion (HU-2.3)', () => {
  it('camino feliz: muestra el mensaje recibido por props', () => {
    const wrapper = mount(DialogoConfirmacion, {
      props: { mensaje: '¿Seguro que quieres eliminar este gasto?' },
    })

    expect(wrapper.text()).toContain('¿Seguro que quieres eliminar este gasto?')
  })

  it('camino feliz: clic en confirmar emite "confirmar"', async () => {
    const wrapper = mount(DialogoConfirmacion, { props: { mensaje: 'Confirma' } })

    await wrapper.find('button.boton-primario').trigger('click')

    expect(wrapper.emitted('confirmar')).toHaveLength(1)
    expect(wrapper.emitted('cancelar')).toBeUndefined()
  })

  it('borde: clic en cancelar emite "cancelar" y NO "confirmar" (no se ejecuta ninguna acción destructiva)', async () => {
    const wrapper = mount(DialogoConfirmacion, { props: { mensaje: 'Confirma' } })

    await wrapper.find('button.enlace-secundario').trigger('click')

    expect(wrapper.emitted('cancelar')).toHaveLength(1)
    expect(wrapper.emitted('confirmar')).toBeUndefined()
  })

  it('borde: clic en el fondo del modal también cancela (no confirma)', async () => {
    const wrapper = mount(DialogoConfirmacion, { props: { mensaje: 'Confirma' } })

    await wrapper.find('.modal-fondo').trigger('click')

    expect(wrapper.emitted('cancelar')).toHaveLength(1)
    expect(wrapper.emitted('confirmar')).toBeUndefined()
  })
})
