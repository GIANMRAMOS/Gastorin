import { beforeEach, describe, expect, it, type Mock } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import HistorialView from '@/views/HistorialView.vue'
import { useGastosStore } from '@/stores/gastos'
import { supabase } from '@/lib/supabaseClient'
import { crearConstructorConsulta } from '@/lib/__mocks__/supabaseClient'
import type { Gasto } from '@/types/gasto'

const fromMock = supabase.from as unknown as Mock

const gastoFalso: Gasto = {
  id: 'g1',
  usuario_id: 'u1',
  categoria_id: 'c1',
  banco_id: 'b1',
  monto: 20,
  moneda: 'PEN',
  fecha: '2026-07-01',
  descripcion: 'almuerzo',
  origen: 'manual',
  estado: 'confirmado',
  gmail_message_id: null,
  gmail_fragmento: null,
  creado_en: '',
  actualizado_en: '',
}

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

/**
 * Estas pruebas cubren HU-2.3 (eliminar con confirmación) a nivel de
 * integración con `HistorialView`, que es quien orquesta `DialogoConfirmacion`
 * + `useGastos().eliminarGasto`. Se estuban las llamadas de `onMounted`
 * (`cargarCategorias`/`cargarGastos`) para que no interfieran.
 */
describe('HistorialView — eliminar gasto (HU-2.3)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // `onMounted` dispara cargarCategorias() y cargarGastos(): como es
    // asíncrono, resuelve DESPUÉS del montaje y sobreescribiría cualquier
    // gasto sembrado a mano en el store. Por eso se estuba `from()` para que
    // `cargarGastos` cargue `gastoFalso` (vía la ruta real de la vista) y
    // `cargarCategorias` devuelva una lista vacía sin interferir.
    fromMock.mockImplementation((tabla: string) => {
      const builder = crearConstructorConsulta()
      if (tabla === 'gastos') {
        ;(builder.order as Mock).mockResolvedValue({ data: [gastoFalso], error: null })
      } else {
        // Cubre 'categorias' y 'bancos': listas vacías que no interfieren
        // con el gasto sembrado a mano en el store.
        ;(builder.order as Mock).mockResolvedValue({ data: [], error: null })
      }
      return builder
    })
  })

  it('pide confirmación antes de borrar: clic en "Eliminar" abre el diálogo pero no borra de inmediato', async () => {
    const store = useGastosStore()

    const wrapper = mount(HistorialView)
    await flushPromises()

    expect(wrapper.find('[role="alertdialog"]').exists()).toBe(false)

    const botonEliminar = wrapper.findAll('li button').find((b) => b.text() === 'Eliminar')!
    await botonEliminar.trigger('click')
    await flushPromises()

    // El diálogo aparece, pero el gasto sigue en el store: no se borró todavía.
    expect(wrapper.find('[role="alertdialog"]').exists()).toBe(true)
    expect(store.gastos).toHaveLength(1)
  })

  it('camino feliz: confirmar elimina el gasto y desaparece de la lista', async () => {
    const store = useGastosStore()

    const wrapper = mount(HistorialView)
    await flushPromises()

    expect(wrapper.text()).toContain('almuerzo')

    const botones = wrapper.findAll('li button')
    const botonEliminar = botones.find((b) => b.text() === 'Eliminar')!
    await botonEliminar.trigger('click')
    await flushPromises()

    expect(wrapper.find('[role="alertdialog"]').exists()).toBe(true)

    // Prepara la respuesta del delete antes de confirmar.
    const builder = crearConstructorConsulta()
    fromMock.mockReturnValueOnce(builder)
    ;(builder.eq as Mock).mockResolvedValueOnce({ error: null })

    await wrapper.find('[role="alertdialog"] button.boton-primario').trigger('click')
    await flushPromises()

    expect(builder.delete).toHaveBeenCalled()
    expect(builder.eq).toHaveBeenCalledWith('id', 'g1')
    expect(store.gastos).toHaveLength(0)
    expect(wrapper.text()).not.toContain('almuerzo')
  })

  it('el botón "+ Nuevo gasto" abre ModalGasto en modo alta (sin gasto prellenado)', async () => {
    const wrapper = mount(HistorialView)
    await flushPromises()

    expect(wrapper.findComponent({ name: 'ModalGasto' }).exists()).toBe(false)

    await wrapper.find('.boton-nuevo').trigger('click')

    const modal = wrapper.findComponent({ name: 'ModalGasto' })
    expect(modal.exists()).toBe(true)
    expect(modal.props('gasto')).toBeNull()
  })

  it('borde: cancelar no borra nada — no se llama a delete y el gasto permanece', async () => {
    const store = useGastosStore()

    const wrapper = mount(HistorialView)
    await flushPromises()

    const botones = wrapper.findAll('li button')
    const botonEliminar = botones.find((b) => b.text() === 'Eliminar')!
    await botonEliminar.trigger('click')
    await flushPromises()

    expect(wrapper.find('[role="alertdialog"]').exists()).toBe(true)

    const llamadasAntes = fromMock.mock.calls.length
    await wrapper.find('[role="alertdialog"] button.enlace-secundario').trigger('click')
    await flushPromises()

    // Cancelar no debe generar ninguna llamada nueva a Supabase (ni delete).
    expect(fromMock.mock.calls.length).toBe(llamadasAntes)
    expect(store.gastos).toHaveLength(1)
    expect(wrapper.text()).toContain('almuerzo')
    expect(wrapper.find('[role="alertdialog"]').exists()).toBe(false)
  })
})
