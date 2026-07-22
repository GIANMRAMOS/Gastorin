import { beforeEach, describe, expect, it, type Mock } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PresupuestosView from '@/views/PresupuestosView.vue'
import { useGastosStore } from '@/stores/gastos'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabaseClient'
import { crearConstructorConsulta } from '@/lib/__mocks__/supabaseClient'
import type { Categoria, Gasto, Presupuesto } from '@/types/gasto'

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

const mesActual = `${new Date().toISOString().slice(0, 7)}-01`

const presupuestoBase: Presupuesto = {
  id: 'p1',
  usuario_id: 'u1',
  categoria_id: 'c1',
  mes: mesActual,
  moneda: 'PEN',
  monto_limite: 500,
  creado_en: '',
}

function gastoDe(monto: number): Gasto {
  return {
    id: 'g1',
    usuario_id: 'u1',
    categoria_id: 'c1',
    banco_id: 'b1',
    monto,
    moneda: 'PEN',
    fecha: `${mesActual.slice(0, 7)}-10`,
    descripcion: null,
    origen: 'manual',
    estado: 'confirmado',
    gmail_message_id: null,
    gmail_fragmento: null,
    creado_en: '',
    actualizado_en: '',
  }
}

/** `onMounted` llama a `cargarCategorias`, `cargarGastos` y `cargarPresupuestos`, en ese orden. */
function prepararCargaInicial(categorias: Categoria[], gastos: Gasto[], presupuestos: Presupuesto[]) {
  const builderCategorias = crearConstructorConsulta()
  const builderGastos = crearConstructorConsulta()
  const builderPresupuestos = crearConstructorConsulta()
  fromMock
    .mockReturnValueOnce(builderCategorias)
    .mockReturnValueOnce(builderGastos)
    .mockReturnValueOnce(builderPresupuestos)
  ;(builderCategorias.order as Mock).mockResolvedValueOnce({ data: categorias, error: null })
  ;(builderGastos.order as Mock).mockResolvedValueOnce({ data: gastos, error: null })
  ;(builderPresupuestos.eq as Mock).mockResolvedValueOnce({ data: presupuestos, error: null })
}

describe('PresupuestosView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const authStore = useAuthStore()
    authStore.establecerUsuario({ id: 'u1', email: 'a@a.com' } as never)
  })

  it('onMounted dispara cargarCategorias, cargarGastos y cargarPresupuestos', async () => {
    prepararCargaInicial([categoriaComida], [], [presupuestoBase])

    mount(PresupuestosView)
    await new Promise((r) => setTimeout(r, 0))

    expect(fromMock).toHaveBeenCalledWith('categorias')
    expect(fromMock).toHaveBeenCalledWith('gastos')
    expect(fromMock).toHaveBeenCalledWith('presupuestos')
  })

  it('el botón "+ Nuevo presupuesto" abre ModalPresupuesto en modo alta', async () => {
    prepararCargaInicial([categoriaComida], [], [])

    const wrapper = mount(PresupuestosView)
    await new Promise((r) => setTimeout(r, 0))
    await wrapper.vm.$nextTick()

    await wrapper.find('.boton-nuevo').trigger('click')

    const modal = wrapper.findComponent({ name: 'ModalPresupuesto' })
    expect(modal.exists()).toBe(true)
    expect(modal.props('presupuesto')).toBeNull()
  })

  it('renderiza una TarjetaPresupuesto por presupuesto con el gastado derivado correcto', async () => {
    prepararCargaInicial([categoriaComida], [gastoDe(100), gastoDe(50)], [presupuestoBase])

    const wrapper = mount(PresupuestosView)
    await new Promise((r) => setTimeout(r, 0))
    await wrapper.vm.$nextTick()

    const tarjetas = wrapper.findAllComponents({ name: 'TarjetaPresupuesto' })
    expect(tarjetas).toHaveLength(1)
    expect(tarjetas[0].props('gastado')).toBe(150)
  })

  it('eliminar desde la tarjeta abre DialogoConfirmacion; confirmar llama a eliminarPresupuesto', async () => {
    prepararCargaInicial([categoriaComida], [], [presupuestoBase])

    const wrapper = mount(PresupuestosView)
    await new Promise((r) => setTimeout(r, 0))
    await wrapper.vm.$nextTick()

    await wrapper.findComponent({ name: 'TarjetaPresupuesto' }).vm.$emit('eliminar')
    await wrapper.vm.$nextTick()

    expect(wrapper.findComponent({ name: 'DialogoConfirmacion' }).exists()).toBe(true)

    const builderEliminar = crearConstructorConsulta()
    fromMock.mockReturnValueOnce(builderEliminar)
    ;(builderEliminar.eq as Mock).mockResolvedValueOnce({ error: null })

    await wrapper.find('.dialogo-acciones .boton-primario').trigger('click')
    await new Promise((r) => setTimeout(r, 0))
    await wrapper.vm.$nextTick()

    const store = useGastosStore()
    expect(store.presupuestos).toEqual([])
  })

  it('cancelar la eliminación no borra el presupuesto', async () => {
    prepararCargaInicial([categoriaComida], [], [presupuestoBase])

    const wrapper = mount(PresupuestosView)
    await new Promise((r) => setTimeout(r, 0))
    await wrapper.vm.$nextTick()

    await wrapper.findComponent({ name: 'TarjetaPresupuesto' }).vm.$emit('eliminar')
    await wrapper.vm.$nextTick()

    await wrapper.find('.dialogo-acciones .enlace-secundario').trigger('click')
    await wrapper.vm.$nextTick()

    const store = useGastosStore()
    expect(store.presupuestos).toEqual([presupuestoBase])
  })

  it('muestra store.error en un p[role=alert]', async () => {
    const builderCategorias = crearConstructorConsulta()
    const builderGastos = crearConstructorConsulta()
    const builderPresupuestos = crearConstructorConsulta()
    fromMock
      .mockReturnValueOnce(builderCategorias)
      .mockReturnValueOnce(builderGastos)
      .mockReturnValueOnce(builderPresupuestos)
    ;(builderCategorias.order as Mock).mockResolvedValueOnce({ data: [], error: null })
    ;(builderGastos.order as Mock).mockResolvedValueOnce({ data: [], error: null })
    ;(builderPresupuestos.eq as Mock).mockResolvedValueOnce({ data: null, error: { message: 'boom' } })

    const wrapper = mount(PresupuestosView)
    await new Promise((r) => setTimeout(r, 0))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[role="alert"]').text()).toBe('No se pudieron cargar los presupuestos.')
  })
})
