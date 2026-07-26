import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import IngresosView from '@/views/IngresosView.vue'
import { supabase } from '@/lib/supabaseClient'
import { crearConstructorConsulta } from '@/lib/__mocks__/supabaseClient'
import type { Categoria } from '@/types/gasto'
import type { Banco, Ingreso } from '@/types/ingreso'

const fromMock = supabase.from as unknown as Mock

/**
 * Pruebas de integración de `IngresosView` (rediseño "Caudal", Fase 2:
 * `TablaMovimientos` + 3 `TarjetaKpi` + sidebar "Por categoría", en vez de la
 * lista-de-tarjetas agrupada por día y el desglose `saldosPorBanco`/"sin
 * banco asignado" de la Fase 1 — ver "Sugerencias fuera de alcance" del
 * micro-plan). Espejo de `HistorialView.integracion.spec.ts`, con categoría
 * propia de Ingreso (Épica 12, migración 008) en vez de "sin ese concepto".
 * No repite lo que ya cubren `FiltrosIngresos.spec.ts` (emisión aislada),
 * `TablaMovimientos.spec.ts` (presentacional) ni `useMoneda.spec.ts`
 * (`totalesPorCategoria` puro).
 */
const categoriaSueldo: Categoria = {
  id: 'ci1',
  usuario_id: 'u1',
  nombre: 'Sueldo',
  tipo: 'ingreso',
  predefinida: true,
  activa: true,
  creado_en: '',
  abreviatura: 'S',
}
const categoriaFreelance: Categoria = {
  id: 'ci2',
  usuario_id: 'u1',
  nombre: 'Freelance',
  tipo: 'ingreso',
  predefinida: false,
  activa: true,
  creado_en: '',
  abreviatura: 'F',
}
const categoriaGastoComida: Categoria = {
  id: 'c1',
  usuario_id: 'u1',
  nombre: 'Comida',
  tipo: 'gasto',
  predefinida: true,
  activa: true,
  creado_en: '',
  abreviatura: 'C',
}
const categoriasFalsas: Categoria[] = [categoriaSueldo, categoriaFreelance, categoriaGastoComida]

const bancoBcp: Banco = { id: 'b1', usuario_id: 'u1', nombre: 'BCP', created_at: '' }
const bancoInterbank: Banco = { id: 'b2', usuario_id: 'u1', nombre: 'Interbank', created_at: '' }
const bancosFalsos = [bancoBcp, bancoInterbank]

const ingresoSueldo: Ingreso = {
  id: 'i1',
  usuario_id: 'u1',
  banco_id: 'b1',
  categoria_id: 'ci1',
  fecha: '2026-07-10',
  moneda: 'PEN',
  importe: 100,
  concepto: 'Sueldo',
  created_at: '',
}
const ingresoFreelance: Ingreso = {
  id: 'i2',
  usuario_id: 'u1',
  banco_id: 'b2',
  categoria_id: 'ci2',
  fecha: '2026-07-15',
  moneda: 'USD',
  importe: 20,
  concepto: 'Freelance',
  created_at: '',
}
const ingresoReembolso: Ingreso = {
  id: 'i3',
  usuario_id: 'u1',
  banco_id: 'b1',
  categoria_id: 'ci1',
  fecha: '2026-06-01',
  moneda: 'PEN',
  importe: 30,
  concepto: 'Reembolso',
  created_at: '',
}
const ingresosFalsos: Ingreso[] = [ingresoSueldo, ingresoFreelance, ingresoReembolso]

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

/** Configura `supabase.from()` para devolver los fixtures dados en `onMounted`. */
function mockearCargaInicial(
  opciones: { categorias?: Categoria[]; bancos?: Banco[]; ingresos?: Ingreso[] } = {},
) {
  const { categorias = categoriasFalsas, bancos = bancosFalsos, ingresos = ingresosFalsos } = opciones
  fromMock.mockImplementation((tabla: string) => {
    const builder = crearConstructorConsulta()
    if (tabla === 'ingresos') {
      ;(builder.order as Mock).mockResolvedValue({ data: ingresos, error: null })
    } else if (tabla === 'bancos') {
      ;(builder.order as Mock).mockResolvedValue({ data: bancos, error: null })
    } else {
      ;(builder.order as Mock).mockResolvedValue({ data: categorias, error: null })
    }
    return builder
  })
}

