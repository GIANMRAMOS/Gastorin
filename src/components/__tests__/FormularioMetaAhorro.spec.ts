import { beforeEach, describe, expect, it, type Mock } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import FormularioMetaAhorro from '@/components/FormularioMetaAhorro.vue'
import { useAuthStore } from '@/stores/auth'
import { useGastosStore } from '@/stores/gastos'
import { supabase } from '@/lib/supabaseClient'
import { crearConstructorConsulta } from '@/lib/__mocks__/supabaseClient'
import type { MetaAhorro } from '@/types/metaAhorro'

/**
 * Suite de validación INDEPENDIENTE (QA, no la del dev-builder). No existía
 * ningún spec dedicado a `FormularioMetaAhorro.vue` pese a que tiene lógica
 * de validación no trivial (`validarFormulario`): monto <= 0 o no numérico,
 * descripción vacía. Confirma, en particular, la respuesta a la pregunta del
 * orquestador: un monto 0 o negativo se bloquea EN EL FORMULARIO y nunca
 * llega a Supabase.
 */
const fromMock = supabase.from as unknown as Mock

const metaExistente: MetaAhorro = {
  usuario_id: 'u1',
  descripcion: 'Viaje 2027',
  monto: 5000,
  actualizado_en: '2026-07-01T00:00:00Z',
}

describe('FormularioMetaAhorro', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const authStore = useAuthStore()
    authStore.establecerUsuario({ id: 'u1', email: 'a@a.com' } as never)
  })

  it('camino feliz: alta con descripción y monto válidos hace upsert y emite "guardado"', async () => {
    const builder = crearConstructorConsulta()
    fromMock.mockReturnValueOnce(builder)
    ;(builder.single as Mock).mockResolvedValueOnce({ data: metaExistente, error: null })

    const wrapper = mount(FormularioMetaAhorro, { props: { meta: null } })
    await wrapper.find('#descripcion-meta').setValue('Viaje 2027')
    await wrapper.find('#monto-meta').setValue('5000')
    await wrapper.find('form').trigger('submit.prevent')
    await new Promise((r) => setTimeout(r, 0))

    expect(builder.upsert).toHaveBeenCalledWith(
      { usuario_id: 'u1', descripcion: 'Viaje 2027', monto: 5000 },
      { onConflict: 'usuario_id' },
    )
    expect(wrapper.emitted('guardado')).toHaveLength(1)
  })

  it('precarga descripción/monto cuando recibe una meta existente (modo edición)', () => {
    const wrapper = mount(FormularioMetaAhorro, { props: { meta: metaExistente } })

    expect((wrapper.find('#descripcion-meta').element as HTMLInputElement).value).toBe('Viaje 2027')
    expect((wrapper.find('#monto-meta').element as HTMLInputElement).value).toBe('5000')
  })

  it('borde: monto 0 bloquea el envío EN EL FORMULARIO, sin llamar a Supabase', async () => {
    const wrapper = mount(FormularioMetaAhorro, { props: { meta: null } })
    await wrapper.find('#descripcion-meta').setValue('Viaje 2027')
    await wrapper.find('#monto-meta').setValue('0')
    await wrapper.find('form').trigger('submit.prevent')
    await new Promise((r) => setTimeout(r, 0))

    expect(fromMock).not.toHaveBeenCalled()
    expect(wrapper.find('[role="alert"]').text()).toBe('Ingresa un monto mayor a 0.')
    expect(wrapper.emitted('guardado')).toBeUndefined()
  })

  it('borde: monto negativo bloquea el envío EN EL FORMULARIO, sin llamar a Supabase', async () => {
    const wrapper = mount(FormularioMetaAhorro, { props: { meta: null } })
    await wrapper.find('#descripcion-meta').setValue('Viaje 2027')
    await wrapper.find('#monto-meta').setValue('-100')
    await wrapper.find('form').trigger('submit.prevent')
    await new Promise((r) => setTimeout(r, 0))

    expect(fromMock).not.toHaveBeenCalled()
    expect(wrapper.find('[role="alert"]').text()).toBe('Ingresa un monto mayor a 0.')
  })

  it('borde: monto no numérico bloquea el envío EN EL FORMULARIO', async () => {
    const wrapper = mount(FormularioMetaAhorro, { props: { meta: null } })
    await wrapper.find('#descripcion-meta').setValue('Viaje 2027')
    await wrapper.find('#monto-meta').setValue('abc')
    await wrapper.find('form').trigger('submit.prevent')
    await new Promise((r) => setTimeout(r, 0))

    expect(fromMock).not.toHaveBeenCalled()
    expect(wrapper.find('[role="alert"]').text()).toBe('Ingresa un monto mayor a 0.')
  })

  it('borde: descripción vacía bloquea el envío antes de validar el monto', async () => {
    const wrapper = mount(FormularioMetaAhorro, { props: { meta: null } })
    await wrapper.find('#monto-meta').setValue('100')
    await wrapper.find('form').trigger('submit.prevent')
    await new Promise((r) => setTimeout(r, 0))

    expect(fromMock).not.toHaveBeenCalled()
    expect(wrapper.find('[role="alert"]').text()).toBe('Ingresa una descripción para tu meta.')
  })

  it('borde: error de Supabase muestra el mensaje del store y no emite "guardado"', async () => {
    const builder = crearConstructorConsulta()
    fromMock.mockReturnValueOnce(builder)
    ;(builder.single as Mock).mockResolvedValueOnce({ data: null, error: { message: 'boom' } })

    const wrapper = mount(FormularioMetaAhorro, { props: { meta: null } })
    await wrapper.find('#descripcion-meta').setValue('Viaje 2027')
    await wrapper.find('#monto-meta').setValue('5000')
    await wrapper.find('form').trigger('submit.prevent')
    await new Promise((r) => setTimeout(r, 0))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[role="alert"]').text()).toBe('No se pudo guardar la meta de ahorro.')
    expect(wrapper.emitted('guardado')).toBeUndefined()
  })

  it('el botón "Guardar" se deshabilita mientras `store.cargando` es true', async () => {
    const store = useGastosStore()
    store.establecerCargando(true)

    const wrapper = mount(FormularioMetaAhorro, { props: { meta: null } })

    expect((wrapper.find('button[type="submit"]').element as HTMLButtonElement).disabled).toBe(true)
  })

  it('"Cancelar" emite "cerrar" sin llamar a Supabase', async () => {
    const wrapper = mount(FormularioMetaAhorro, { props: { meta: null } })

    await wrapper.find('.enlace-secundario').trigger('click')

    expect(wrapper.emitted('cerrar')).toHaveLength(1)
    expect(fromMock).not.toHaveBeenCalled()
  })
})
