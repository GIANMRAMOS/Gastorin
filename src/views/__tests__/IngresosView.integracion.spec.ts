import { beforeEach, describe, expect, it, type Mock } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import IngresosView from '@/views/IngresosView.vue'
import { supabase } from '@/lib/supabaseClient'
import { crearConstructorConsulta } from '@/lib/__mocks__/supabaseClient'
import type { Banco, Ingreso } from '@/types/ingreso'

const fromMock = supabase.from as unknown as Mock

/**
 * Pruebas de integración de `IngresosView` para el nuevo filtro combinable
 * (moneda/banco/mes) y el totalizador de moneda predominante. Espejo de
 * `HistorialView.integracion.spec.ts`, sin categoría (Ingresos no tiene ese
 * concepto en el modelo de datos, ver `types/ingreso.ts`). No repite lo que
 * ya cubren `FiltrosIngresos.spec.ts` (emisión aislada del presentacional)
 * ni `IngresosView.spec.ts` (CRUD).
 */
const bancoBcp: Banco = { id: 'b1', usuario_id: 'u1', nombre: 'BCP', created_at: '' }
const bancoInterbank: Banco = { id: 'b2', usuario_id: 'u1', nombre: 'Interbank', created_at: '' }
const bancosFalsos = [bancoBcp, bancoInterbank]

const ingresosFalsos: Ingreso[] = [
  {
    id: 'i1',
    usuario_id: 'u1',
    banco_id: 'b1',
    fecha: '2026-07-10',
    moneda: 'PEN',
    importe: 100,
    concepto: 'Sueldo',
    created_at: '',
  },
  {
    id: 'i2',
    usuario_id: 'u1',
    banco_id: 'b2',
    fecha: '2026-07-15',
    moneda: 'USD',
    importe: 20,
    concepto: 'Freelance',
    created_at: '',
  },
  {
    id: 'i3',
    usuario_id: 'u1',
    banco_id: 'b1',
    fecha: '2026-06-01',
    moneda: 'PEN',
    importe: 30,
    concepto: 'Reembolso',
    created_at: '',
  },
]

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

/** Configura `supabase.from()` para devolver los fixtures dados en `onMounted`. */
function mockearCargaInicial(
  opciones: { ingresos?: Ingreso[]; bancos?: Banco[] } = {},
) {
  const { ingresos = ingresosFalsos, bancos = bancosFalsos } = opciones
  fromMock.mockImplementation((tabla: string) => {
    const builder = crearConstructorConsulta()
    if (tabla === 'ingresos') {
      ;(builder.order as Mock).mockResolvedValue({ data: ingresos, error: null })
    } else {
      ;(builder.order as Mock).mockResolvedValue({ data: bancos, error: null })
    }
    return builder
  })
}

