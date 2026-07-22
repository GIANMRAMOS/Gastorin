import { beforeEach, describe, expect, it, type Mock } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import FormularioPresupuesto from '@/components/FormularioPresupuesto.vue'
import { useAuthStore } from '@/stores/auth'
import { useGastosStore } from '@/stores/gastos'
import { supabase } from '@/lib/supabaseClient'
import { crearConstructorConsulta } from '@/lib/__mocks__/supabaseClient'
import type { Categoria, Presupuesto } from '@/types/gasto'

const fromMock = supabase.from as unknown as Mock

const categoriaComida: Categoria = {
  id: 'c1',
  usuario_id: 'u1',
  nombre: 'Comida',
  predefinida: true,
  activa: true,
  creado_en: '',
  abreviatura: 'C',
}

const presupuestoBase: Presupuesto = {
  id: 'p1',
  usuario_id: 'u1',
  categoria_id: 'c1',
  mes: '2026-07-01',
  moneda: 'PEN',
  monto_limite: 500,
  creado_en: '',
}

function montarFormulario(presupuesto: Presupuesto | null = null) {
  const store = useGastosStore()
  store.establecerCategorias([categoriaComida])
  return mount(FormularioPresupuesto, { props: { presupuesto } })
}

describe('FormularioPresupuesto', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const authStore = useAuthStore()
    authStore.establecerUsuario({ id: 'u1', email: 'a@a.com' } as never)
  })

  describe('HU-6.1 — alta de presupuesto', () => {
    it('borde: sin categoría seleccionada muestra error de validación y no llama al composable', async () => {
      const wrapper = montarFormulario(null)
      await wrapper.find('#moneda').setValue('PEN')
      await wrapper.find('#monto-limite').setValue('100')
      await wrapper.find('form').trigger('submit.prevent')
      await new Promise((r) => setTimeout(r, 0))

      expect(fromMock).not.toHaveBeenCalled()
      expect(wrapper.find('[role="alert"]').text()).toBe('Selecciona una categoría.')
    })

    it('borde: monto igual a 0 bloquea el envío', async () => {
      const wrapper = montarFormulario(null)
      await wrapper.find('#categoria').setValue('c1')
      await wrapper.find('#moneda').setValue('PEN')
      await wrapper.find('#monto-limite').setValue('0')
      await wrapper.find('form').trigger('submit.prevent')
      await new Promise((r) => setTimeout(r, 0))

      expect(fromMock).not.toHaveBeenCalled()
      expect(wrapper.find('[role="alert"]').text()).toBe('Ingresa un monto límite mayor a 0.')
    })

    it('borde: monto negativo bloquea el envío', async () => {
      const wrapper = montarFormulario(null)
      await wrapper.find('#categoria').setValue('c1')
      await wrapper.find('#moneda').setValue('PEN')
      await wrapper.find('#monto-limite').setValue('-50')
      await wrapper.find('form').trigger('submit.prevent')
      await new Promise((r) => setTimeout(r, 0))

      expect(fromMock).not.toHaveBeenCalled()
      expect(wrapper.find('[role="alert"]').text()).toBe('Ingresa un monto límite mayor a 0.')
    })

    it('camino feliz: alta válida llama a crearPresupuesto y emite guardado', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      const presupuestoCreado = { ...presupuestoBase, id: 'p-nueva' }
      ;(builder.single as Mock).mockResolvedValueOnce({ data: presupuestoCreado, error: null })

      const wrapper = montarFormulario(null)
      await wrapper.find('#categoria').setValue('c1')
      await wrapper.find('#moneda').setValue('PEN')
      await wrapper.find('#monto-limite').setValue('500')
      await wrapper.find('form').trigger('submit.prevent')
      await new Promise((r) => setTimeout(r, 0))

      expect(builder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ categoria_id: 'c1', moneda: 'PEN', monto_limite: 500 }),
      )
      expect(wrapper.emitted('guardado')).toHaveLength(1)
    })

    it('muestra el error del store (23505 mapeado) cuando el composable falla', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.single as Mock).mockResolvedValueOnce({
        data: null,
        error: { code: '23505', message: 'duplicate key value violates unique constraint' },
      })

      const wrapper = montarFormulario(null)
      await wrapper.find('#categoria').setValue('c1')
      await wrapper.find('#moneda').setValue('PEN')
      await wrapper.find('#monto-limite').setValue('500')
      await wrapper.find('form').trigger('submit.prevent')
      await new Promise((r) => setTimeout(r, 0))

      expect(wrapper.find('[role="alert"]').text()).toBe(
        'Ya existe un presupuesto para esa categoría, mes y moneda.',
      )
      expect(wrapper.emitted('guardado')).toBeUndefined()
    })
  })

  describe('HU-6.3 — edición y eliminación', () => {
    it('categoría y moneda son de solo lectura en edición', () => {
      const wrapper = montarFormulario(presupuestoBase)

      expect(wrapper.find('#categoria').attributes('disabled')).toBeDefined()
      expect(wrapper.find('#moneda').attributes('disabled')).toBeDefined()
      expect(wrapper.find('.chips-categoria').exists()).toBe(false)
    })

    it('cambiar el monto límite llama a editarPresupuesto y emite guardado', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      const presupuestoEditado = { ...presupuestoBase, monto_limite: 800 }
      ;(builder.single as Mock).mockResolvedValueOnce({ data: presupuestoEditado, error: null })

      const wrapper = montarFormulario(presupuestoBase)
      await wrapper.find('#monto-limite').setValue('800')
      await wrapper.find('form').trigger('submit.prevent')
      await new Promise((r) => setTimeout(r, 0))

      expect(builder.update).toHaveBeenCalledWith({ monto_limite: 800 })
      expect(builder.eq).toHaveBeenCalledWith('id', 'p1')
      expect(wrapper.emitted('guardado')).toHaveLength(1)
    })

    it('el botón eliminar emite pedir-eliminar', async () => {
      const wrapper = montarFormulario(presupuestoBase)

      await wrapper.find('.boton-desactivar').trigger('click')

      expect(wrapper.emitted('pedir-eliminar')).toHaveLength(1)
    })
  })
})
