import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import DashboardView from '@/views/DashboardView.vue'
import { useGastosStore } from '@/stores/gastos'
import { useIngresosStore } from '@/stores/ingresos'
import { useUiStore } from '@/stores/ui'
import { supabase } from '@/lib/supabaseClient'
import { crearConstructorConsulta } from '@/lib/__mocks__/supabaseClient'
import type { Categoria, Gasto, Presupuesto } from '@/types/gasto'
import type { Ingreso } from '@/types/ingreso'
import type { Banco } from '@/types/ingreso'

const fromMock = supabase.from as unknown as Mock

const categoriaComida: Categoria = {
  id: 'c1',
  usuario_id: 'u1',
  nombre: 'Comida',
  tipo: 'gasto',
  predefinida: true,
  activa: true,
  creado_en: '',
  abreviatura: 'C',
}

const categoriaTransporte: Categoria = {
  id: 'c2',
  usuario_id: 'u1',
  nombre: 'Transporte',
  tipo: 'gasto',
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
    categoria_id: 'ci1',
    fecha: '2026-07-10',
    moneda: 'PEN',
    importe: 100,
    concepto: 'Sueldo',
    created_at: '',
    ...datos,
  }
}

function bancoDe(datos: Partial<Banco>): Banco {
  return { id: `b-${Math.random()}`, usuario_id: 'u1', nombre: 'Banco', created_at: '', ...datos }
}

/** Busca, entre las 3 `TarjetaKpi` de la fila superior, la de una `variante` dada. */
function kpiPorVariante(wrapper: VueWrapper, variante: 'ingreso' | 'egreso' | 'balance') {
  return wrapper
    .findAllComponents({ name: 'TarjetaKpi' })
    .find((kpi) => kpi.props('variante') === variante)
}

/**
 * `onMounted` de "Dashboard" dispara CUATRO acciones (`cargarCategorias`,
 * `cargarDatosDashboard`, `cargarPresupuestos`, `cargarBorradores`), sin
 * `await` entre ellas: sus llamadas a `supabase.from(...)` quedan
 * entrelazadas en el tiempo (cada una se resuelve en un microtask distinto),
 * así que una cadena de `mockReturnValueOnce` por posición sería frágil.
 * En su lugar, `fromMock.mockImplementation` resuelve por NOMBRE de tabla
 * (mismo patrón que `AppShellLayout.spec.ts`), sin importar el orden real.
 *
 * `gastos` se consulta DOS veces con filtros distintos: `cargarDatosDashboard`
 * (`estado='confirmado'`, vía `.eq()`) y `cargarBorradores` (`estado in
 * (borrador, revision_manual)`, vía `.in()`); se resuelven por separado para
 * no mezclar ambos resultados.
 */
function prepararCargaInicial(
  categorias: Categoria[],
  gastos: Gasto[],
  opciones: { ingresos?: Ingreso[]; presupuestos?: Presupuesto[]; borradores?: Gasto[] } = {},
) {
  const { ingresos = [], presupuestos = [], borradores = [] } = opciones

  fromMock.mockImplementation((tabla: string) => {
    if (tabla === 'categorias') {
      const builder = crearConstructorConsulta()
      ;(builder.order as Mock).mockResolvedValue({ data: categorias, error: null })
      return builder
    }
    if (tabla === 'gastos') {
      const builder = crearConstructorConsulta()
      // Camino de `cargarDatosDashboard`: .select().eq('estado','confirmado').gte(...).order(...)
      ;(builder.order as Mock).mockResolvedValue({ data: gastos, error: null })
      // Camino de `cargarBorradores`: .select().in('estado', [...]).order(...); usa un builder
      // propio para que su `.order()` no resuelva con los gastos confirmados de arriba.
      const builderBorradores = crearConstructorConsulta()
      ;(builderBorradores.order as Mock).mockResolvedValue({ data: borradores, error: null })
      ;(builder.in as Mock).mockReturnValue(builderBorradores)
      return builder
    }
    if (tabla === 'ingresos') {
      const builder = crearConstructorConsulta()
      ;(builder.order as Mock).mockResolvedValue({ data: ingresos, error: null })
      return builder
    }
    if (tabla === 'presupuestos') {
      const builder = crearConstructorConsulta()
      // Camino de `cargarPresupuestos`: .select().eq('mes', ...) es el propio terminal (sin `.order()`).
      ;(builder.eq as Mock).mockResolvedValue({ data: presupuestos, error: null })
      return builder
    }
    return crearConstructorConsulta()
  })
}

