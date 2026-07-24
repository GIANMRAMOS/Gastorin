import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import FormularioIngreso from '@/components/FormularioIngreso.vue'
import { useIngresosStore } from '@/stores/ingresos'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabaseClient'
import { crearConstructorConsulta } from '@/lib/__mocks__/supabaseClient'
import type { Banco, Ingreso } from '@/types/ingreso'

const fromMock = supabase.from as unknown as Mock

const bancoFalso: Banco = {
  id: 'b1',
  usuario_id: 'u1',
  nombre: 'BCP',
  created_at: '',
}

const ingresoBase: Ingreso = {
  id: 'i1',
  usuario_id: 'u1',
  banco_id: 'b1',
  fecha: '2026-07-10',
  moneda: 'PEN',
  importe: 100,
  concepto: 'Sueldo',
  created_at: '',
}

function montarFormulario(ingreso: Ingreso | null = null) {
  return mount(FormularioIngreso, { props: { ingreso } })
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
    expect(wrapper.find('[role="alert"]').text()).toBe('El importe no puede ser cero.')
    expect(wrapper.emitted('guardado')).toBeUndefined()
  })

  it('importe negativo AHORA se acepta: llama a Supabase (insert) y emite guardado', async () => {
    const builder = crearConstructorConsulta()
    fromMock.mockReturnValueOnce(builder)
    const ingresoCreado = { ...ingresoBase, importe: -50 }
    ;(builder.single as Mock).mockResolvedValueOnce({ data: ingresoCreado, error: null })

    const wrapper = montarFormulario()
    await llenarCamposValidos(wrapper, { importe: '-50' })
    await wrapper.find('form').trigger('submit.prevent')
    await new Promise((r) => setTimeout(r, 0))

    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ importe: -50 }),
    )
    expect(wrapper.emitted('guardado')).toHaveLength(1)
  })

  it('borde: importe no numérico bloquea el envío', async () => {
    const wrapper = montarFormulario()
    await llenarCamposValidos(wrapper, { importe: 'abc' })
    await wrapper.find('form').trigger('submit.prevent')
    await new Promise((r) => setTimeout(r, 0))

    expect(fromMock).not.toHaveBeenCalled()
    expect(wrapper.find('[role="alert"]').text()).toBe('El importe no puede ser cero.')
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
    // Con el default de fecha=hoy, hay que vaciar el campo explícitamente
    // para seguir cubriendo la validación "sin fecha".
    await wrapper.find('#fecha-ingreso').setValue('')
    await wrapper.find('form').trigger('submit.prevent')
    await new Promise((r) => setTimeout(r, 0))

    expect(fromMock).not.toHaveBeenCalled()
    expect(wrapper.find('[role="alert"]').text()).toBe('Selecciona una fecha.')
  })

  describe('defaults de alta (chunk A): moneda PEN y fecha de hoy', () => {
    beforeEach(() => {
      // Solo se falsea `Date` (no `setTimeout`), para no interferir con el
      // `await new Promise((r) => setTimeout(r, 0))` que usan estos tests.
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date(2026, 6, 22)) // 22 jul 2026 (fecha local, no UTC)
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('camino feliz: al montar, #moneda-ingreso arranca en PEN y #fecha-ingreso en la fecha de hoy (local); ambos editables', async () => {
      const wrapper = montarFormulario()

      expect((wrapper.find('#moneda-ingreso').element as HTMLSelectElement).value).toBe('PEN')
      expect((wrapper.find('#fecha-ingreso').element as HTMLInputElement).value).toBe('2026-07-22')
      expect(wrapper.find('#moneda-ingreso').attributes('disabled')).toBeUndefined()
      expect(wrapper.find('#fecha-ingreso').attributes('disabled')).toBeUndefined()
    })

    it('camino feliz: sin tocar fecha ni moneda, crea el ingreso con moneda PEN y la fecha de hoy', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      const ingresoCreado = {
        id: 'i1',
        usuario_id: 'u1',
        banco_id: 'b1',
        fecha: '2026-07-22',
        moneda: 'PEN',
        importe: 100,
        concepto: 'Sueldo',
        created_at: '',
      }
      ;(builder.single as Mock).mockResolvedValueOnce({ data: ingresoCreado, error: null })

      const wrapper = montarFormulario()
      await wrapper.find('#importe').setValue('100')
      await wrapper.find('#banco').setValue('b1')
      await wrapper.find('#concepto').setValue('Sueldo')
      await wrapper.find('form').trigger('submit.prevent')
      await new Promise((r) => setTimeout(r, 0))

      expect(builder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ moneda: 'PEN', fecha: '2026-07-22' }),
      )
      expect(wrapper.emitted('guardado')).toHaveLength(1)
    })
  })

  describe('defaults de fecha (hoyISO): nunca se corre de día por usar hora LOCAL en vez de toISOString/UTC', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it('borde crítico: a las 23:30 hora local (Lima, UTC-5), #fecha-ingreso sigue siendo el día local, no el siguiente en UTC', async () => {
      // 22 jul 2026, 23:30 hora local: en UTC ya son las 04:30 del 23 jul.
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date(2026, 6, 22, 23, 30))

      const wrapper = montarFormulario()

      expect((wrapper.find('#fecha-ingreso').element as HTMLInputElement).value).toBe('2026-07-22')
    })

    it('borde crítico: 31-dic 23:50 hora local no se corre al año/mes siguiente en UTC', async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date(2026, 11, 31, 23, 50))

      const wrapper = montarFormulario()

      expect((wrapper.find('#fecha-ingreso').element as HTMLInputElement).value).toBe('2026-12-31')
    })

    it('borde: justo a medianoche hora local (00:00:00) también da la fecha local correcta', async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date(2026, 6, 22, 0, 0, 0))

      const wrapper = montarFormulario()

      expect((wrapper.find('#fecha-ingreso').element as HTMLInputElement).value).toBe('2026-07-22')
    })
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

  describe('HU-11.3 — editar ingreso', () => {
    it('camino feliz: los 5 campos aparecen prellenados con los valores del ingreso; al cambiar uno y enviar actualiza (no inserta)', async () => {
      const wrapper = montarFormulario(ingresoBase)

      // Prellenado
      expect((wrapper.find('#importe').element as HTMLInputElement).value).toBe('100')
      expect((wrapper.find('#banco').element as HTMLSelectElement).value).toBe('b1')
      expect((wrapper.find('#moneda-ingreso').element as HTMLSelectElement).value).toBe('PEN')
      expect((wrapper.find('#fecha-ingreso').element as HTMLInputElement).value).toBe('2026-07-10')
      expect((wrapper.find('#concepto').element as HTMLInputElement).value).toBe('Sueldo')

      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      const ingresoActualizado = { ...ingresoBase, importe: 250, concepto: 'Bono' }
      ;(builder.single as Mock).mockResolvedValueOnce({ data: ingresoActualizado, error: null })

      await wrapper.find('#importe').setValue('250')
      await wrapper.find('#concepto').setValue('Bono')
      await wrapper.find('form').trigger('submit.prevent')
      await new Promise((r) => setTimeout(r, 0))

      expect(builder.update).toHaveBeenCalledWith({
        banco_id: 'b1',
        fecha: '2026-07-10',
        moneda: 'PEN',
        importe: 250,
        concepto: 'Bono',
      })
      expect(builder.eq).toHaveBeenCalledWith('id', 'i1')
      expect(builder.insert).not.toHaveBeenCalled()
      expect(wrapper.emitted('guardado')).toHaveLength(1)
    })

    it('borde: en modo edición, las validaciones de bloqueo siguen aplicando (importe = 0 bloquea sin llamar a Supabase)', async () => {
      const wrapper = montarFormulario(ingresoBase)
      await wrapper.find('#importe').setValue('0')
      await wrapper.find('form').trigger('submit.prevent')
      await new Promise((r) => setTimeout(r, 0))

      expect(fromMock).not.toHaveBeenCalled()
      expect(wrapper.find('[role="alert"]').text()).toBe('El importe no puede ser cero.')
      expect(wrapper.emitted('guardado')).toBeUndefined()
    })

    it('borde: en modo edición, importe negativo ahora se acepta (llama update, no bloquea)', async () => {
      const wrapper = montarFormulario(ingresoBase)

      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      const ingresoActualizado = { ...ingresoBase, importe: -50 }
      ;(builder.single as Mock).mockResolvedValueOnce({ data: ingresoActualizado, error: null })

      await wrapper.find('#importe').setValue('-50')
      await wrapper.find('form').trigger('submit.prevent')
      await new Promise((r) => setTimeout(r, 0))

      expect(builder.update).toHaveBeenCalledWith(
        expect.objectContaining({ importe: -50 }),
      )
      expect(wrapper.emitted('guardado')).toHaveLength(1)
    })

    it('regresión: sin prop ingreso, sigue en modo alta (llama insert, no update)', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      const ingresoCreado = { ...ingresoBase, id: 'i-nuevo' }
      ;(builder.single as Mock).mockResolvedValueOnce({ data: ingresoCreado, error: null })

      const wrapper = montarFormulario(null)
      await llenarCamposValidos(wrapper)
      await wrapper.find('form').trigger('submit.prevent')
      await new Promise((r) => setTimeout(r, 0))

      expect(builder.insert).toHaveBeenCalled()
      expect(builder.update).not.toHaveBeenCalled()
      expect(wrapper.emitted('guardado')).toHaveLength(1)
    })
  })
})