describe('IngresosView — filtros combinables', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockearCargaInicial()
  })

  it('filtro por chip de moneda: "S/ Soles" deja solo ingresos en PEN y marca el chip activo', async () => {
    const wrapper = mount(IngresosView)
    await flushPromises()

    const chipSoles = wrapper.findAll('.chip-moneda').find((c) => c.text() === 'S/ Soles')!
    await chipSoles.trigger('click')

    expect(wrapper.findAll('.fila-ingreso')).toHaveLength(2) // Sueldo y Reembolso (PEN)
    expect(wrapper.text()).toContain('Sueldo')
    expect(wrapper.text()).toContain('Reembolso')
    expect(wrapper.text()).not.toContain('Freelance') // Freelance es USD

    expect(chipSoles.classes()).toContain('activo')
  })

  it('"Todos" restaura el listado completo tras haber activado "S/ Soles"', async () => {
    const wrapper = mount(IngresosView)
    await flushPromises()

    await wrapper.findAll('.chip-moneda').find((c) => c.text() === 'S/ Soles')!.trigger('click')
    expect(wrapper.findAll('.fila-ingreso')).toHaveLength(2)

    await wrapper.findAll('.chip-moneda').find((c) => c.text() === 'Todos')!.trigger('click')
    expect(wrapper.findAll('.fila-ingreso')).toHaveLength(3)
  })

  it('filtro por banco: elegir "Interbank" deja solo sus ingresos', async () => {
    const wrapper = mount(IngresosView)
    await flushPromises()

    const select = wrapper.find('select[aria-label="Filtrar por banco"]')
    await select.setValue('b2')

    expect(wrapper.findAll('.fila-ingreso')).toHaveLength(1)
    expect(wrapper.text()).toContain('Freelance')
  })

  it('filtro por mes: elegir "2026-06" deja solo los ingresos de ese mes; los meses salen del store', async () => {
    const wrapper = mount(IngresosView)
    await flushPromises()

    const select = wrapper.find('select[aria-label="Filtrar por mes"]')
    const opciones = select.findAll('option').map((o) => o.text())
    expect(opciones).toContain('2026-07')
    expect(opciones).toContain('2026-06')

    await select.setValue('2026-06')

    expect(wrapper.findAll('.fila-ingreso')).toHaveLength(1)
    expect(wrapper.text()).toContain('Reembolso')
  })

  it('filtros combinables: moneda + banco + mes aplican la intersección de los tres', async () => {
    const wrapper = mount(IngresosView)
    await flushPromises()

    await wrapper.findAll('.chip-moneda').find((c) => c.text() === 'S/ Soles')!.trigger('click')
    await wrapper.find('select[aria-label="Filtrar por banco"]').setValue('b1')
    await wrapper.find('select[aria-label="Filtrar por mes"]').setValue('2026-07')

    // Solo "Sueldo" (PEN, banco BCP, julio 2026) cumple las tres condiciones.
    expect(wrapper.findAll('.fila-ingreso')).toHaveLength(1)
    expect(wrapper.text()).toContain('Sueldo')
  })

  it('la vista de Ingresos NO tiene select de categoría (no existe ese concepto en el modelo)', async () => {
    const wrapper = mount(IngresosView)
    await flushPromises()

    expect(wrapper.find('select[aria-label="Filtrar por categoría"]').exists()).toBe(false)
  })
})

describe('IngresosView — doble estado vacío', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('sin ningún ingreso en absoluto: estado vacío genérico y sin componente de filtros', async () => {
    mockearCargaInicial({ ingresos: [] })
    const wrapper = mount(IngresosView)
    await flushPromises()

    expect(wrapper.find('.estado-vacio-generico').exists()).toBe(true)
    expect(wrapper.find('.estado-vacio-filtro').exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'FiltrosIngresos' }).exists()).toBe(false)
  })

  it('hay ingresos pero el filtro no encuentra ninguno: estado vacío específico, no el genérico', async () => {
    mockearCargaInicial()
    const wrapper = mount(IngresosView)
    await flushPromises()

    // "Freelance" (USD, banco Interbank) combinado con moneda "S/ Soles": ninguna fila cumple ambas.
    await wrapper.findAll('.chip-moneda').find((c) => c.text() === 'S/ Soles')!.trigger('click')
    await wrapper.find('select[aria-label="Filtrar por banco"]').setValue('b2')

    expect(wrapper.findAll('.fila-ingreso')).toHaveLength(0)
    expect(wrapper.find('.estado-vacio-filtro').exists()).toBe(true)
    expect(wrapper.find('.estado-vacio-generico').exists()).toBe(false)
    expect(wrapper.text()).toContain('Sin ingresos con este filtro')
  })
})

describe('IngresosView — totalizador de moneda predominante', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockearCargaInicial()
  })

  it('sin filtro (mezcla con mayoría PEN): el totalizador muestra el total en PEN de los PEN visibles', async () => {
    const wrapper = mount(IngresosView)
    await flushPromises()

    // 2 PEN (100 + 30 = 130) y 1 USD → predomina PEN.
    expect(wrapper.find('.resumen-totalizador').text()).toContain('S/')
    expect(wrapper.find('.resumen-totalizador').text()).toContain('130.00')
  })

  it('filtro moneda USD: el totalizador muestra el total en USD del subconjunto filtrado', async () => {
    const wrapper = mount(IngresosView)
    await flushPromises()

    await wrapper.findAll('.chip-moneda').find((c) => c.text() === '$ Dólares')!.trigger('click')

    expect(wrapper.find('.resumen-totalizador').text()).toContain('$')
    expect(wrapper.find('.resumen-totalizador').text()).toContain('20.00')
  })

  it('conjunto filtrado vacío: el totalizador no se renderiza (aparece el estado vacío por filtro en su lugar)', async () => {
    const wrapper = mount(IngresosView)
    await flushPromises()

    await wrapper.findAll('.chip-moneda').find((c) => c.text() === 'S/ Soles')!.trigger('click')
    await wrapper.find('select[aria-label="Filtrar por banco"]').setValue('b2')

    expect(wrapper.find('.resumen-totalizador').exists()).toBe(false)
    expect(wrapper.find('.estado-vacio-filtro').exists()).toBe(true)
  })

  it('el total se recalcula al cambiar el filtro', async () => {
    const wrapper = mount(IngresosView)
    await flushPromises()

    const totalInicial = wrapper.find('.resumen-totalizador').text()

    await wrapper.find('select[aria-label="Filtrar por mes"]').setValue('2026-06')

    const totalTrasFiltrar = wrapper.find('.resumen-totalizador').text()
    expect(totalTrasFiltrar).not.toBe(totalInicial)
    expect(totalTrasFiltrar).toContain('30.00')
  })
})

