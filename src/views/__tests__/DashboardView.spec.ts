import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import DashboardView from '@/views/DashboardView.vue'
import { useGastosStore } from '@/stores/gastos'
import { supabase } from '@/lib/supabaseClient'
import { crearConstructorConsulta } from '@/lib/__mocks__/supabaseClient'
import type { Categoria, Gasto } from '@/types/gasto'

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

const categoriaTransporte: Categoria = {
  id: 'c2',
  usuario_id: 'u1',
  nombre: 'Transporte',
  predefinida: true,
  activa: true,
  creado_en: '',
  abreviatura: 'T',
}

function gastoDe(datos: Partial<Gasto>): Gasto {
  return {
    id: `g-${Math.random()}`,
    usuario_id: 'u1',
    categoria_id: 'c1',
    banco_id: 'b1',
    monto: 100,
    moneda: 'PEN',
    fecha: '2026-07-10',
    descripcion: null,
    origen: 'manual',
    estado: 'confirmado',
    gmail_message_id: null,
    gmail_fragmento: null,
    creado_en: '',
    actualizado_en: '',
    ...datos,
  }
}

/** `onMounted` llama a `cargarCategorias` y `cargarDatosDashboard`, en ese orden. */
function prepararCargaInicial(categorias: Categoria[], gastos: Gasto[]) {
  const builderCategorias = crearConstructorConsulta()
  const builderGastos = crearConstructorConsulta()
  fromMock.mockReturnValueOnce(builderCategorias).mockReturnValueOnce(builderGastos)
  ;(builderCategorias.order as Mock).mockResolvedValueOnce({ data: categorias, error: null })
  ;(builderGastos.order as Mock).mockResolvedValueOnce({ data: gastos, error: null })
}

