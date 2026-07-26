import { beforeEach, describe, expect, it, type Mock } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import FormularioAjusteSaldo from '@/components/FormularioAjusteSaldo.vue'
import { useAuthStore } from '@/stores/auth'
import { useGastosStore } from '@/stores/gastos'
import { supabase } from '@/lib/supabaseClient'
import { crearConstructorConsulta } from '@/lib/__mocks__/supabaseClient'
import type { AjusteSaldoCuenta } from '@/types/ajusteSaldo'

const fromMock = supabase.from as unknown as Mock

const ajusteCreado: AjusteSaldoCuenta = {
  id: 'a1',
  usuario_id: 'u1',
  banco_id: 'b1',
  moneda: 'PEN',
  saldo: 1000,
  fecha: '2026-07-25',
  creado_en: '2026-07-25T10:00:00Z',
}

function montarFormulario(moneda: 'PEN' | 'USD' = 'PEN') {
  return mount(FormularioAjusteSaldo, { props: { bancoId: 'b1', moneda, etiqueta: 'BCP' } })
}

describe('FormularioAjusteSaldo', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const authStore = useAuthStore()
    authStore.establecerUsuario({ id: 'u1', email: 'a@a.com' } as never)
  })

  it('camino feliz: saldo y fecha válidos hacen un INSERT (no upsert) y emiten "guardado"', async () => {
    const builder = crearConstructorConsulta()
    fromMock.mockReturnValueOnce(builder)
    ;(builder.single as Mock).mockResolvedValueOnce({ data: ajusteCreado, error: null })

    const wrapper = montarFormulario()
    await wrapper.find('#saldo-ajuste').setValue('1000')
    await wrapper.find('#fecha-ajuste').setValue('2026-07-25')
    await wrapper.find('form').trigger('submit.prevent')
    await new Promise((r) => setTimeout(r, 0))

    expect(builder.insert).toHaveBeenCalledWith({
      usuario_id: 'u1',
      banco_id: 'b1',
      moneda: 'PEN',
      saldo: 1000,
      fecha: '2026-07-25',
    })
    expect(wrapper.emitted('guardado')).toHaveLength(1)
  })

  it('el campo de fecha arranca en hoy por defecto', () => {
    const wrapper = montarFormulario()

    expect((wrapper.find('#fecha-ajuste').element as HTMLInputElement).value).not.toBe('')
  })

  it('borde: un saldo NEGATIVO es válido (ej. una cuenta en sobregiro) y sí llama a Supabase', async () => {
    const builder = crearConstructorConsulta()
    fromMock.mockReturnValueOnce(builder)
    ;(builder.single as Mock).mockResolvedValueOnce({ data: { ...ajusteCreado, saldo: -200 }, error: null })

    const wrapper = montarFormulario()
    await wrapper.find('#saldo-ajuste').setValue('-200')
    await wrapper.find('form').trigger('submit.prevent')
    await new Promise((r) => setTimeout(r, 0))

    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({ saldo: -200 }))
    expect(wrapper.emitted('guardado')).toHaveLength(1)
  })

  it('borde: saldo vacío o no numérico bloquea el envío EN EL FORMULARIO, sin llamar a Supabase', async () => {
    const wrapper = montarFormulario()
    await wrapper.find('#saldo-ajuste').setValue('abc')
    await wrapper.find('form').trigger('submit.prevent')
    await new Promise((r) => setTimeout(r, 0))

    expect(fromMock).not.toHaveBeenCalled()
    expect(wrapper.find('[role="alert"]').text()).toBe('Ingresa un saldo válido.')
    expect(wrapper.emitted('guardado')).toBeUndefined()
  })

  it('borde: sin fecha bloquea el envío EN EL FORMULARIO', async () => {
    const wrapper = montarFormulario()
    await wrapper.find('#saldo-ajuste').setValue('1000')
    await wrapper.find('#fecha-ajuste').setValue('')
    await wrapper.find('form').trigger('submit.prevent')
    await new Promise((r) => setTimeout(r, 0))

    expect(fromMock).not.toHaveBeenCalled()
    expect(wrapper.find('[role="alert"]').text()).toBe('Selecciona una fecha.')
  })

  it('borde: error de Supabase muestra el mensaje del store y no emite "guardado"', async () => {
    const builder = crearConstructorConsulta()
    fromMock.mockReturnValueOnce(builder)
    ;(builder.single as Mock).mockResolvedValueOnce({ data: null, error: { message: 'boom' } })

    const wrapper = montarFormulario()
    await wrapper.find('#saldo-ajuste').setValue('1000')
    await wrapper.find('form').trigger('submit.prevent')
    await new Promise((r) => setTimeout(r, 0))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[role="alert"]').text()).toBe('No se pudo guardar el ajuste de saldo.')
    expect(wrapper.emitted('guardado')).toBeUndefined()
  })

  it('el botón "Guardar" se deshabilita mientras `store.cargando` es true', () => {
    const store = useGastosStore()
    store.establecerCargando(true)

    const wrapper = montarFormulario()

    expect((wrapper.find('button[type="submit"]').element as HTMLButtonElement).disabled).toBe(true)
  })

  it('"Cancelar" emite "cerrar" sin llamar a Supabase', async () => {
    const wrapper = montarFormulario()

    await wrapper.find('.enlace-secundario').trigger('click')

    expect(wrapper.emitted('cerrar')).toHaveLength(1)
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('muestra la etiqueta de la cuenta en la nota, y el símbolo de la moneda correspondiente en el label', () => {
    const wrapper = montarFormulario('USD')

    expect(wrapper.text()).toContain('BCP')
    expect(wrapper.find('label[for="saldo-ajuste"]').text()).toContain('$')
  })
})
