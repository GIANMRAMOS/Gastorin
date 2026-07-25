import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import HistorialView from '@/views/HistorialView.vue'
import { useGastosStore } from '@/stores/gastos'
import { supabase } from '@/lib/supabaseClient'
import { crearConstructorConsulta } from '@/lib/__mocks__/supabaseClient'
import type { Categoria, Gasto } from '@/types/gasto'
import type { Banco } from '@/types/ingreso'

const fromMock = supabase.from as unknown as Mock

/**
 * Pruebas de integración de `HistorialView` (rediseño "Caudal", Fase 2:
 * `TablaMovimientos` + 3 `TarjetaKpi` + sidebar "Por categoría", en vez de la
 * lista-de-tarjetas agrupada por día de la Fase 1). No repite lo que ya
 * cubren `TablaMovimientos.spec.ts` (presentacional aislado),
 * `FiltrosHistorial.spec.ts` (emisión aislada) ni `useMoneda.spec.ts`
 * (`totalesPorCategoria` puro); aquí se verifica que la vista conecta todo
 * correctamente con `store.gastos`/`store.categorias`.
 *
 * La fecha del sistema se fija en 15 jul 2026: el selector de mes arranca en
 * "Julio 2026" (mes actual), determinismo necesario para las 3 stat cards y
 * el subtítulo del encabezado.
 */
const categoriaOcio: Categoria = {
  id: 'ocio',
  usuario_id: 'u1',
  nombre: 'Ocio',
  tipo: 'gasto',
  predefinida: true,
  activa: true,
  creado_en: '',
  abreviatura: 'O',
}
const categoriaOtro: Categoria = {
  id: 'otro',
  usuario_id: 'u1',
  nombre: 'Otro',
  tipo: 'gasto',
  predefinida: true,
  activa: true,
  creado_en: '',
  abreviatura: 'O',
}
const categoriaTransporte: Categoria = {
  id: 'transporte',
  usuario_id: 'u1',
  nombre: 'Transporte',
  tipo: 'gasto',
  predefinida: true,
  activa: true,
  creado_en: '',
  abreviatura: 'T',
}
const categoriaIngresoOtros: Categoria = {
  id: 'ci1',
  usuario_id: 'u1',
  nombre: 'Otros ingresos',
  tipo: 'ingreso',
  predefinida: true,
  activa: true,
  creado_en: '',
  abreviatura: 'O',
}
const categoriasFalsas: Categoria[] = [categoriaOcio, categoriaOtro, categoriaTransporte, categoriaIngresoOtros]

const bancoFalso: Banco = { id: 'b1', usuario_id: 'u1', nombre: 'BCP', created_at: '' }

const gastoCine: Gasto = {
  id: 'g1',
  usuario_id: 'u1',
  categoria_id: 'ocio',
  banco_id: 'b1',
  monto: 25.5,
  moneda: 'PEN',
  fecha: '2026-07-10',
  descripcion: 'Cine',
  origen: 'manual',
  estado: 'confirmado',
  gmail_message_id: null,
  gmail_fragmento: null,
  creado_en: '',
  actualizado_en: '',
}
const gastoVarios: Gasto = {
  ...gastoCine,
  id: 'g2',
  categoria_id: 'otro',
  monto: 12,
  moneda: 'USD',
  fecha: '2026-07-15',
  descripcion: 'Varios',
}
const gastoTaxi: Gasto = {
  ...gastoCine,
  id: 'g3',
  categoria_id: 'transporte',
  monto: 8,
  moneda: 'PEN',
  fecha: '2026-06-01',
  descripcion: 'Taxi',
}
const gastosFalsos: Gasto[] = [gastoCine, gastoVarios, gastoTaxi]

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

/** Configura `supabase.from()` para devolver los fixtures dados en `onMounted`. */
function mockearCargaInicial(
  opciones: { categorias?: Categoria[]; bancos?: Banco[]; gastos?: Gasto[] } = {},
) {
  const { categorias = categoriasFalsas, bancos = [bancoFalso], gastos = gastosFalsos } = opciones
  fromMock.mockImplementation((tabla: string) => {
    const builder = crearConstructorConsulta()
    if (tabla === 'gastos') {
      ;(builder.order as Mock).mockResolvedValue({ data: gastos, error: null })
    } else if (tabla === 'bancos') {
      ;(builder.order as Mock).mockResolvedValue({ data: bancos, error: null })
    } else {
      ;(builder.order as Mock).mockResolvedValue({ data: categorias, error: null })
    }
    return builder
  })
}

