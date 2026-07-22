import { beforeEach, describe, expect, it, type Mock } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import FormularioGasto from '@/components/FormularioGasto.vue'
import { useGastosStore } from '@/stores/gastos'
import { useIngresosStore } from '@/stores/ingresos'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabaseClient'
import { crearConstructorConsulta } from '@/lib/__mocks__/supabaseClient'
import type { Categoria, Gasto } from '@/types/gasto'
import type { Banco } from '@/types/ingreso'

const fromMock = supabase.from as unknown as Mock

const categoriaFalsa: Categoria = {
  id: 'c1',
  usuario_id: 'u1',
  nombre: 'Comida',
  predefinida: true,
  activa: true,
  creado_en: '',
  abreviatura: 'C',
}

const bancoFalso: Banco = {
  id: 'b1',
  usuario_id: 'u1',
  nombre: 'BCP',
  created_at: '',
}

const gastoManual: Gasto = {
  id: 'g1',
  usuario_id: 'u1',
  categoria_id: 'c1',
  banco_id: 'b1',
  monto: 20,
  moneda: 'PEN',
  fecha: '2026-07-01',
  descripcion: 'algo',
  origen: 'manual',
  estado: 'confirmado',
  gmail_message_id: null,
  gmail_fragmento: null,
  creado_en: '',
  actualizado_en: '',
}

const gastoCorreo: Gasto = {
  ...gastoManual,
  id: 'g2',
  origen: 'correo',
  monto: 35.9,
  moneda: 'USD',
  gmail_message_id: 'msg1',
  gmail_fragmento: 'fragmento',
}

function montarFormulario(gasto: Gasto | null = null) {
  return mount(FormularioGasto, { props: { gasto } })
}

