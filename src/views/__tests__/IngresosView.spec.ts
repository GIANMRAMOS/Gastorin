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
})