describe('IngresosView — desglose de saldos por banco', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockearCargaInicial()
  })

  it('camino feliz: sin filtro, lista los dos bancos con sus montos por moneda', async () => {
    const wrapper = mount(IngresosView)
    await flushPromises()

    const items = wrapper.findAll('.item-desglose-banco')
    expect(items).toHaveLength(2)

    const bcp = items.find((item) => item.text().includes('BCP'))!
    expect(bcp.text()).toContain('S/')
    expect(bcp.text()).toContain('130.00') // 100 (Sueldo) + 30 (Reembolso), ambos PEN

    const interbank = items.find((item) => item.text().includes('Interbank'))!
    expect(interbank.text()).toContain('$')
    expect(interbank.text()).toContain('20.00')
  })

  it('filtro por moneda USD: cada banco muestra solo su monto USD, desaparecen las claves PEN', async () => {
    const wrapper = mount(IngresosView)
    await flushPromises()

    await wrapper.findAll('.chip-moneda').find((c) => c.text() === '$ Dólares')!.trigger('click')

    const items = wrapper.findAll('.item-desglose-banco')
    expect(items).toHaveLength(1)
    expect(items[0].text()).toContain('Interbank')
    expect(items[0].text()).toContain('$')
    expect(items[0].text()).not.toContain('S/')
  })

  it('filtro por banco: seleccionar un banco concreto deja el desglose con esa única entrada', async () => {
    const wrapper = mount(IngresosView)
    await flushPromises()

    await wrapper.find('select[aria-label="Filtrar por banco"]').setValue('b2')

    const items = wrapper.findAll('.item-desglose-banco')
    expect(items).toHaveLength(1)
    expect(items[0].text()).toContain('Interbank')
  })

  it('filtro por mes: recalcula el desglose al subconjunto de ese mes', async () => {
    const wrapper = mount(IngresosView)
    await flushPromises()

    await wrapper.find('select[aria-label="Filtrar por mes"]').setValue('2026-06')

    const items = wrapper.findAll('.item-desglose-banco')
    expect(items).toHaveLength(1)
    expect(items[0].text()).toContain('BCP')
    expect(items[0].text()).toContain('30.00')
  })

  it('borde: filtro sin resultados deja el desglose vacío/oculto, sin romper el estado vacío por filtro', async () => {
    const wrapper = mount(IngresosView)
    await flushPromises()

    await wrapper.findAll('.chip-moneda').find((c) => c.text() === 'S/ Soles')!.trigger('click')
    await wrapper.find('select[aria-label="Filtrar por banco"]').setValue('b2')

    expect(wrapper.find('.desglose-bancos').exists()).toBe(false)
    expect(wrapper.find('.estado-vacio-filtro').exists()).toBe(true)
  })

  it('borde: solo ingresos en "No especificado" → el desglose queda vacío pero el totalizador sigue sumando', async () => {
    const bancoNoEspecificado: Banco = {
      id: 'b3',
      usuario_id: 'u1',
      nombre: 'No especificado',
      created_at: '',
    }
    const ingresoNoEspecificado: Ingreso = {
      id: 'i4',
      usuario_id: 'u1',
      banco_id: 'b3',
      fecha: '2026-07-20',
      moneda: 'PEN',
      importe: 75,
      concepto: 'Varios',
      created_at: '',
    }
    mockearCargaInicial({
      ingresos: [ingresoNoEspecificado],
      bancos: [...bancosFalsos, bancoNoEspecificado],
    })

    const wrapper = mount(IngresosView)
    await flushPromises()

    expect(wrapper.find('.desglose-bancos').exists()).toBe(false)
    expect(wrapper.find('.resumen-totalizador').text()).toContain('75.00')
  })
})