/** Router mínimo con las rutas que la vista referencia (`dashboard` propia y `bandeja` de la card de bandeja). */
function crearRouterDePrueba() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      // Ruta raíz: evita el warning "No match found" de la ubicación inicial
      // de `createMemoryHistory()` cuando el test no navega explícitamente.
      { path: '/', name: 'raiz', component: { template: '<div />' } },
      { path: '/dashboard', name: 'dashboard', component: { template: '<div />' } },
      { path: '/bandeja', name: 'bandeja', component: { template: '<div>Bandeja</div>' } },
    ],
  })
}

describe('DashboardView (rediseño "Caudal", Fase 1: Shell + Dashboard)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 15)) // 15 jul 2026: fija "mes actual" para todo el spec
    // `vi.clearAllMocks()` del setup global (`src/test/setup.ts`) solo limpia el
    // historial de llamadas, NO el `mockImplementation`/las `mockReturnValueOnce`
    // pendientes de `fromMock`: sin este reset, un test que use `mockImplementation`
    // (`prepararCargaInicial`) dejaría ese comportamiento filtrado al siguiente
    // test. Se restaura además el factory original (builder vacío encadenable)
    // como base: los tests que arman su propia cadena de `mockReturnValueOnce`
    // (sin pasar por `prepararCargaInicial`) solo cubren 2-3 tablas; las demás
    // llamadas de `onMounted` (presupuestos, segunda de `gastos`) deben caer en
    // un builder inerte, no en `undefined` (que rompería con "select is not a
    // function").
    fromMock.mockReset()
    fromMock.mockImplementation(() => crearConstructorConsulta())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('onMounted dispara cargarCategorias y cargarDatosDashboard', async () => {
    prepararCargaInicial([categoriaComida], [])

    mount(DashboardView, { global: { plugins: [crearRouterDePrueba()] } })
    await flushPromises()

    expect(fromMock).toHaveBeenCalledWith('categorias')
    expect(fromMock).toHaveBeenCalledWith('gastos')
  })

  it('KPI Egresos: recibe el gasto PEN del mes, ignorando el de USD', async () => {
    prepararCargaInicial(
      [categoriaComida],
      [
        gastoDe({ moneda: 'PEN', fecha: '2026-07-05', monto: 150 }),
        gastoDe({ moneda: 'USD', fecha: '2026-07-05', monto: 40 }),
      ],
    )

    const wrapper = mount(DashboardView, { global: { plugins: [crearRouterDePrueba()] } })
    await flushPromises()
    await wrapper.vm.$nextTick()

    const kpiEgreso = kpiPorVariante(wrapper, 'egreso')
    expect(kpiEgreso?.props('moneda')).toBe('PEN')
    expect(kpiEgreso?.props('monto')).toBe(150)
  })

  it('KPI Ingresos: recibe el ingreso PEN del mes', async () => {
    prepararCargaInicial([categoriaComida], [], {
      ingresos: [
        ingresoDe({ fecha: '2026-07-05', moneda: 'PEN', importe: 500 }),
        ingresoDe({ fecha: '2026-07-06', moneda: 'USD', importe: 80 }),
      ],
    })

    const wrapper = mount(DashboardView, { global: { plugins: [crearRouterDePrueba()] } })
    await flushPromises()
    await wrapper.vm.$nextTick()

    const kpiIngreso = kpiPorVariante(wrapper, 'ingreso')
    expect(kpiIngreso?.props('monto')).toBe(500)
  })

  it('3 KPIs con datos reales de ambas fuentes: reflejan PEN sin cruzar gastos/ingresos entre sí ni con USD', async () => {
    prepararCargaInicial(
      [categoriaComida],
      [
        gastoDe({ moneda: 'PEN', fecha: '2026-07-05', monto: 300 }),
        gastoDe({ moneda: 'USD', fecha: '2026-07-06', monto: 25 }),
      ],
      {
        ingresos: [
          ingresoDe({ fecha: '2026-07-01', moneda: 'PEN', importe: 1200 }),
          ingresoDe({ fecha: '2026-07-02', moneda: 'USD', importe: 50 }),
        ],
      },
    )

    const wrapper = mount(DashboardView, { global: { plugins: [crearRouterDePrueba()] } })
    await flushPromises()
    await wrapper.vm.$nextTick()

    expect(wrapper.findAllComponents({ name: 'TarjetaKpi' })).toHaveLength(3)

    const kpiIngreso = kpiPorVariante(wrapper, 'ingreso')
    const kpiEgreso = kpiPorVariante(wrapper, 'egreso')
    const kpiBalance = kpiPorVariante(wrapper, 'balance')

    expect(kpiIngreso?.props('monto')).toBe(1200)
    expect(kpiEgreso?.props('monto')).toBe(300)
    expect(kpiBalance?.props('monto')).toBe(900) // 1200 - 300
    expect(kpiBalance?.props('mostrarSigno')).toBe(true)
    expect(kpiEgreso?.props('monto')).not.toBe(25) // no coló el gasto USD
    expect(kpiIngreso?.props('monto')).not.toBe(50) // no coló el ingreso USD
  })

  it('Estructura Dashboard: 3 KPIs, placeholder de cuentas, presupuesto, bandeja, feed y chips se renderizan exactamente una vez cada uno', async () => {
    prepararCargaInicial(
      [categoriaComida],
      [
        gastoDe({ moneda: 'PEN', fecha: '2026-07-05', monto: 150 }),
        gastoDe({ moneda: 'USD', fecha: '2026-07-05', monto: 40 }),
      ],
    )

    const wrapper = mount(DashboardView, { global: { plugins: [crearRouterDePrueba()] } })
    await flushPromises()
    await wrapper.vm.$nextTick()

    expect(wrapper.findAllComponents({ name: 'TarjetaKpi' })).toHaveLength(3)
    expect(wrapper.findAllComponents({ name: 'TarjetaSaldosPorCuenta' })).toHaveLength(1)
    expect(wrapper.findAllComponents({ name: 'TarjetaPresupuestoResumen' })).toHaveLength(1)
    expect(wrapper.findAllComponents({ name: 'TarjetaBandejaResumen' })).toHaveLength(1)
    expect(wrapper.findAllComponents({ name: 'FeedMovimientos' })).toHaveLength(1)
    expect(wrapper.findAllComponents({ name: 'ChipsFiltroTipo' })).toHaveLength(1)
  })

  it('Layout: existe la grilla de 2 columnas con Historial a la izquierda y Presupuesto + Bandeja a la derecha', async () => {
    prepararCargaInicial([categoriaComida], [gastoDe({ moneda: 'PEN', fecha: '2026-07-05', monto: 100 })])

    const wrapper = mount(DashboardView, { global: { plugins: [crearRouterDePrueba()] } })
    await flushPromises()
    await wrapper.vm.$nextTick()

    const grid = wrapper.find('.grid-inicio')
    expect(grid.exists()).toBe(true)

    const columnaHistorial = grid.find('.columna-historial')
    const columnaLateral = grid.find('.columna-lateral-inicio')
    expect(columnaHistorial.exists()).toBe(true)
    expect(columnaLateral.exists()).toBe(true)
    expect(columnaHistorial.findComponent({ name: 'FeedMovimientos' }).exists()).toBe(true)
    expect(columnaLateral.findComponent({ name: 'TarjetaPresupuestoResumen' }).exists()).toBe(true)
    expect(columnaLateral.findComponent({ name: 'TarjetaBandejaResumen' }).exists()).toBe(true)
  })

  it('HU-7.2/HU-7.3: un único ToggleMoneda cambia a la vez el gasto por categoría y la tendencia mensual', async () => {
    prepararCargaInicial(
      [categoriaComida, categoriaTransporte],
      [
        gastoDe({ categoria_id: 'c1', moneda: 'PEN', fecha: '2026-07-05', monto: 100 }),
        gastoDe({ categoria_id: 'c2', moneda: 'USD', fecha: '2026-07-06', monto: 70 }),
      ],
    )

    const wrapper = mount(DashboardView, { global: { plugins: [crearRouterDePrueba()] } })
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

    const wrapper = mount(DashboardView, { global: { plugins: [crearRouterDePrueba()] } })
    await flushPromises()
    await wrapper.vm.$nextTick()

    const grafico = wrapper.findComponent({ name: 'GraficoTendenciaMensual' })
    const datos = grafico.props('datos') as Array<{ mes: string; total: number }>
    expect(datos).toHaveLength(6)
    expect(datos.at(-1)?.mes).toBe('2026-07')
  })

  it('estado sin datos: renderiza sin error, con los 3 KPIs en ceros', async () => {
    prepararCargaInicial([], [])

    const wrapper = mount(DashboardView, { global: { plugins: [crearRouterDePrueba()] } })
    await flushPromises()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(kpiPorVariante(wrapper, 'ingreso')?.props('monto')).toBe(0)
    expect(kpiPorVariante(wrapper, 'egreso')?.props('monto')).toBe(0)
    expect(kpiPorVariante(wrapper, 'balance')?.props('monto')).toBe(0)
    expect(wrapper.findComponent({ name: 'ListaGastoPorCategoria' }).props('items')).toEqual([])
  })

  it('muestra store.error en un p[role=alert] cuando falla la carga del dashboard', async () => {
    const builderCategorias = crearConstructorConsulta()
    const builderGastos = crearConstructorConsulta()
    fromMock.mockReturnValueOnce(builderCategorias).mockReturnValueOnce(builderGastos)
    ;(builderCategorias.order as Mock).mockResolvedValueOnce({ data: [], error: null })
    ;(builderGastos.order as Mock).mockResolvedValueOnce({ data: null, error: { message: 'boom' } })

    const wrapper = mount(DashboardView, { global: { plugins: [crearRouterDePrueba()] } })
    await flushPromises()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[role="alert"]').text()).toBe('No se pudieron cargar los datos del dashboard.')
  })

  it('Cambio 2: existe la sección "Tendencia diaria" con un GraficoTendenciaDiaria debajo de "Tendencia mensual"', async () => {
    prepararCargaInicial([categoriaComida], [gastoDe({ moneda: 'PEN', fecha: '2026-07-05', monto: 100 })])

    const wrapper = mount(DashboardView, { global: { plugins: [crearRouterDePrueba()] } })
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

    const wrapper = mount(DashboardView, { global: { plugins: [crearRouterDePrueba()] } })
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

    const wrapper = mount(DashboardView, { global: { plugins: [crearRouterDePrueba()] } })
    await flushPromises()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    const grafico = wrapper.findComponent({ name: 'GraficoTendenciaDiaria' })
    const datos = grafico.props('datos') as Array<{ dia: string; total: number }>
    expect(datos.every((d) => d.total === 0)).toBe(true)
  })

  it('Cambio 2: la tendencia diaria NO dispara un fetch adicional propio (reutiliza `filas`, ya cargada)', async () => {
    prepararCargaInicial([categoriaComida], [gastoDe({ moneda: 'PEN', fecha: '2026-07-05', monto: 100 })])

    mount(DashboardView, { global: { plugins: [crearRouterDePrueba()] } })
    await flushPromises()

    // La tendencia diaria es una agregación pura sobre `filas.value` (ya
    // cargada por `cargarDatosDashboard`): no agrega NINGUNA llamada a `from`
    // propia. Las 4 tablas de abajo son las del `onMounted` de "Dashboard"
    // (categorías, gastos, ingresos, presupuestos) + una segunda consulta a
    // 'gastos' de `cargarBorradores` (filtro distinto, ver siguiente test).
    const tablasConsultadas = fromMock.mock.calls.map(([tabla]) => tabla)
    expect(new Set(tablasConsultadas)).toEqual(new Set(['categorias', 'gastos', 'ingresos', 'presupuestos']))
  })

  it('Fase 1 "Caudal": onMounted también hidrata presupuestos (Épica 6) y borradores de bandeja (Épica 5)', async () => {
    prepararCargaInicial([categoriaComida], [gastoDe({ moneda: 'PEN', fecha: '2026-07-05', monto: 100 })])

    mount(DashboardView, { global: { plugins: [crearRouterDePrueba()] } })
    await flushPromises()

    expect(fromMock).toHaveBeenCalledWith('presupuestos')
    // 'gastos' se consulta DOS veces: `cargarDatosDashboard` (estado='confirmado')
    // y `cargarBorradores` (estado in borrador/revision_manual, vía `.in()`).
    const tablasConsultadas = fromMock.mock.calls.map(([tabla]) => tabla)
    expect(tablasConsultadas.filter((t) => t === 'gastos')).toHaveLength(2)
  })

  it('riesgo: las 4 llamadas de onMounted comparten `useGastosStore` sin await entre ellas; store.cargando NO debería volver a `false` mientras `cargarDatosDashboard` sigue en vuelo', async () => {
    // `cargarCategorias`, `cargarDatosDashboard`, `cargarPresupuestos` y
    // `cargarBorradores` reutilizan el MISMO `useGastosStore` (mismo
    // `store.cargando`/`store.error`) y ninguna se espera (`await`) antes de
    // disparar la siguiente. Cada una hace `establecerCargando(true)` al
    // entrar y `establecerCargando(false)` en su propio `finally`, sin saber
    // si las demás ya terminaron. Este test deja `cargarDatosDashboard`
    // (la consulta a 'gastos' con `estado='confirmado'`) colgada a propósito
    // mientras las otras tres se resuelven, para exponer si el flag
    // compartido se apaga de forma prematura.
    let resolverGastosConfirmados: (valor: { data: unknown[]; error: null }) => void = () => {}
    const promesaGastosConfirmados = new Promise<{ data: unknown[]; error: null }>((resolve) => {
      resolverGastosConfirmados = resolve
    })

    fromMock.mockImplementation((tabla: string) => {
      if (tabla === 'categorias') {
        const builder = crearConstructorConsulta()
        ;(builder.order as Mock).mockResolvedValue({ data: [categoriaComida], error: null })
        return builder
      }
      if (tabla === 'gastos') {
        const builder = crearConstructorConsulta()
        // Camino de `cargarDatosDashboard` (.eq('estado','confirmado')...order()): colgado.
        ;(builder.order as Mock).mockReturnValue(promesaGastosConfirmados)
        // Camino de `cargarBorradores` (.in(...)...order()): resuelve rápido.
        const builderBorradores = crearConstructorConsulta()
        ;(builderBorradores.order as Mock).mockResolvedValue({ data: [], error: null })
        ;(builder.in as Mock).mockReturnValue(builderBorradores)
        return builder
      }
      if (tabla === 'ingresos') {
        const builder = crearConstructorConsulta()
        ;(builder.order as Mock).mockResolvedValue({ data: [], error: null })
        return builder
      }
      if (tabla === 'presupuestos') {
        const builder = crearConstructorConsulta()
        ;(builder.eq as Mock).mockResolvedValue({ data: [], error: null })
        return builder
      }
      return crearConstructorConsulta()
    })

    const store = useGastosStore()
    mount(DashboardView, { global: { plugins: [crearRouterDePrueba()] } })
    await flushPromises()

    // `cargarCategorias`, `cargarPresupuestos` y `cargarBorradores` ya
    // terminaron (sus mocks resuelven al toque); `cargarDatosDashboard`
    // sigue colgada. El comportamiento esperado/seguro es que `store.cargando`
    // siga en `true` mientras ESA carga (parte del mismo `onMounted`) no
    // termine.
    expect(store.categorias).toEqual([categoriaComida])
    expect(store.cargando).toBe(true)

    resolverGastosConfirmados({ data: [], error: null })
    await flushPromises()
    expect(store.cargando).toBe(false)
  })

  it('Feed de movimientos: se renderizan TODOS los movimientos del mes (sin tope de 5), ordenados desc', async () => {
    prepararCargaInicial(
      [categoriaComida],
      [
        gastoDe({ id: 'g1', fecha: '2026-07-01' }),
        gastoDe({ id: 'g2', fecha: '2026-07-02' }),
        gastoDe({ id: 'g3', fecha: '2026-07-03' }),
        gastoDe({ id: 'g4', fecha: '2026-07-04' }),
      ],
      {
        ingresos: [
          ingresoDe({ id: 'i1', fecha: '2026-07-05' }),
          ingresoDe({ id: 'i2', fecha: '2026-07-06' }),
          ingresoDe({ id: 'i3', fecha: '2026-07-07' }),
        ],
      },
    )

    const wrapper = mount(DashboardView, { global: { plugins: [crearRouterDePrueba()] } })
    await flushPromises()
    await wrapper.vm.$nextTick()

    const feed = wrapper.findComponent({ name: 'FeedMovimientos' })
    expect(feed.exists()).toBe(true)
    const movimientos = feed.props('movimientos') as Array<{ id: string }>
    // 7 movimientos en total este mes: el feed NO recorta a 5 (a diferencia del viejo widget).
    expect(movimientos).toHaveLength(7)
    expect(movimientos.map((m) => m.id)).toEqual(['i3', 'i2', 'i1', 'g4', 'g3', 'g2', 'g1'])
  })

  it('Feed de movimientos: sin datos, muestra su propio estado vacío', async () => {
    prepararCargaInicial([], [])

    const wrapper = mount(DashboardView, { global: { plugins: [crearRouterDePrueba()] } })
    await flushPromises()
    await wrapper.vm.$nextTick()

    const feed = wrapper.findComponent({ name: 'FeedMovimientos' })
    expect(feed.props('movimientos')).toEqual([])
    expect(wrapper.text()).toContain('Ningún movimiento con estos filtros.')
  })

  it('Feed de movimientos: enriquece cada fila con el nombre de categoría (gasto) y de banco', async () => {
    const storeIngresos = useIngresosStore()
    storeIngresos.establecerBancos([bancoDe({ id: 'b1', nombre: 'BCP' })])

    prepararCargaInicial(
      [categoriaComida],
      [gastoDe({ id: 'g1', categoria_id: 'c1', banco_id: 'b1', descripcion: 'Almuerzo', fecha: '2026-07-05' })],
    )

    const wrapper = mount(DashboardView, { global: { plugins: [crearRouterDePrueba()] } })
    await flushPromises()
    await wrapper.vm.$nextTick()

    const feed = wrapper.findComponent({ name: 'FeedMovimientos' })
    const movimientos = feed.props('movimientos') as Array<{
      nombreCategoria: string | null
      nombreBanco: string
    }>
    expect(movimientos[0].nombreCategoria).toBe('Comida')
    expect(movimientos[0].nombreBanco).toBe('BCP')
  })

  it('Chips de filtro: cambiar a "Ingresos" deja solo ingresos en el feed', async () => {
    prepararCargaInicial([categoriaComida], [gastoDe({ id: 'g1', fecha: '2026-07-01' })], {
      ingresos: [ingresoDe({ id: 'i1', fecha: '2026-07-02' })],
    })

    const wrapper = mount(DashboardView, { global: { plugins: [crearRouterDePrueba()] } })
    await flushPromises()
    await wrapper.vm.$nextTick()

    expect(wrapper.findComponent({ name: 'FeedMovimientos' }).props('movimientos')).toHaveLength(2)

    await wrapper.findComponent({ name: 'ChipsFiltroTipo' }).vm.$emit('update:modelValue', 'ingresos')
    await wrapper.vm.$nextTick()

    const movimientos = wrapper.findComponent({ name: 'FeedMovimientos' }).props('movimientos') as Array<{
      id: string
    }>
    expect(movimientos.map((m) => m.id)).toEqual(['i1'])
  })

  it('riesgo: no reusa store.gastos preexistente (Historial) para sus cálculos', async () => {
    const store = useGastosStore()
    store.establecerGastos([gastoDe({ id: 'de-historial', moneda: 'PEN', fecha: '2026-07-01', monto: 99999 })])

    prepararCargaInicial([categoriaComida], [gastoDe({ id: 'del-dashboard', moneda: 'PEN', fecha: '2026-07-05', monto: 100 })])

    const wrapper = mount(DashboardView, { global: { plugins: [crearRouterDePrueba()] } })
    await flushPromises()
    await wrapper.vm.$nextTick()

    // Si hubiera reusado store.gastos, el total incluiría el 99999 "colado" de Historial.
    expect(kpiPorVariante(wrapper, 'egreso')?.props('monto')).toBe(100)
  })

  it('Encabezado: muestra el mes formateado "Julio 2026" y el subtítulo "día D de N · X cuentas"', async () => {
    const storeIngresos = useIngresosStore()
    storeIngresos.establecerBancos([bancoDe({ id: 'b1', nombre: 'BCP' }), bancoDe({ id: 'b2', nombre: 'BBVA' })])

    prepararCargaInicial([categoriaComida], [])

    const wrapper = mount(DashboardView, { global: { plugins: [crearRouterDePrueba()] } })
    await flushPromises()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('h1').text()).toBe('Julio 2026')
    expect(wrapper.find('.subtitulo-encabezado').text()).toBe('día 15 de 31 · 2 cuentas')
  })

  it('Encabezado: el ToggleMoneda del header muestra los símbolos de moneda ("S/ PEN"/"$ USD")', async () => {
    prepararCargaInicial([categoriaComida], [])

    const wrapper = mount(DashboardView, { global: { plugins: [crearRouterDePrueba()] } })
    await flushPromises()
    await wrapper.vm.$nextTick()

    const toggle = wrapper.findComponent({ name: 'ToggleMoneda' })
    expect(toggle.props('mostrarSimbolo')).toBe(true)
  })

  it('Encabezado: el botón "+ Registrar" llama a storeUi.abrirHojaAcciones() (GATE1-#2: mediado por el store, el shell monta la hoja)', async () => {
    prepararCargaInicial([categoriaComida], [])

    const wrapper = mount(DashboardView, { global: { plugins: [crearRouterDePrueba()] } })
    await flushPromises()
    await wrapper.vm.$nextTick()

    const storeUi = useUiStore()
    expect(storeUi.hojaAccionesAbierta).toBe(false)

    const boton = wrapper.find('.boton-registrar')
    expect(boton.text()).toBe('+ Registrar')
    await boton.trigger('click')

    expect(storeUi.hojaAccionesAbierta).toBe(true)
  })

  describe('Card "Bandeja de correo" (Fase 1 "Caudal": SIEMPRE visible)', () => {
    it('con borradores pendientes, muestra el conteo, el peek del primero y un botón que navega a bandeja', async () => {
      const router = crearRouterDePrueba()
      router.push('/dashboard')
      await router.isReady()

      prepararCargaInicial([categoriaComida], [], {
        borradores: [
          gastoDe({ id: 'b-1', estado: 'borrador', descripcion: 'Grifo Primax', monto: 45, moneda: 'PEN' }),
          gastoDe({ id: 'b-2', estado: 'borrador' }),
        ],
      })

      const wrapper = mount(DashboardView, { global: { plugins: [router] } })
      await flushPromises()
      await wrapper.vm.$nextTick()

      expect(fromMock).toHaveBeenCalledWith('gastos')
      const cardBandeja = wrapper.findComponent({ name: 'TarjetaBandejaResumen' })
      expect(cardBandeja.exists()).toBe(true)
      expect(cardBandeja.props('cantidad')).toBe(2)
      expect(cardBandeja.props('peek')).toMatchObject({ id: 'b-1', descripcion: 'Grifo Primax' })

      await cardBandeja.find('.boton-revisar-bandeja').trigger('click')
      await flushPromises()

      expect(router.currentRoute.value.name).toBe('bandeja')
    })

    it('sin borradores pendientes, la card SIGUE visible con el blurb "todo al día" (ya no se oculta)', async () => {
      prepararCargaInicial([categoriaComida], [], { borradores: [] })

      const wrapper = mount(DashboardView, { global: { plugins: [crearRouterDePrueba()] } })
      await flushPromises()
      await wrapper.vm.$nextTick()

      const cardBandeja = wrapper.findComponent({ name: 'TarjetaBandejaResumen' })
      expect(cardBandeja.exists()).toBe(true)
      expect(cardBandeja.props('cantidad')).toBe(0)
      expect(cardBandeja.props('peek')).toBe(null)
      expect(wrapper.text()).toContain('Todo al día')
    })
  })

  it('Saldo por cuenta: sin bancos BCP/IBK creados, muestra el mensaje vacío (sin datos inventados)', async () => {
    prepararCargaInicial([categoriaComida], [])

    const wrapper = mount(DashboardView, { global: { plugins: [crearRouterDePrueba()] } })
    await flushPromises()
    await wrapper.vm.$nextTick()

    const tarjeta = wrapper.findComponent({ name: 'TarjetaSaldosPorCuenta' })
    expect(tarjeta.exists()).toBe(true)
    expect(tarjeta.props('cuentas')).toEqual([])
    expect(wrapper.text()).toContain('Aún no tienes las cuentas BCP o IBK')
  })

  it('Saldo por cuenta: con BCP e IBK creados y movimientos reales, calcula ingresos - gastos por banco', async () => {
    const storeIngresos = useIngresosStore()
    storeIngresos.establecerBancos([
      bancoDe({ id: 'b1', nombre: 'BCP Debito' }),
      bancoDe({ id: 'b2', nombre: 'IBK Debito' }),
    ])
    prepararCargaInicial(
      [categoriaComida],
      [
        gastoDe({ banco_id: 'b1', moneda: 'PEN', fecha: '2026-07-05', monto: 200 }),
        gastoDe({ banco_id: 'b2', moneda: 'PEN', fecha: '2026-07-05', monto: 30 }),
      ],
      { ingresos: [ingresoDe({ banco_id: 'b1', moneda: 'PEN', fecha: '2026-07-01', importe: 1000 })] },
    )

    const wrapper = mount(DashboardView, { global: { plugins: [crearRouterDePrueba()] } })
    await flushPromises()
    await wrapper.vm.$nextTick()

    const tarjeta = wrapper.findComponent({ name: 'TarjetaSaldosPorCuenta' })
    const cuentas = tarjeta.props('cuentas') as Array<{ bancoId: string; saldoPen: number }>
    expect(cuentas.find((c) => c.bancoId === 'b1')?.saldoPen).toBe(800)
    expect(cuentas.find((c) => c.bancoId === 'b2')?.saldoPen).toBe(-30)
  })

  it('Presupuesto: TarjetaPresupuestoResumen recibe el límite real (hidratado por `cargarPresupuestos` en onMounted), el gastado del mes, la proyección y el top-3 de categorías', async () => {
    const presupuestos: Presupuesto[] = [
      { id: 'p1', usuario_id: 'u1', categoria_id: 'c1', mes: '2026-07-01', moneda: 'PEN', monto_limite: 500, creado_en: '' },
      { id: 'p2', usuario_id: 'u1', categoria_id: 'c2', mes: '2026-07-01', moneda: 'PEN', monto_limite: 400, creado_en: '' },
      { id: 'p3', usuario_id: 'u1', categoria_id: 'c1', mes: '2026-07-01', moneda: 'USD', monto_limite: 999, creado_en: '' },
    ]

    prepararCargaInicial(
      [categoriaComida, categoriaTransporte],
      [
        gastoDe({ categoria_id: 'c1', moneda: 'PEN', fecha: '2026-07-05', monto: 300 }),
        gastoDe({ categoria_id: 'c2', moneda: 'PEN', fecha: '2026-07-06', monto: 120 }),
      ],
      { presupuestos },
    )

    const wrapper = mount(DashboardView, { global: { plugins: [crearRouterDePrueba()] } })
    await flushPromises()
    await wrapper.vm.$nextTick()

    expect(fromMock).toHaveBeenCalledWith('presupuestos')
    const presupuesto = wrapper.findComponent({ name: 'TarjetaPresupuestoResumen' })
    expect(presupuesto.props('gastado')).toBe(420) // 300 + 120 (PEN)
    expect(presupuesto.props('limite')).toBe(900) // 500 + 400 (PEN); excluye el de USD
    expect(presupuesto.props('proyeccion')).toBeCloseTo((420 / 15) * 31, 5) // día 15 de 31 (system time fijo)
    expect(presupuesto.props('topCategorias')).toEqual([
      { nombre: 'Comida', total: 300 },
      { nombre: 'Transporte', total: 120 },
    ])
  })

  it('Presupuesto: sin presupuestos configurados (fetch en 0 filas), el límite queda en 0 sin dividir por cero', async () => {
    prepararCargaInicial([categoriaComida], [gastoDe({ moneda: 'PEN', fecha: '2026-07-05', monto: 300 })], {
      presupuestos: [],
    })

    const wrapper = mount(DashboardView, { global: { plugins: [crearRouterDePrueba()] } })
    await flushPromises()
    await wrapper.vm.$nextTick()

    const presupuesto = wrapper.findComponent({ name: 'TarjetaPresupuestoResumen' })
    expect(presupuesto.props('limite')).toBe(0)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('El ToggleMoneda del header gobierna también los KPIs y el feed (cambiar a USD refleja montos USD)', async () => {
    prepararCargaInicial([categoriaComida], [
      gastoDe({ id: 'g-pen', moneda: 'PEN', fecha: '2026-07-05', monto: 100 }),
      gastoDe({ id: 'g-usd', moneda: 'USD', fecha: '2026-07-06', monto: 70 }),
    ])

    const wrapper = mount(DashboardView, { global: { plugins: [crearRouterDePrueba()] } })
    await flushPromises()
    await wrapper.vm.$nextTick()

    expect(kpiPorVariante(wrapper, 'egreso')?.props('monto')).toBe(100)
    expect(wrapper.findComponent({ name: 'FeedMovimientos' }).props('movimientos')).toHaveLength(1)

    await wrapper.findComponent({ name: 'ToggleMoneda' }).vm.$emit('update:modelValue', 'USD')
    await wrapper.vm.$nextTick()

    const kpiEgreso = kpiPorVariante(wrapper, 'egreso')
    expect(kpiEgreso?.props('moneda')).toBe('USD')
    expect(kpiEgreso?.props('monto')).toBe(70)
    const feedMovs = wrapper.findComponent({ name: 'FeedMovimientos' }).props('movimientos') as Array<{
      id: string
    }>
    expect(feedMovs.map((m) => m.id)).toEqual(['g-usd'])
  })
})