describe('FormularioGasto', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const authStore = useAuthStore()
    authStore.establecerUsuario({ id: 'u1', email: 'a@a.com' } as never)
  })

  describe('extracción de ToggleMoneda (HU-8.5, chunk A) — no rompe el <select> oculto', () => {
    it('el <select id="moneda"> sigue siendo controlable vía .setValue() tras extraer ToggleMoneda', async () => {
      const store = useGastosStore()
      store.establecerCategorias([categoriaFalsa])
      useIngresosStore().establecerBancos([bancoFalso])

      const wrapper = montarFormulario(null)
      const select = wrapper.find('#moneda')

      expect((select.element as HTMLSelectElement).value).toBe('')

      await select.setValue('USD')
      expect((select.element as HTMLSelectElement).value).toBe('USD')

      await select.setValue('PEN')
      expect((select.element as HTMLSelectElement).value).toBe('PEN')
    })
  })

  describe('HU-2.1 — alta de gasto manual', () => {
    it('camino feliz: monto válido + moneda + categoría + banco + fecha guarda con origen manual y estado confirmado', async () => {
      const store = useGastosStore()
      store.establecerCategorias([categoriaFalsa])
      useIngresosStore().establecerBancos([bancoFalso])

      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      const gastoCreado: Gasto = { ...gastoManual, id: 'g-nuevo' }
      ;(builder.single as Mock).mockResolvedValueOnce({ data: gastoCreado, error: null })

      const wrapper = montarFormulario(null)
      await wrapper.find('#monto').setValue('45.50')
      await wrapper.find('#moneda').setValue('PEN')
      await wrapper.find('#categoria').setValue('c1')
      await wrapper.find('#banco').setValue('b1')
      await wrapper.find('#fecha').setValue('2026-07-20')
      await wrapper.find('form').trigger('submit.prevent')
      await new Promise((r) => setTimeout(r, 0))

      expect(builder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          monto: 45.5,
          moneda: 'PEN',
          categoria_id: 'c1',
          banco_id: 'b1',
          fecha: '2026-07-20',
          origen: 'manual',
          estado: 'confirmado',
        }),
      )
      expect(wrapper.emitted('guardado')).toHaveLength(1)
    })

    it('borde: monto = 0 bloquea el envío, no llama a Supabase', async () => {
      const store = useGastosStore()
      store.establecerCategorias([categoriaFalsa])
      useIngresosStore().establecerBancos([bancoFalso])

      const wrapper = montarFormulario(null)
      await wrapper.find('#monto').setValue('0')
      await wrapper.find('#moneda').setValue('PEN')
      await wrapper.find('#categoria').setValue('c1')
      await wrapper.find('#banco').setValue('b1')
      await wrapper.find('#fecha').setValue('2026-07-20')
      await wrapper.find('form').trigger('submit.prevent')
      await new Promise((r) => setTimeout(r, 0))

      expect(fromMock).not.toHaveBeenCalled()
      expect(wrapper.find('[role="alert"]').text()).toBe('Ingresa un monto válido mayor a 0.')
      expect(wrapper.emitted('guardado')).toBeUndefined()
    })

    it('borde: monto negativo bloquea el envío', async () => {
      const store = useGastosStore()
      store.establecerCategorias([categoriaFalsa])
      useIngresosStore().establecerBancos([bancoFalso])

      const wrapper = montarFormulario(null)
      await wrapper.find('#monto').setValue('-5')
      await wrapper.find('#moneda').setValue('PEN')
      await wrapper.find('#categoria').setValue('c1')
      await wrapper.find('#banco').setValue('b1')
      await wrapper.find('#fecha').setValue('2026-07-20')
      await wrapper.find('form').trigger('submit.prevent')
      await new Promise((r) => setTimeout(r, 0))

      expect(fromMock).not.toHaveBeenCalled()
      expect(wrapper.find('[role="alert"]').text()).toBe('Ingresa un monto válido mayor a 0.')
    })

    it('borde: monto no numérico bloquea el envío', async () => {
      const store = useGastosStore()
      store.establecerCategorias([categoriaFalsa])
      useIngresosStore().establecerBancos([bancoFalso])

      const wrapper = montarFormulario(null)
      await wrapper.find('#monto').setValue('abc')
      await wrapper.find('#moneda').setValue('PEN')
      await wrapper.find('#categoria').setValue('c1')
      await wrapper.find('#banco').setValue('b1')
      await wrapper.find('#fecha').setValue('2026-07-20')
      await wrapper.find('form').trigger('submit.prevent')
      await new Promise((r) => setTimeout(r, 0))

      expect(fromMock).not.toHaveBeenCalled()
      expect(wrapper.find('[role="alert"]').text()).toBe('Ingresa un monto válido mayor a 0.')
    })

    it('borde: falta moneda bloquea el envío con mensaje de campo obligatorio', async () => {
      const store = useGastosStore()
      store.establecerCategorias([categoriaFalsa])
      useIngresosStore().establecerBancos([bancoFalso])

      const wrapper = montarFormulario(null)
      await wrapper.find('#monto').setValue('45.50')
      await wrapper.find('#categoria').setValue('c1')
      await wrapper.find('#banco').setValue('b1')
      await wrapper.find('#fecha').setValue('2026-07-20')
      await wrapper.find('form').trigger('submit.prevent')
      await new Promise((r) => setTimeout(r, 0))

      expect(fromMock).not.toHaveBeenCalled()
      expect(wrapper.find('[role="alert"]').text()).toBe('Selecciona una moneda.')
    })

    it('borde: falta categoría bloquea el envío con mensaje de campo obligatorio', async () => {
      const store = useGastosStore()
      store.establecerCategorias([categoriaFalsa])
      useIngresosStore().establecerBancos([bancoFalso])

      const wrapper = montarFormulario(null)
      await wrapper.find('#monto').setValue('45.50')
      await wrapper.find('#moneda').setValue('PEN')
      await wrapper.find('#banco').setValue('b1')
      await wrapper.find('#fecha').setValue('2026-07-20')
      await wrapper.find('form').trigger('submit.prevent')
      await new Promise((r) => setTimeout(r, 0))

      expect(fromMock).not.toHaveBeenCalled()
      expect(wrapper.find('[role="alert"]').text()).toBe('Selecciona una categoría.')
    })

    it('borde: falta banco bloquea el envío con mensaje de campo obligatorio (retrofit Épica 2)', async () => {
      const store = useGastosStore()
      store.establecerCategorias([categoriaFalsa])
      useIngresosStore().establecerBancos([bancoFalso])

      const wrapper = montarFormulario(null)
      await wrapper.find('#monto').setValue('45.50')
      await wrapper.find('#moneda').setValue('PEN')
      await wrapper.find('#categoria').setValue('c1')
      await wrapper.find('#fecha').setValue('2026-07-20')
      await wrapper.find('form').trigger('submit.prevent')
      await new Promise((r) => setTimeout(r, 0))

      expect(fromMock).not.toHaveBeenCalled()
      expect(wrapper.find('[role="alert"]').text()).toBe('Selecciona un banco.')
    })

    it('borde: sin categorías cargadas muestra mensaje y deshabilita el botón guardar', async () => {
      const store = useGastosStore()
      store.establecerCategorias([])
      useIngresosStore().establecerBancos([bancoFalso])

      const wrapper = montarFormulario(null)

      expect(wrapper.find('[role="alert"]').text()).toBe('No hay categorías; créalas primero.')
      expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined()

      await wrapper.find('form').trigger('submit.prevent')
      await new Promise((r) => setTimeout(r, 0))
      expect(fromMock).not.toHaveBeenCalled()
    })

    it('borde: una categoría desactivada no aparece en los chips ni en el <select> de alta', async () => {
      const store = useGastosStore()
      const categoriaInactiva: Categoria = { ...categoriaFalsa, id: 'c2', nombre: 'Ocio', activa: false }
      store.establecerCategorias([categoriaFalsa, categoriaInactiva])
      useIngresosStore().establecerBancos([bancoFalso])

      const wrapper = montarFormulario(null)

      expect(wrapper.findAll('.chip-categoria')).toHaveLength(1)
      expect(wrapper.find('.chip-categoria').text()).toContain('Comida')
      const opciones = wrapper.findAll('#categoria option')
      expect(opciones.map((o) => o.text())).not.toContain('Ocio')
    })
  })

  describe('HU-2.2 — editar gasto', () => {
    it('camino feliz: gasto manual — todos los campos aparecen prellenados y editables; al guardar se actualiza', async () => {
      const store = useGastosStore()
      store.establecerCategorias([categoriaFalsa])
      useIngresosStore().establecerBancos([bancoFalso])

      const wrapper = montarFormulario(gastoManual)

      // Prellenado
      expect((wrapper.find('#monto').element as HTMLInputElement).value).toBe('20')
      expect((wrapper.find('#moneda').element as HTMLSelectElement).value).toBe('PEN')
      expect((wrapper.find('#categoria').element as HTMLSelectElement).value).toBe('c1')
      expect((wrapper.find('#banco').element as HTMLSelectElement).value).toBe('b1')
      expect((wrapper.find('#fecha').element as HTMLInputElement).value).toBe('2026-07-01')
      // Editable (no disabled)
      expect(wrapper.find('#monto').attributes('disabled')).toBeUndefined()
      expect(wrapper.find('#fecha').attributes('disabled')).toBeUndefined()

      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      const gastoActualizado: Gasto = { ...gastoManual, monto: 30 }
      ;(builder.single as Mock).mockResolvedValueOnce({ data: gastoActualizado, error: null })

      await wrapper.find('#monto').setValue('30')
      await wrapper.find('form').trigger('submit.prevent')
      await new Promise((r) => setTimeout(r, 0))

      expect(builder.update).toHaveBeenCalledWith({
        monto: 30,
        moneda: 'PEN',
        categoria_id: 'c1',
        banco_id: 'b1',
        fecha: '2026-07-01',
        descripcion: 'algo',
      })
      expect(builder.eq).toHaveBeenCalledWith('id', 'g1')
      expect(wrapper.emitted('guardado')).toHaveLength(1)
    })

    it('camino feliz: gasto origen correo — monto y fecha son referencia no editable; categoría/banco/descripción editables; el payload no incluye monto ni fecha', async () => {
      const store = useGastosStore()
      const otraCategoria: Categoria = { ...categoriaFalsa, id: 'c2', nombre: 'Transporte' }
      store.establecerCategorias([categoriaFalsa, otraCategoria])
      const otroBanco: Banco = { ...bancoFalso, id: 'b2', nombre: 'Interbank' }
      useIngresosStore().establecerBancos([bancoFalso, otroBanco])

      const wrapper = montarFormulario(gastoCorreo)

      // Monto de referencia formateado, campo deshabilitado
      const inputMonto = wrapper.find('#monto')
      expect(inputMonto.attributes('disabled')).toBeDefined()
      expect((inputMonto.element as HTMLInputElement).value).toContain('35.90')
      expect(wrapper.find('#fecha').attributes('disabled')).toBeDefined()
      // Categoría, banco y descripción sí editables
      expect(wrapper.find('#categoria').attributes('disabled')).toBeUndefined()
      expect(wrapper.find('#banco').attributes('disabled')).toBeUndefined()
      expect(wrapper.find('#descripcion').attributes('disabled')).toBeUndefined()

      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      const gastoActualizado: Gasto = { ...gastoCorreo, categoria_id: 'c2', banco_id: 'b2', descripcion: 'nueva desc' }
      ;(builder.single as Mock).mockResolvedValueOnce({ data: gastoActualizado, error: null })

      await wrapper.find('#categoria').setValue('c2')
      await wrapper.find('#banco').setValue('b2')
      await wrapper.find('#descripcion').setValue('nueva desc')
      await wrapper.find('form').trigger('submit.prevent')
      await new Promise((r) => setTimeout(r, 0))

      expect(builder.update).toHaveBeenCalledWith({
        categoria_id: 'c2',
        banco_id: 'b2',
        descripcion: 'nueva desc',
      })
      expect(builder.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ monto: expect.anything() }),
      )
      expect(builder.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ fecha: expect.anything() }),
      )
      expect(wrapper.emitted('guardado')).toHaveLength(1)
    })

    it('borde: en edición manual, las validaciones del alta (monto > 0, moneda y categoría) también aplican', async () => {
      const store = useGastosStore()
      store.establecerCategorias([categoriaFalsa])
      useIngresosStore().establecerBancos([bancoFalso])

      const wrapper = montarFormulario(gastoManual)
      await wrapper.find('#monto').setValue('0')
      await wrapper.find('form').trigger('submit.prevent')
      await new Promise((r) => setTimeout(r, 0))

      expect(fromMock).not.toHaveBeenCalled()
      expect(wrapper.find('[role="alert"]').text()).toBe('Ingresa un monto válido mayor a 0.')
    })
  })
})