describe('HistorialView — tabla, filtros y stat cards (rediseño "Caudal", Fase 2)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 6, 15)) // 15 jul 2026: "mes actual" = Julio 2026
    mockearCargaInicial()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('camino feliz: el selector de mes arranca en el mes actual y la tabla solo lista los movimientos de ese mes', async () => {
    const wrapper = mount(HistorialView)
    await flushPromises()

    const select = wrapper.find('select[aria-label="Filtrar por mes"]')
    expect((select.element as HTMLSelectElement).value).toBe('2026-07')

    const filas = wrapper.findAll('tbody tr')
    expect(filas).toHaveLength(2) // Cine y Varios (julio); Taxi (junio) queda fuera por defecto
    expect(wrapper.text()).toContain('Cine')
    expect(wrapper.text()).toContain('Varios')
    expect(wrapper.text()).not.toContain('Taxi')
  })

  it('elegir "Todos los meses" muestra los 3 gastos', async () => {
    const wrapper = mount(HistorialView)
    await flushPromises()

    await wrapper.find('select[aria-label="Filtrar por mes"]').setValue('')

    expect(wrapper.findAll('tbody tr')).toHaveLength(3)
    expect(wrapper.text()).toContain('Taxi')
  })

  it('filtro por mes: elegir "2026-06" deja solo el gasto de ese mes', async () => {
    const wrapper = mount(HistorialView)
    await flushPromises()

    await wrapper.find('select[aria-label="Filtrar por mes"]').setValue('2026-06')

    const filas = wrapper.findAll('tbody tr')
    expect(filas).toHaveLength(1)
    expect(filas[0].text()).toContain('Taxi')
  })

  it('filtro por chip de moneda + "Todos los meses": "S/ Soles" deja solo Cine y Taxi (PEN)', async () => {
    const wrapper = mount(HistorialView)
    await flushPromises()

    await wrapper.find('select[aria-label="Filtrar por mes"]').setValue('')
    await wrapper.findAll('.chip-moneda').find((c) => c.text() === 'S/ Soles')!.trigger('click')

    const filas = wrapper.findAll('tbody tr')
    expect(filas).toHaveLength(2)
    expect(wrapper.text()).toContain('Cine')
    expect(wrapper.text()).toContain('Taxi')
    expect(wrapper.text()).not.toContain('Varios')
  })

  it('filtro por categoría: elegir "Ocio" deja solo el gasto de esa categoría', async () => {
    const wrapper = mount(HistorialView)
    await flushPromises()

    await wrapper.find('select[aria-label="Filtrar por mes"]').setValue('')
    await wrapper.find('select[aria-label="Filtrar por categoría"]').setValue('ocio')

    const filas = wrapper.findAll('tbody tr')
    expect(filas).toHaveLength(1)
    expect(filas[0].text()).toContain('Cine')
  })

  it('buscador de texto libre: escribir "cine" deja solo ese gasto (case-insensitive)', async () => {
    const wrapper = mount(HistorialView)
    await flushPromises()

    await wrapper.find('select[aria-label="Filtrar por mes"]').setValue('')
    await wrapper.find('input[aria-label="Buscar por descripción"]').setValue('CINE')

    const filas = wrapper.findAll('tbody tr')
    expect(filas).toHaveLength(1)
    expect(filas[0].text()).toContain('Cine')
  })

  it('filtros combinables (mes por defecto = julio) + moneda "$ Dólares": solo Varios cumple ambas condiciones', async () => {
    const wrapper = mount(HistorialView)
    await flushPromises()

    await wrapper.findAll('.chip-moneda').find((c) => c.text() === '$ Dólares')!.trigger('click')

    const filas = wrapper.findAll('tbody tr')
    expect(filas).toHaveLength(1)
    expect(filas[0].text()).toContain('Varios')
  })

  it('blindaje Fase 2 "Caudal" (GATE 1): el select de categoría solo ofrece categorías de tipo "gasto", nunca "Otros ingresos"', async () => {
    const wrapper = mount(HistorialView)
    await flushPromises()

    const opciones = wrapper.findAll('select[aria-label="Filtrar por categoría"] option')
    expect(opciones.map((o) => o.text())).not.toContain('Otros ingresos')
  })

  it('estado vacío genérico: sin ningún gasto, se muestra el mensaje genérico con CTA "Nuevo gasto" que abre el modal de alta, y no se muestran filtros', async () => {
    mockearCargaInicial({ gastos: [] })
    const wrapper = mount(HistorialView)
    await flushPromises()

    expect(wrapper.find('.estado-vacio-generico').exists()).toBe(true)
    expect(wrapper.find('.estado-vacio-filtro').exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'FiltrosHistorial' }).exists()).toBe(false)

    const cta = wrapper.find('.estado-vacio-generico button')
    expect(cta.text()).toBe('Nuevo gasto')
    await cta.trigger('click')

    expect(wrapper.find('[role="dialog"] h2').text()).toBe('Nuevo gasto')
  })

  it('estado vacío por filtro: hay gastos en total, pero el filtro activo no encuentra ninguno', async () => {
    const wrapper = mount(HistorialView)
    await flushPromises()

    // Julio (mes por defecto) + categoría "Transporte" (Taxi es de junio): ninguna fila cumple ambas.
    await wrapper.find('select[aria-label="Filtrar por categoría"]').setValue('transporte')

    expect(wrapper.findAll('tbody tr')).toHaveLength(0)
    expect(wrapper.find('.estado-vacio-filtro').exists()).toBe(true)
    expect(wrapper.find('.estado-vacio-generico').exists()).toBe(false)
    expect(wrapper.text()).toContain('Sin gastos con este filtro')
    expect(wrapper.text()).toContain('Prueba cambiar el filtro o registra el primer gasto del mes.')
  })

  it('subtítulo del encabezado: "N movimientos en Julio 2026 · S/ X + $ Y"', async () => {
    const wrapper = mount(HistorialView)
    await flushPromises()

    const subtitulo = wrapper.find('.subtitulo-encabezado').text()
    expect(subtitulo).toContain('2 movimientos en Julio 2026')
    expect(subtitulo).toContain('25.50')
    expect(subtitulo).toContain('12.00')
  })

  it('3 stat cards (moneda PEN, mes actual): Total del mes, Ticket promedio y Mayor gasto reflejan solo a Cine (el único gasto PEN de julio)', async () => {
    const wrapper = mount(HistorialView)
    await flushPromises()

    const kpis = wrapper.findAllComponents({ name: 'TarjetaKpi' })
    expect(kpis).toHaveLength(3)

    const total = kpis.find((k) => k.props('label') === 'Total del mes')!
    const promedio = kpis.find((k) => k.props('label') === 'Ticket promedio')!
    const mayor = kpis.find((k) => k.props('label') === 'Mayor gasto')!

    expect(total.props('monto')).toBe(25.5)
    expect(promedio.props('monto')).toBe(25.5)
    expect(mayor.props('monto')).toBe(25.5)
    expect(mayor.props('subtitulo')).toBe('Cine')
  })

  it('cambiar el toggle de moneda del encabezado a USD recalcula las 3 stat cards y el "por categoría", sin afectar la tabla filtrada por los chips', async () => {
    const wrapper = mount(HistorialView)
    await flushPromises()

    await wrapper.findComponent({ name: 'ToggleMoneda' }).vm.$emit('update:modelValue', 'USD')
    await wrapper.vm.$nextTick()

    const kpis = wrapper.findAllComponents({ name: 'TarjetaKpi' })
    const total = kpis.find((k) => k.props('label') === 'Total del mes')!
    expect(total.props('monto')).toBe(12)
    expect(total.props('moneda')).toBe('USD')

    const lista = wrapper.findComponent({ name: 'ListaGastoPorCategoria' })
    expect(lista.props('moneda')).toBe('USD')
    expect(lista.props('items')).toEqual([{ categoria_id: 'otro', nombre: 'Otro', total: 12 }])

    // La tabla (gobernada por los chips de la fila de filtros, no por el toggle) sigue mostrando ambos gastos de julio.
    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
  })

  it('"Por categoría" (moneda PEN, mes actual): solo Ocio aparece, con el total de Cine', async () => {
    const wrapper = mount(HistorialView)
    await flushPromises()

    const lista = wrapper.findComponent({ name: 'ListaGastoPorCategoria' })
    expect(lista.props('items')).toEqual([{ categoria_id: 'ocio', nombre: 'Ocio', total: 25.5 }])
  })

  it('borde: 0 movimientos en la moneda seleccionada no produce NaN en Ticket promedio ni en Mayor gasto', async () => {
    const wrapper = mount(HistorialView)
    await flushPromises()

    // Junio solo tiene a Taxi (PEN); cambiar el toggle del encabezado a USD deja 0 movimientos ese mes.
    await wrapper.find('select[aria-label="Filtrar por mes"]').setValue('2026-06')
    await wrapper.findComponent({ name: 'ToggleMoneda' }).vm.$emit('update:modelValue', 'USD')
    await wrapper.vm.$nextTick()

    const kpis = wrapper.findAllComponents({ name: 'TarjetaKpi' })
    const promedio = kpis.find((k) => k.props('label') === 'Ticket promedio')!
    const mayor = kpis.find((k) => k.props('label') === 'Mayor gasto')!
    expect(promedio.props('monto')).toBe(0)
    expect(mayor.props('monto')).toBe(0)
    expect(Number.isNaN(promedio.props('monto'))).toBe(false)
  })
})

describe('HistorialView — cruce con Épica 4 (HU-4.3): categoría desactivada sigue resolviendo nombre en la tabla', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 4, 15)) // mayo 2026: el gasto histórico de este fixture es de mayo
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('un gasto que referencia una categoría desactivada sigue mostrando su nombre real (no "Sin categoría") tras cargar (simula recarga de página)', async () => {
    const categoriasConUnaInactiva: Categoria[] = [
      categoriaOcio,
      { ...categoriaTransporte, activa: false },
    ]

    const gastoHistoricoConCategoriaDesactivada: Gasto = {
      ...gastoTaxi,
      id: 'g-hist',
      fecha: '2026-05-01',
      descripcion: 'Taxi viejo',
    }

    mockearCargaInicial({
      categorias: categoriasConUnaInactiva,
      gastos: [gastoHistoricoConCategoriaDesactivada],
    })

    const wrapper = mount(HistorialView)
    await flushPromises()

    const store = useGastosStore()
    expect(store.categorias.find((c) => c.id === 'transporte')?.activa).toBe(false)

    const fila = wrapper.findAll('tbody tr').find((f) => f.text().includes('Taxi viejo'))!
    expect(fila).toBeDefined()
    expect(fila.text()).toContain('Transporte')
  })
})
