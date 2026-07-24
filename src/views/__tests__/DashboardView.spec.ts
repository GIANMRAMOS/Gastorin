import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import DashboardView from '@/views/DashboardView.vue'
import { useGastosStore } from '@/stores/gastos'
import { supabase } from '@/lib/supabaseClient'
import { crearConstructorConsulta } from '@/lib/__mocks__/supabaseClient'
import type { Categoria, Gasto } from '@/types/gasto'
import type { Ingreso } from '@/types/ingreso'

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

function ingresoDe(datos: Partial<Ingreso>): Ingreso {
  return {
    id: `i-${Math.random()}`,
    usuario_id: 'u1',
    banco_id: 'b1',
    fecha: '2026-07-10',
    moneda: 'PEN',
    importe: 100,
    concepto: 'Sueldo',
    created_at: '',
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

  it('HU-7.1: la tarjeta "Gastado este mes" muestra el total PEN como principal y el USD como insignia secundaria', async () => {
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

    // Fila de resumen consolidada: 2 TarjetaResumenMoneda (Gastado + Ingresos) + 1 TarjetaBalanceMoneda.
    const tarjetasResumen = wrapper.findAllComponents({ name: 'TarjetaResumenMoneda' })
    const tarjetaGastado = tarjetasResumen.find((t: any) => t.props('etiqueta') === 'Gastado este mes')
    expect(tarjetaGastado?.props('moneda')).toBe('PEN')
    expect(tarjetaGastado?.props('total')).toBe(150)
    expect(tarjetaGastado?.props('montoSecundario')).toBe(40)
    expect(tarjetaGastado?.props('monedaSecundaria')).toBe('USD')
  })

  it('Dashboard consolidado: la tarjeta "Ingresos este mes" muestra el ingreso PEN principal, el USD como insignia y sin variación', async () => {
    const builderCategorias = crearConstructorConsulta()
    const builderGastos = crearConstructorConsulta()
    const builderIngresos = crearConstructorConsulta()
    fromMock
      .mockReturnValueOnce(builderCategorias)
      .mockReturnValueOnce(builderGastos)
      .mockReturnValueOnce(builderIngresos)
    ;(builderCategorias.order as Mock).mockResolvedValueOnce({ data: [categoriaComida], error: null })
    ;(builderGastos.order as Mock).mockResolvedValueOnce({ data: [], error: null })
    ;(builderIngresos.order as Mock).mockResolvedValueOnce({
      data: [
        ingresoDe({ fecha: '2026-07-05', moneda: 'PEN', importe: 500 }),
        ingresoDe({ fecha: '2026-07-06', moneda: 'USD', importe: 80 }),
      ],
      error: null,
    })

    const wrapper = mount(DashboardView)
    await flushPromises()
    await wrapper.vm.$nextTick()

    const tarjetaIngresos = wrapper
      .findAllComponents({ name: 'TarjetaResumenMoneda' })
      .find((t: any) => t.props('etiqueta') === 'Ingresos este mes')
    expect(tarjetaIngresos?.props('moneda')).toBe('PEN')
    expect(tarjetaIngresos?.props('variacionPct')).toBe(null)
    expect(tarjetaIngresos?.props('total')).toBe(500)
    expect(tarjetaIngresos?.props('montoSecundario')).toBe(80)
    expect(tarjetaIngresos?.props('monedaSecundaria')).toBe('USD')

    const tarjetaBalance = wrapper.findComponent({ name: 'TarjetaBalanceMoneda' })
    expect(tarjetaBalance.exists()).toBe(true)
  })

  it('Dashboard consolidado con datos reales de ambas fuentes: cada tarjeta refleja PEN principal y USD secundario correctamente, sin cruzar gastos/ingresos', async () => {
    const builderCategorias = crearConstructorConsulta()
    const builderGastos = crearConstructorConsulta()
    const builderIngresos = crearConstructorConsulta()
    fromMock
      .mockReturnValueOnce(builderCategorias)
      .mockReturnValueOnce(builderGastos)
      .mockReturnValueOnce(builderIngresos)
    ;(builderCategorias.order as Mock).mockResolvedValueOnce({ data: [categoriaComida], error: null })
    ;(builderGastos.order as Mock).mockResolvedValueOnce({
      data: [
        gastoDe({ moneda: 'PEN', fecha: '2026-07-05', monto: 300 }),
        gastoDe({ moneda: 'USD', fecha: '2026-07-06', monto: 25 }),
      ],
      error: null,
    })
    ;(builderIngresos.order as Mock).mockResolvedValueOnce({
      data: [
        ingresoDe({ fecha: '2026-07-01', moneda: 'PEN', importe: 1200 }),
        ingresoDe({ fecha: '2026-07-02', moneda: 'USD', importe: 50 }),
      ],
      error: null,
    })

    const wrapper = mount(DashboardView)
    await flushPromises()
    await wrapper.vm.$nextTick()

    const tarjetasResumen = wrapper.findAllComponents({ name: 'TarjetaResumenMoneda' })

    // Tarjeta "Gastado este mes": PEN principal 300, USD secundario 25.
    const tarjetaGastado = tarjetasResumen.find((t: any) => t.props('etiqueta') === 'Gastado este mes')
    expect(tarjetaGastado?.props('total')).toBe(300)
    expect(tarjetaGastado?.props('montoSecundario')).toBe(25)

    // Tarjeta "Ingresos este mes": PEN principal 1200, USD secundario 50; NUNCA el total de gastos
    // (riesgo explícito de copy-paste de props entre tarjetas).
    const tarjetaIngresos = tarjetasResumen.find((t: any) => t.props('etiqueta') === 'Ingresos este mes')
    expect(tarjetaIngresos?.props('total')).toBe(1200)
    expect(tarjetaIngresos?.props('montoSecundario')).toBe(50)
    expect(tarjetaIngresos?.props('total')).not.toBe(300) // no coló el total de gastos PEN
    expect(tarjetaIngresos?.props('montoSecundario')).not.toBe(25) // no coló el total de gastos USD

    // Tarjeta Balance: ingresos − gastos, exacto y con USD como secundario (misma tarjeta, no mezclado).
    const tarjetaBalance = wrapper.findComponent({ name: 'TarjetaBalanceMoneda' })
    expect(tarjetaBalance.props('moneda')).toBe('PEN')
    expect(tarjetaBalance.props('ingresos')).toBe(1200)
    expect(tarjetaBalance.props('gastos')).toBe(300)
    expect(tarjetaBalance.props('balance')).toBe(900) // 1200 - 300
    expect(tarjetaBalance.props('montoSecundario')).toBe(25) // 50 - 25 (balance USD)
    expect(tarjetaBalance.props('monedaSecundaria')).toBe('USD')
    expect(tarjetaBalance.props('balance')).not.toBe(tarjetaBalance.props('montoSecundario'))
  })

  it('Estructura consolidada: una sola sección con 2 TarjetaResumenMoneda + 1 TarjetaBalanceMoneda, todas con insignia USD', async () => {
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

    const secciones = wrapper.findAll('.seccion-resumen')
    expect(secciones).toHaveLength(1)

    const tarjetasResumen = secciones[0].findAllComponents({ name: 'TarjetaResumenMoneda' })
    const tarjetasBalance = secciones[0].findAllComponents({ name: 'TarjetaBalanceMoneda' })
    expect(tarjetasResumen).toHaveLength(2)
    expect(tarjetasBalance).toHaveLength(1)

    // Cableado de insignia: todas reciben monedaSecundaria='USD' con un montoSecundario definido.
    ;[...tarjetasResumen, ...tarjetasBalance].forEach((t: any) => {
      expect(t.props('monedaSecundaria')).toBe('USD')
      expect(t.props('montoSecundario')).not.toBeUndefined()
    })
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
    expect(tarjetas.every((t) => t.props('montoSecundario') === 0)).toBe(true)
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

  it('Cambio 2: existe la sección "Tendencia diaria" con un GraficoTendenciaDiaria debajo de "Tendencia mensual"', async () => {
    prepararCargaInicial([categoriaComida], [gastoDe({ moneda: 'PEN', fecha: '2026-07-05', monto: 100 })])

    const wrapper = mount(DashboardView)
    await flushPromises()
    await wrapper.vm.$nextTick()

    const secciones = wrapper.findAll('.seccion-dashboard')
    const seccionMensual = secciones.find((s) => s.text().includes('Tendencia mensual'))!
    const seccionDiaria = secciones.find((s) => s.text().includes('Tendencia diaria'))!

    expect(seccionDiaria.exists()).toBe(true)
    expect(secciones.indexOf(seccionDiaria)).toBeGreaterThan(secciones.indexOf(seccionMensual))
    expect(seccionDiaria.findComponent({ name: 'GraficoTendenciaDiaria' }).exists()).toBe(true)
  })

  it('Cambio 2: un único ToggleMoneda gobierna a la vez gasto-por-categoría, tendencia mensual y tendencia diaria', async () => {
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

    expect(wrapper.findAllComponents({ name: 'ToggleMoneda' })).toHaveLength(1)
    expect(wrapper.findComponent({ name: 'GraficoTendenciaDiaria' }).props('moneda')).toBe('PEN')

    await wrapper.findComponent({ name: 'ToggleMoneda' }).vm.$emit('update:modelValue', 'USD')
    await wrapper.vm.$nextTick()

    const lista = wrapper.findComponent({ name: 'ListaGastoPorCategoria' })
    const graficoMensual = wrapper.findComponent({ name: 'GraficoTendenciaMensual' })
    const graficoDiario = wrapper.findComponent({ name: 'GraficoTendenciaDiaria' })

    expect(lista.props('moneda')).toBe('USD')
    expect(graficoMensual.props('moneda')).toBe('USD')
    expect(graficoDiario.props('moneda')).toBe('USD')
  })

  it('Cambio 2: estado sin datos, la tendencia diaria renderiza sin [role=alert] (todos los días en 0)', async () => {
    prepararCargaInicial([], [])

    const wrapper = mount(DashboardView)
    await flushPromises()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    const grafico = wrapper.findComponent({ name: 'GraficoTendenciaDiaria' })
    const datos = grafico.props('datos') as Array<{ dia: string; total: number }>
    expect(datos.every((d) => d.total === 0)).toBe(true)
  })

  it('Cambio 2: la tendencia diaria NO dispara un fetch adicional (mismo número de llamadas a from que antes)', async () => {
    prepararCargaInicial([categoriaComida], [gastoDe({ moneda: 'PEN', fecha: '2026-07-05', monto: 100 })])

    mount(DashboardView)
    await flushPromises()

    // Solo 'categorias' y 'gastos' (más, a lo sumo, 'ingresos' del propio
    // `cargarDatosDashboard`, ya existente): cargarTendenciaDiaria es una
    // agregación pura sobre `filas.value`, no agrega llamadas a `from`.
    const tablasConsultadas = fromMock.mock.calls.map(([tabla]) => tabla)
    expect(tablasConsultadas.filter((t) => t === 'gastos')).toHaveLength(1)
    expect(new Set(tablasConsultadas).size).toBeLessThanOrEqual(3)
  })

  it('riesgo: no reusa store.gastos preexistente (Historial) para sus cálculos', async () => {
    const store = useGastosStore()
    store.establecerGastos([gastoDe({ id: 'de-historial', moneda: 'PEN', fecha: '2026-07-01', monto: 99999 })])

    prepararCargaInicial([categoriaComida], [gastoDe({ id: 'del-dashboard', moneda: 'PEN', fecha: '2026-07-05', monto: 100 })])

    const wrapper = mount(DashboardView)
    await flushPromises()
    await wrapper.vm.$nextTick()

    const tarjetaGastado = wrapper
      .findAllComponents({ name: 'TarjetaResumenMoneda' })
      .find((t) => t.props('etiqueta') === 'Gastado este mes')
    // Si hubiera reusado store.gastos, el total incluiría el 99999 "colado" de Historial.
    expect(tarjetaGastado?.props('total')).toBe(100)
  })
})
