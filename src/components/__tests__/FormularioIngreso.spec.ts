import { beforeEach, describe, expect, it, type Mock } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import FormularioIngreso from '@/components/FormularioIngreso.vue'
import { useIngresosStore } from '@/stores/ingresos'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabaseClient'
import { crearConstructorConsulta } from '@/lib/__mocks__/supabaseClient'
import type { Banco } from '@/types/ingreso'

const fromMock = supabase.from as unknown as Mock

const bancoFalso: Banco = {
  id: 'b1',
  usuario_id: 'u1',
  nombre: 'BCP',
  created_at: '',
}

function montarFormulario() {
  return mount(FormularioIngreso)
}

/** Llena todos los campos válidos, salvo los que se indiquen en `omitir`. */
async function llenarCamposValidos(
  wrapper: ReturnType<typeof montarFormulario>,
  overrides: Partial<{ importe: string; bancoId: string; moneda: string; fecha: string; concepto: string }> = {},
) {
  await wrapper.find('#importe').setValue(overrides.importe ?? '100')
  await wrapper.find('#banco').setValue(overrides.bancoId ?? 'b1')
  await wrapper.find('#moneda-ingreso').setValue(overrides.moneda ?? 'PEN')
  await wrapper.find('#fecha-ingreso').setValue(overrides.fecha ?? '2026-07-10')
  await wrapper.find('#concepto').setValue(overrides.concepto ?? 'Sueldo')
}

describe('FormularioIngreso (HU-11.2)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const authStore = useAuthStore()
    authStore.establecerUsuario({ id: 'u1', email: 'a@a.com' } as never)
    useIngresosStore().establecerBancos([bancoFalso])
  })

  it('camino feliz: fecha + banco + moneda + importe>0 + concepto crea el ingreso y emite guardado', async () => {
    const builder = crearConstructorConsulta()
    fromMock.mockReturnValueOnce(builder)
    const ingresoCreado = {
      id: 'i1',
      usuario_id: 'u1',
      banco_id: 'b1',
      fecha: '2026-07-10',
      moneda: 'PEN',
      importe: 100,
      concepto: 'Sueldo',
      created_at: '',
    }
    ;(builder.single as Mock).mockResolvedValueOnce({ data: ingresoCreado, error: null })

    const wrapper = montarFormulario()
    await llenarCamposValidos(wrapper)
    await wrapper.find('form').trigger('submit.prevent')
    await new Promise((r) => setTimeout(r, 0))

    expect(builder.insert).toHaveBeenCalledWith({
      banco_id: 'b1',
      fecha: '2026-07-10',
      moneda: 'PEN',
      importe: 100,
      concepto: 'Sueldo',
      usuario_id: 'u1',
    })
    expect(wrapper.emitted('guardado')).toHaveLength(1)
  })

  it('borde Gherkin — importe = 0: bloquea el envío sin llamar a Supabase', async () => {
    const wrapper = montarFormulario()
    await llenarCamposValidos(wrapper, { importe: '0' })
    await wrapper.find('form').trigger('submit.prevent')
    await new Promise((r) => setTimeout(r, 0))

    expect(fromMock).not.toHaveBeenCalled()
    expect(wrapper.find('[role="alert"]').text()).toBe('Ingresa un importe válido mayor a 0.')
    expect(wrapper.emitted('guardado')).toBeUndefined()
  })

  it('borde Gherkin — importe negativo: bloquea el envío sin llamar a Supabase', async () => {
    const wrapper = montarFormulario()
    await llenarCamposValidos(wrapper, { importe: '-50' })
    await wrapper.find('form').trigger('submit.prevent')
    await new Promise((r) => setTimeout(r, 0))

    expect(fromMock).not.toHaveBeenCalled()
    expect(wrapper.find('[role="alert"]').text()).toBe('Ingresa un importe válido mayor a 0.')
  })

  it('borde: importe no numérico bloquea el envío', async () => {
    const wrapper = montarFormulario()
    await llenarCamposValidos(wrapper, { importe: 'abc' })
    await wrapper.find('form').trigger('submit.prevent')
    await new Promise((r) => setTimeout(r, 0))

    expect(fromMock).not.toHaveBeenCalled()
    expect(wrapper.find('[role="alert"]').text()).toBe('Ingresa un importe válido mayor a 0.')
  })

  it('borde Gherkin — sin banco (payload sin banco_id): bloquea con "Selecciona un banco." sin llamar a Supabase', async () => {
    const wrapper = montarFormulario()
    await wrapper.find('#importe').setValue('100')
    await wrapper.find('#moneda-ingreso').setValue('PEN')
    await wrapper.find('#fecha-ingreso').setValue('2026-07-10')
    await wrapper.find('#concepto').setValue('Sueldo')
    // No se toca #banco: queda en ''.
    await wrapper.find('form').trigger('submit.prevent')
    await new Promise((r) => setTimeout(r, 0))

    expect(fromMock).not.toHaveBeenCalled()
    expect(wrapper.find('[role="alert"]').text()).toBe('Selecciona un banco.')
  })

  it('borde Gherkin — sin concepto (payload sin concepto): bloquea con "Ingresa un concepto." sin llamar a Supabase', async () => {
    const wrapper = montarFormulario()
    await llenarCamposValidos(wrapper, { concepto: '' })
    await wrapper.find('form').trigger('submit.prevent')
    await new Promise((r) => setTimeout(r, 0))

    expect(fromMock).not.toHaveBeenCalled()
    expect(wrapper.find('[role="alert"]').text()).toBe('Ingresa un concepto.')
  })

  it('borde: concepto con solo espacios bloquea el envío', async () => {
    const wrapper = montarFormulario()
    await llenarCamposValidos(wrapper, { concepto: '   ' })
    await wrapper.find('form').trigger('submit.prevent')
    await new Promise((r) => setTimeout(r, 0))

    expect(fromMock).not.toHaveBeenCalled()
    expect(wrapper.find('[role="alert"]').text()).toBe('Ingresa un concepto.')
  })

  it('borde: sin fecha bloquea el envío', async () => {
    const wrapper = montarFormulario()
    await wrapper.find('#importe').setValue('100')
    await wrapper.find('#banco').setValue('b1')
    await wrapper.find('#moneda-ingreso').setValue('PEN')
    await wrapper.find('#concepto').setValue('Sueldo')
    await wrapper.find('form').trigger('submit.prevent')
    await new Promise((r) => setTimeout(r, 0))

    expect(fromMock).not.toHaveBeenCalled()
    expect(wrapper.find('[role="alert"]').text()).toBe('Selecciona una fecha.')
  })

  it('borde: sin bancos cargados, el formulario se bloquea entero (patrón "sin categorías") y no llama a Supabase', async () => {
    useIngresosStore().establecerBancos([])

    const wrapper = montarFormulario()
    await wrapper.find('form').trigger('submit.prevent')
    await new Promise((r) => setTimeout(r, 0))

    expect(fromMock).not.toHaveBeenCalled()
    expect(wrapper.find('[role="alert"]').text()).toBe('No hay bancos; créalos primero.')
    expect((wrapper.find('#importe').element as HTMLInputElement).disabled).toBe(true)
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined()
  })
})
