import { beforeEach, describe, expect, it, type Mock } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import IngresosView from '@/views/IngresosView.vue'
import { useIngresosStore } from '@/stores/ingresos'
import { supabase } from '@/lib/supabaseClient'
import { crearConstructorConsulta } from '@/lib/__mocks__/supabaseClient'
import type { Ingreso } from '@/types/ingreso'

const fromMock = supabase.from as unknown as Mock

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

const ingresoReciente: Ingreso = {
  id: 'i1',
  usuario_id: 'u1',
  banco_id: 'b1',
  fecha: '2026-07-20',
  moneda: 'PEN',
  importe: 500,
  concepto: 'Sueldo julio',
  created_at: '',
}

const ingresoAntiguo: Ingreso = {
  id: 'i2',
  usuario_id: 'u1',
  banco_id: 'b1',
  fecha: '2026-07-01',
  moneda: 'PEN',
  importe: 200,
  concepto: 'Freelance',
  created_at: '',
}

describe('IngresosView (HU-11.3)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('camino feliz: lista los ingresos ya ordenados por fecha descendente (orden garantizado por el composable) y muestra banco/moneda/importe/concepto', async () => {
    fromMock.mockImplementation((tabla: string) => {
      const builder = crearConstructorConsulta()
      if (tabla === 'ingresos') {
        // El `.order('fecha', {ascending:false})` real lo garantiza el
        // composable; aquí se simula ya devolviendo el orden esperado.
        ;(builder.order as Mock).mockResolvedValue({
          data: [ingresoReciente, ingresoAntiguo],
          error: null,
        })
      } else {
        ;(builder.order as Mock).mockResolvedValue({
          data: [{ id: 'b1', usuario_id: 'u1', nombre: 'BCP', created_at: '' }],
          error: null,
        })
      }
      return builder
    })

    const wrapper = mount(IngresosView)
    await flushPromises()

    expect(fromMock).toHaveBeenCalledWith('ingresos')
    expect(fromMock).toHaveBeenCalledWith('bancos')

    const filas = wrapper.findAll('.fila-ingreso')
    expect(filas).toHaveLength(2)
    expect(filas[0].text()).toContain('Sueldo julio')
    expect(filas[0].text()).toContain('BCP')
    expect(filas[1].text()).toContain('Freelance')
  })

  it('borde: lista vacía renderiza un estado vacío claro, no un error, y sin filas', async () => {
    fromMock.mockImplementation(() => {
      const builder = crearConstructorConsulta()
      ;(builder.order as Mock).mockResolvedValue({ data: [], error: null })
      return builder
    })

    const wrapper = mount(IngresosView)
    await flushPromises()

    expect(wrapper.findAll('.fila-ingreso')).toHaveLength(0)
    expect(wrapper.find('.estado-vacio').exists()).toBe(true)
    expect(wrapper.find('.mensaje-vacio').text()).toBe('Todavía no hay ingresos registrados.')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('el botón "+ Nuevo ingreso" abre el modal de alta', async () => {
    fromMock.mockImplementation(() => {
      const builder = crearConstructorConsulta()
      ;(builder.order as Mock).mockResolvedValue({ data: [], error: null })
      return builder
    })

    const wrapper = mount(IngresosView)
    await flushPromises()

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    await wrapper.find('.boton-nuevo').trigger('click')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
  })

  it('borde: error de carga de ingresos deja el mensaje del store visible', async () => {
    fromMock.mockImplementation((tabla: string) => {
      const builder = crearConstructorConsulta()
      if (tabla === 'ingresos') {
        ;(builder.order as Mock).mockResolvedValue({ data: null, error: { message: 'boom' } })
      } else {
        ;(builder.order as Mock).mockResolvedValue({ data: [], error: null })
      }
      return builder
    })

    const wrapper = mount(IngresosView)
    await flushPromises()

    const store = useIngresosStore()
    expect(store.error).toBe('No se pudieron cargar los ingresos.')
    expect(wrapper.find('[role="alert"]').text()).toBe('No se pudieron cargar los ingresos.')
  })

  /**
   * Estas pruebas cubren HU-11.3 (editar) y HU-11.4 (eliminar con
   * confirmación), espejo de `HistorialView.spec.ts`. Se estuba `from()`
   * para que `cargarIngresos` cargue `ingresoReciente` (vía la ruta real de
   * la vista) y `cargarBancos` devuelva una lista sin interferir.
   */
  describe('editar y eliminar ingreso (HU-11.3 / HU-11.4)', () => {
    beforeEach(() => {
      fromMock.mockImplementation((tabla: string) => {
        const builder = crearConstructorConsulta()
        if (tabla === 'ingresos') {
          ;(builder.order as Mock).mockResolvedValue({ data: [ingresoReciente], error: null })
        } else {
          ;(builder.order as Mock).mockResolvedValue({
            data: [{ id: 'b1', usuario_id: 'u1', nombre: 'BCP', created_at: '' }],
            error: null,
          })
        }
        return builder
      })
    })

    it('camino feliz editar: clic en "Editar" abre ModalIngreso con el ingreso prellenado', async () => {
      const wrapper = mount(IngresosView)
      await flushPromises()

      expect(wrapper.findComponent({ name: 'ModalIngreso' }).exists()).toBe(false)

      const botonEditar = wrapper.findAll('li button').find((b) => b.text() === 'Editar ›')!
      await botonEditar.trigger('click')

      const modal = wrapper.findComponent({ name: 'ModalIngreso' })
      expect(modal.exists()).toBe(true)
      expect(modal.props('ingreso')).toEqual(ingresoReciente)
    })

    it('regresión alta: "+ Nuevo ingreso" abre el modal con ingreso null', async () => {
      const wrapper = mount(IngresosView)
      await flushPromises()

      await wrapper.find('.boton-nuevo').trigger('click')

      const modal = wrapper.findComponent({ name: 'ModalIngreso' })
      expect(modal.exists()).toBe(true)
      expect(modal.props('ingreso')).toBeNull()
    })

    it('pide confirmación antes de borrar: clic en "Eliminar" abre el diálogo pero no borra de inmediato', async () => {
      const store = useIngresosStore()

      const wrapper = mount(IngresosView)
      await flushPromises()

      expect(wrapper.find('[role="alertdialog"]').exists()).toBe(false)

      const botonEliminar = wrapper.findAll('li button').find((b) => b.text() === 'Eliminar')!
      await botonEliminar.trigger('click')
      await flushPromises()

      expect(wrapper.find('[role="alertdialog"]').exists()).toBe(true)
      expect(store.ingresos).toHaveLength(1)
    })

    it('camino feliz eliminar: confirmar elimina el ingreso y desaparece de la lista', async () => {
      const store = useIngresosStore()

      const wrapper = mount(IngresosView)
      await flushPromises()

      expect(wrapper.text()).toContain('Sueldo julio')

      const botonEliminar = wrapper.findAll('li button').find((b) => b.text() === 'Eliminar')!
      await botonEliminar.trigger('click')
      await flushPromises()

      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.eq as Mock).mockResolvedValueOnce({ error: null })

      await wrapper.find('[role="alertdialog"] button.boton-primario').trigger('click')
      await flushPromises()

      expect(builder.delete).toHaveBeenCalled()
      expect(builder.eq).toHaveBeenCalledWith('id', 'i1')
      expect(store.ingresos).toHaveLength(0)
      expect(wrapper.text()).not.toContain('Sueldo julio')
    })

    it('cancelar la eliminación no borra nada: sin llamada nueva a Supabase, el ingreso permanece y el diálogo se cierra', async () => {
      const store = useIngresosStore()

      const wrapper = mount(IngresosView)
      await flushPromises()

      const botonEliminar = wrapper.findAll('li button').find((b) => b.text() === 'Eliminar')!
      await botonEliminar.trigger('click')
      await flushPromises()

      expect(wrapper.find('[role="alertdialog"]').exists()).toBe(true)

      const llamadasAntes = fromMock.mock.calls.length
      await wrapper.find('[role="alertdialog"] button.enlace-secundario').trigger('click')
      await flushPromises()

      expect(fromMock.mock.calls.length).toBe(llamadasAntes)
      expect(store.ingresos).toHaveLength(1)
      expect(wrapper.text()).toContain('Sueldo julio')
      expect(wrapper.find('[role="alertdialog"]').exists()).toBe(false)
    })

    it('mensaje del diálogo de confirmación', async () => {
      const wrapper = mount(IngresosView)
      await flushPromises()

      const botonEliminar = wrapper.findAll('li button').find((b) => b.text() === 'Eliminar')!
      await botonEliminar.trigger('click')
      await flushPromises()

      expect(wrapper.find('[role="alertdialog"]').text()).toContain(
        '¿Seguro que quieres eliminar este ingreso? Esta acción no se puede deshacer.',
      )
    })
  })
})
