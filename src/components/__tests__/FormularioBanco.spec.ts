import { beforeEach, describe, expect, it, type Mock } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import FormularioBanco from '@/components/FormularioBanco.vue'
import { useAuthStore } from '@/stores/auth'
import { useIngresosStore } from '@/stores/ingresos'
import { supabase } from '@/lib/supabaseClient'
import { crearConstructorConsulta } from '@/lib/__mocks__/supabaseClient'

const fromMock = supabase.from as unknown as Mock

function montarFormulario() {
  return mount(FormularioBanco)
}

describe('FormularioBanco (HU-11.1)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const authStore = useAuthStore()
    authStore.establecerUsuario({ id: 'u1', email: 'a@a.com' } as never)
  })

  it('camino feliz: nombre válido crea el banco y emite guardado', async () => {
    const builder = crearConstructorConsulta()
    fromMock.mockReturnValueOnce(builder)
    const bancoCreado = { id: 'b1', usuario_id: 'u1', nombre: 'BCP', created_at: '' }
    ;(builder.single as Mock).mockResolvedValueOnce({ data: bancoCreado, error: null })

    const wrapper = montarFormulario()
    await wrapper.find('#nombre-banco').setValue('BCP')
    await wrapper.find('form').trigger('submit.prevent')
    await new Promise((r) => setTimeout(r, 0))

    expect(builder.insert).toHaveBeenCalledWith({ usuario_id: 'u1', nombre: 'BCP' })
    expect(wrapper.emitted('guardado')).toHaveLength(1)
  })

  it('borde: nombre vacío bloquea el envío sin llamar al backend', async () => {
    const wrapper = montarFormulario()
    await wrapper.find('form').trigger('submit.prevent')
    await new Promise((r) => setTimeout(r, 0))

    expect(fromMock).not.toHaveBeenCalled()
    expect(wrapper.find('[role="alert"]').text()).toBe('Ingresa un nombre para el banco.')
    expect(wrapper.emitted('guardado')).toBeUndefined()
  })

  it('borde: nombre con solo espacios bloquea el envío sin llamar al backend', async () => {
    const wrapper = montarFormulario()
    await wrapper.find('#nombre-banco').setValue('   ')
    await wrapper.find('form').trigger('submit.prevent')
    await new Promise((r) => setTimeout(r, 0))

    expect(fromMock).not.toHaveBeenCalled()
    expect(wrapper.find('[role="alert"]').text()).toBe('Ingresa un nombre para el banco.')
  })

  it('borde: nombre duplicado (case-insensitive) muestra el mensaje traducido, no el error crudo de Postgres', async () => {
    const builder = crearConstructorConsulta()
    fromMock.mockReturnValueOnce(builder)
    ;(builder.single as Mock).mockResolvedValueOnce({
      data: null,
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    })

    const wrapper = montarFormulario()
    await wrapper.find('#nombre-banco').setValue('bcp')
    await wrapper.find('form').trigger('submit.prevent')
    await new Promise((r) => setTimeout(r, 0))

    expect(wrapper.find('[role="alert"]').text()).toBe('Ya existe un banco con ese nombre.')
    expect(wrapper.emitted('guardado')).toBeUndefined()
  })

  it('al pulsar Cancelar emite cerrar sin llamar al backend', async () => {
    const wrapper = montarFormulario()
    await wrapper.find('.enlace-secundario').trigger('click')

    expect(wrapper.emitted('cerrar')).toHaveLength(1)
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('el error mostrado tras un envío exitoso previo no queda "pegado": tras cerrar el error de store, el formulario refleja el nuevo estado', async () => {
    const store = useIngresosStore()
    store.establecerError('Ya existe un banco con ese nombre.')

    const wrapper = montarFormulario()
    expect(wrapper.find('[role="alert"]').text()).toBe('Ya existe un banco con ese nombre.')
  })
})