describe('DashboardView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 15)) // 15 jul 2026: fija "mes actual" para todo el spec
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('onMounted dispara cargarCategorias y cargarDatosDashboard', async () => {
    prepararCargaInicial([categoriaComida], [])

    mount(DashboardView)
    await flushPromises()

    expect(fromMock).toHaveBeenCalledWith('categorias')
    expect(fromMock).toHaveBeenCalledWith('gastos')
  })

  it('HU-7.1: muestra SIEMPRE las dos tarjetas de resumen (PEN y USD), independiente del toggle', async () => {
    prepararCargaInicial(
      [categoriaComida],
      [
        gastoDe({ moneda: 'PEN', fecha: '2026-07-05', monto: 150 }),
        gastoDe({ moneda: 'USD', fecha: '2026-07-05', monto: 40 }),
      ],
    )

    const wrapper = mount(DashboardView)
    await flushPromises()
    await wrapper.vm.$nextTick()

    const tarjetas = wrapper.findAllComponents({ name: 'TarjetaResumenMoneda' })
    expect(tarjetas).toHaveLength(2)
    expect(tarjetas.map((t) => t.props('moneda')).sort()).toEqual(['PEN', 'USD'])
    expect(tarjetas.find((t) => t.props('moneda') === 'PEN')?.props('total')).toBe(150)
    expect(tarjetas.find((t) => t.props('moneda') === 'USD')?.props('total')).toBe(40)
  })

  it('HU-7.2/HU-7.3: un único ToggleMoneda cambia a la vez el gasto por categoría y la tendencia mensual', async () => {
    prepararCargaInicial(
      [categoriaComida, categoriaTransporte],
      [
        gastoDe({ categoria_id: 'c1', moneda: 'PEN', fecha: '2026-07-05', monto: 100 }),
        gastoDe({ categoria_id: 'c2', moneda: 'USD', fecha: '2026-07-06', monto: 70 }),
      ],
    )

    const wrapper = mount(DashboardView)
    await flushPromises()
    await wrapper.vm.$nextTick()

    const lista = wrapper.findComponent({ name: 'ListaGastoPorCategoria' })
    const grafico = wrapper.findComponent({ name: 'GraficoTendenciaMensual' })

    // Por defecto en PEN: solo el gasto de 'Comida' (100) aparece; el de USD (70) no.
    expect(lista.props('moneda')).toBe('PEN')
    expect(lista.props('items')).toEqual([{ categoria_id: 'c1', nombre: 'Comida', total: 100 }])
    expect(grafico.props('moneda')).toBe('PEN')
    expect(grafico.props('datos').at(-1).total).toBe(100)

    // Un ÚNICO toggle en la vista (no uno por componente).
    expect(wrapper.findAllComponents({ name: 'ToggleMoneda' })).toHaveLength(1)

    await wrapper.findComponent({ name: 'ToggleMoneda' }).vm.$emit('update:modelValue', 'USD')
    await wrapper.vm.$nextTick()

    const listaTrasCambio = wrapper.findComponent({ name: 'ListaGastoPorCategoria' })
    const graficoTrasCambio = wrapper.findComponent({ name: 'GraficoTendenciaMensual' })
    expect(listaTrasCambio.props('moneda')).toBe('USD')
    expect(listaTrasCambio.props('items')).toEqual([{ categoria_id: 'c2', nombre: 'Transporte', total: 70 }])
    expect(graficoTrasCambio.props('moneda')).toBe('USD')
    expect(graficoTrasCambio.props('datos').at(-1).total).toBe(70)
  })

  it('HU-7.3: la tendencia mensual siempre trae 6 meses, con el mes actual al final', async () => {
    prepararCargaInicial([categoriaComida], [gastoDe({ moneda: 'PEN', fecha: '2026-07-05', monto: 100 })])

    const wrapper = mount(DashboardView)
    await flushPromises()
    await wrapper.vm.$nextTick()

    const grafico = wrapper.findComponent({ name: 'GraficoTendenciaMensual' })
    const datos = grafico.props('datos') as Array<{ mes: string; total: number }>
    expect(datos).toHaveLength(6)
    expect(datos.at(-1)?.mes).toBe('2026-07')
  })

  it('estado sin datos: renderiza sin error (ceros/vacíos, sin romper)', async () => {
    prepararCargaInicial([], [])

    const wrapper = mount(DashboardView)
    await flushPromises()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    const tarjetas = wrapper.findAllComponents({ name: 'TarjetaResumenMoneda' })
    expect(tarjetas.every((t) => t.props('total') === 0)).toBe(true)
    expect(wrapper.findComponent({ name: 'ListaGastoPorCategoria' }).props('items')).toEqual([])
  })

  it('muestra store.error en un p[role=alert] cuando falla la carga del dashboard', async () => {
    const builderCategorias = crearConstructorConsulta()
    const builderGastos = crearConstructorConsulta()
    fromMock.mockReturnValueOnce(builderCategorias).mockReturnValueOnce(builderGastos)
    ;(builderCategorias.order as Mock).mockResolvedValueOnce({ data: [], error: null })
    ;(builderGastos.order as Mock).mockResolvedValueOnce({ data: null, error: { message: 'boom' } })

    const wrapper = mount(DashboardView)
    await flushPromises()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[role="alert"]').text()).toBe('No se pudieron cargar los datos del dashboard.')
  })

  it('riesgo: no reusa store.gastos preexistente (Historial) para sus cálculos', async () => {
    const store = useGastosStore()
    store.establecerGastos([gastoDe({ id: 'de-historial', moneda: 'PEN', fecha: '2026-07-01', monto: 99999 })])

    prepararCargaInicial([categoriaComida], [gastoDe({ id: 'del-dashboard', moneda: 'PEN', fecha: '2026-07-05', monto: 100 })])

    const wrapper = mount(DashboardView)
    await flushPromises()
    await wrapper.vm.$nextTick()

    const tarjetaPEN = wrapper
      .findAllComponents({ name: 'TarjetaResumenMoneda' })
      .find((t) => t.props('moneda') === 'PEN')
    // Si hubiera reusado store.gastos, el total incluiría el 99999 "colado" de Historial.
    expect(tarjetaPEN?.props('total')).toBe(100)
  })
})