describe('IngresosView — tabla, filtros y stat cards (rediseño "Caudal", Fase 2)', () => {
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
    const wrapper = mount(IngresosView)
    await flushPromises()

    const select = wrapper.find('select[aria-label="Filtrar por mes"]')
    expect((select.element as HTMLSelectElement).value).toBe('2026-07')

    const filas = wrapper.findAll('tbody tr')
    expect(filas).toHaveLength(2) // Sueldo y Freelance (julio); Reembolso (junio) queda fuera por defecto
    expect(wrapper.text()).toContain('Sueldo')
    expect(wrapper.text()).toContain('Freelance')
    expect(wrapper.text()).not.toContain('Reembolso')
  })

  it('elegir "Todos los meses" muestra los 3 ingresos', async () => {
    const wrapper = mount(IngresosView)
    await flushPromises()

    await wrapper.find('select[aria-label="Filtrar por mes"]').setValue('')

    expect(wrapper.findAll('tbody tr')).toHaveLength(3)
    expect(wrapper.text()).toContain('Reembolso')
  })

  it('filtro por banco: elegir "Interbank" deja solo sus ingresos', async () => {
    const wrapper = mount(IngresosView)
    await flushPromises()

    await wrapper.find('select[aria-label="Filtrar por banco"]').setValue('b2')

    const filas = wrapper.findAll('tbody tr')
    expect(filas).toHaveLength(1)
    expect(filas[0].text()).toContain('Freelance')
  })

  it('filtro por categoría: elegir "Sueldo" deja solo los ingresos de esa categoría (julio: solo el propio "Sueldo")', async () => {
    const wrapper = mount(IngresosView)
    await flushPromises()

    await wrapper.find('select[aria-label="Filtrar por categoría"]').setValue('ci1')

    const filas = wrapper.findAll('tbody tr')
    expect(filas).toHaveLength(1)
    expect(filas[0].text()).toContain('Sueldo')
  })

  it('buscador de texto libre: escribir "free" deja solo "Freelance" (case-insensitive)', async () => {
    const wrapper = mount(IngresosView)
    await flushPromises()

    await wrapper.find('input[aria-label="Buscar por concepto"]').setValue('FREE')

    const filas = wrapper.findAll('tbody tr')
    expect(filas).toHaveLength(1)
    expect(filas[0].text()).toContain('Freelance')
  })

  it('filtros combinables: moneda + banco + mes aplican la intersección de los tres', async () => {
    const wrapper = mount(IngresosView)
    await flushPromises()

    await wrapper.find('select[aria-label="Filtrar por mes"]').setValue('')
    await wrapper.findAll('.chip-moneda').find((c) => c.text() === 'S/ Soles')!.trigger('click')
    await wrapper.find('select[aria-label="Filtrar por banco"]').setValue('b1')

    // "Sueldo" y "Reembolso" son PEN + banco BCP; sin el filtro de mes, ambos cumplen.
    const filas = wrapper.findAll('tbody tr')
    expect(filas).toHaveLength(2)
    const textoFilas = filas.map((f) => f.text()).join(' ')
    expect(textoFilas).toContain('Sueldo')
    expect(textoFilas).toContain('Reembolso')
    expect(textoFilas).not.toContain('Freelance')
  })

  it('blindaje Fase 2 "Caudal" (GATE 1): el select de categoría solo ofrece categorías de tipo "ingreso", nunca "Comida" (gasto)', async () => {
    const wrapper = mount(IngresosView)
    await flushPromises()

    const opciones = wrapper.findAll('select[aria-label="Filtrar por categoría"] option')
    expect(opciones.map((o) => o.text())).not.toContain('Comida')
    expect(opciones.map((o) => o.text())).toContain('Sueldo')
  })

  it('estado vacío genérico: sin ningún ingreso, se muestra el mensaje genérico con CTA "Nuevo ingreso" y no se muestran filtros', async () => {
    mockearCargaInicial({ ingresos: [] })
    const wrapper = mount(IngresosView)
    await flushPromises()

    expect(wrapper.find('.estado-vacio-generico').exists()).toBe(true)
    expect(wrapper.find('.estado-vacio-filtro').exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'FiltrosIngresos' }).exists()).toBe(false)
  })

  it('estado vacío por filtro: hay ingresos en total, pero el filtro activo no encuentra ninguno', async () => {
    const wrapper = mount(IngresosView)
    await flushPromises()

    // Julio (mes por defecto) + banco Interbank + moneda "S/ Soles": Freelance es USD, ninguna fila cumple ambas.
    await wrapper.findAll('.chip-moneda').find((c) => c.text() === 'S/ Soles')!.trigger('click')
    await wrapper.find('select[aria-label="Filtrar por banco"]').setValue('b2')

    expect(wrapper.findAll('tbody tr')).toHaveLength(0)
    expect(wrapper.find('.estado-vacio-filtro').exists()).toBe(true)
    expect(wrapper.find('.estado-vacio-generico').exists()).toBe(false)
    expect(wrapper.text()).toContain('Sin ingresos con este filtro')
  })

  it('subtítulo del encabezado: "N movimientos en Julio 2026 · S/ X + $ Y"', async () => {
    const wrapper = mount(IngresosView)
    await flushPromises()

    const subtitulo = wrapper.find('.subtitulo-encabezado').text()
    expect(subtitulo).toContain('2 movimientos en Julio 2026')
    expect(subtitulo).toContain('100.00')
    expect(subtitulo).toContain('20.00')
  })

  it('3 stat cards (moneda PEN, mes actual): Total del mes y Mayor ingreso reflejan solo a "Sueldo" (el único ingreso PEN de julio)', async () => {
    const wrapper = mount(IngresosView)
    await flushPromises()

    const kpis = wrapper.findAllComponents({ name: 'TarjetaKpi' })
    expect(kpis).toHaveLength(3)

    const total = kpis.find((k) => k.props('label') === 'Total del mes')!
    const mayor = kpis.find((k) => k.props('label') === 'Mayor ingreso')!

    expect(total.props('monto')).toBe(100)
    expect(mayor.props('monto')).toBe(100)
    expect(mayor.props('subtitulo')).toBe('Sueldo')
  })

  it('"En dólares" siempre refleja el total USD del mes, independiente de la moneda seleccionada en el toggle', async () => {
    const wrapper = mount(IngresosView)
    await flushPromises()

    const kpis = wrapper.findAllComponents({ name: 'TarjetaKpi' })
    const enDolares = kpis.find((k) => k.props('label') === 'En dólares')!
    expect(enDolares.props('monto')).toBe(20)
    expect(enDolares.props('moneda')).toBe('USD')

    await wrapper.findComponent({ name: 'ToggleMoneda' }).vm.$emit('update:modelValue', 'USD')
    await wrapper.vm.$nextTick()

    const kpisTrasCambio = wrapper.findAllComponents({ name: 'TarjetaKpi' })
    expect(kpisTrasCambio.find((k) => k.props('label') === 'En dólares')!.props('monto')).toBe(20)
  })

  it('"Por categoría" (moneda PEN, mes actual): solo "Sueldo" aparece, con su total', async () => {
    const wrapper = mount(IngresosView)
    await flushPromises()

    const lista = wrapper.findComponent({ name: 'ListaGastoPorCategoria' })
    expect(lista.props('items')).toEqual([{ categoria_id: 'ci1', nombre: 'Sueldo', total: 100 }])
  })

  it('HU-18.1: dos ingresos del mismo día, distinto `created_at` — la tabla los pinta en el orden ya devuelto por la query (el registrado más reciente primero, no reordenados por fecha/id)', async () => {
    // Mismo razonamiento que su espejo en `HistorialView.integracion.spec.ts`:
    // `cargarIngresos` ordena por `created_at` desc en Supabase; el mock de
    // `.order()` no reordena, así que el array pasado ya representa el orden
    // real de la BD. Se verifica que la vista no lo altera.
    const ingresoRegistradoTarde: Ingreso = {
      ...ingresoSueldo,
      id: 'i-tarde',
      fecha: '2026-07-12',
      concepto: 'Registrado más tarde',
      created_at: '2026-07-12T20:00:00.000Z',
    }
    const ingresoRegistradoTemprano: Ingreso = {
      ...ingresoSueldo,
      id: 'i-temprano',
      fecha: '2026-07-12',
      concepto: 'Registrado más temprano',
      created_at: '2026-07-12T08:00:00.000Z',
    }
    mockearCargaInicial({ ingresos: [ingresoRegistradoTarde, ingresoRegistradoTemprano] })

    const wrapper = mount(IngresosView)
    await flushPromises()

    const filas = wrapper.findAll('tbody tr')
    expect(filas).toHaveLength(2)
    expect(filas[0].text()).toContain('Registrado más tarde')
    expect(filas[1].text()).toContain('Registrado más temprano')
  })

  it('borde: 0 movimientos en la moneda seleccionada no produce NaN en "Mayor ingreso"', async () => {
    const wrapper = mount(IngresosView)
    await flushPromises()

    // Junio solo tiene "Reembolso" (PEN); cambiar el toggle del encabezado a USD deja 0 movimientos ese mes.
    await wrapper.find('select[aria-label="Filtrar por mes"]').setValue('2026-06')
    await wrapper.findComponent({ name: 'ToggleMoneda' }).vm.$emit('update:modelValue', 'USD')
    await wrapper.vm.$nextTick()

    const mayor = wrapper.findAllComponents({ name: 'TarjetaKpi' }).find((k) => k.props('label') === 'Mayor ingreso')!
    expect(mayor.props('monto')).toBe(0)
    expect(Number.isNaN(mayor.props('monto'))).toBe(false)
  })
})
