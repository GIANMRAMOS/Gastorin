import { beforeEach, describe, expect, it, type Mock } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import HistorialView from '@/views/HistorialView.vue'
import { useGastosStore } from '@/stores/gastos'
import { supabase } from '@/lib/supabaseClient'
import { crearConstructorConsulta } from '@/lib/__mocks__/supabaseClient'
import type { Categoria, Gasto } from '@/types/gasto'

const fromMock = supabase.from as unknown as Mock

/**
 * Pruebas de integración de `HistorialView` para la Épica 3 (HU-3.1, HU-3.2,
 * HU-3.4): fila con abreviatura/color leídos del store, filtros combinables
 * y los dos estados vacíos distintos. No repite lo que ya cubren
 * `calcularAbreviaturas.spec.ts` (helper puro) ni `FiltrosHistorial.spec.ts`
 * (emisión aislada del presentacional); aquí se verifica que la vista
 * realmente los conecta con `store.gastos`/`store.categorias`.
 *
 * Nota: las categorías que llegan de Supabase NO traen `abreviatura` (es un
 * campo derivado, ver `src/types/gasto.ts`); se castea el fixture crudo para
 * simular exactamente lo que devuelve la tabla real y así probar que
 * `cargarCategorias` (vía `calcularAbreviaturas`) es quien la calcula, no la
 * vista.
 */

// Categorías "Ocio" y "Otro" comparten la primera letra ('O') a propósito,
// para verificar la colisión de abreviatura (HU-3.1) en el contexto real de
// la vista, y no solo en el helper aislado.
const categoriasCrudasFalsas = [
  { id: 'ocio', usuario_id: 'u1', nombre: 'Ocio', predefinida: true, activa: true, creado_en: '' },
  { id: 'otro', usuario_id: 'u1', nombre: 'Otro', predefinida: true, activa: true, creado_en: '' },
  {
    id: 'transporte',
    usuario_id: 'u1',
    nombre: 'Transporte',
    predefinida: true,
    activa: true,
    creado_en: '',
  },
] as unknown as Categoria[]

const gastosFalsos: Gasto[] = [
  {
    id: 'g1',
    usuario_id: 'u1',
    categoria_id: 'ocio',
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
  },
  {
    id: 'g2',
    usuario_id: 'u1',
    categoria_id: 'otro',
    monto: 12,
    moneda: 'USD',
    fecha: '2026-07-15',
    descripcion: 'Varios',
    origen: 'manual',
    estado: 'confirmado',
    gmail_message_id: null,
    gmail_fragmento: null,
    creado_en: '',
    actualizado_en: '',
  },
  {
    id: 'g3',
    usuario_id: 'u1',
    categoria_id: 'transporte',
    monto: 8,
    moneda: 'PEN',
    fecha: '2026-06-01',
    descripcion: 'Taxi',
    origen: 'manual',
    estado: 'confirmado',
    gmail_message_id: null,
    gmail_fragmento: null,
    creado_en: '',
    actualizado_en: '',
  },
]

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

/** Configura `supabase.from()` para devolver los fixtures dados en `onMounted`. */
function mockearCargaInicial(opciones: { categorias?: unknown[]; gastos?: Gasto[] } = {}) {
  const { categorias = categoriasCrudasFalsas, gastos = gastosFalsos } = opciones
  fromMock.mockImplementation((tabla: string) => {
    const builder = crearConstructorConsulta()
    if (tabla === 'gastos') {
      ;(builder.order as Mock).mockResolvedValue({ data: gastos, error: null })
    } else {
      ;(builder.order as Mock).mockResolvedValue({ data: categorias, error: null })
    }
    return builder
  })
}

describe('HistorialView — fila del historial (HU-3.1)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockearCargaInicial()
  })

  it('camino feliz: cada gasto se muestra en una fila con círculo (abreviatura+color), descripción en negrita, categoría·fecha y monto con símbolo', async () => {
    const wrapper = mount(HistorialView)
    await flushPromises()

    const filas = wrapper.findAll('.fila-gasto')
    expect(filas).toHaveLength(3)

    // Fila de "Cine" (categoría Ocio, colisiona con "Otro" en la letra 'O').
    const filaCine = filas.find((f) => f.text().includes('Cine'))!
    const circulo = filaCine.find('.circulo-categoria')
    expect(circulo.text()).toBe('OC') // 2 caracteres por colisión con "Otro"
    expect(circulo.attributes('style')).toContain('var(--color-categoria-ocio)')
    expect(filaCine.find('.descripcion-gasto').text()).toBe('Cine')
    expect(filaCine.find('.metadatos-gasto').text()).toBe('Ocio · 2026-07-10')
    expect(filaCine.find('.monto-gasto').text()).toContain('25.50')
    expect(filaCine.find('.monto-gasto').text()).toContain('S/')
    expect(filaCine.find('.indicador-editar').text()).toBe('Editar ›')

    // Fila de "Varios" (categoría Otro, también colisiona → 2 caracteres, color "Otros").
    const filaVarios = filas.find((f) => f.text().includes('Varios'))!
    expect(filaVarios.find('.circulo-categoria').text()).toBe('OT')
    expect(filaVarios.find('.monto-gasto').text()).toContain('$')

    // Fila de "Taxi" (categoría Transporte, sin colisión → 1 carácter).
    const filaTaxi = filas.find((f) => f.text().includes('Taxi'))!
    expect(filaTaxi.find('.circulo-categoria').text()).toBe('T')
    expect(filaTaxi.find('.circulo-categoria').attributes('style')).toContain(
      'var(--color-categoria-transporte)',
    )
  })

  it('la abreviatura se lee de `categoria.abreviatura` (calculada al cargar categorías), la fila no recalcula por su cuenta', async () => {
    const wrapper = mount(HistorialView)
    await flushPromises()

    const store = useGastosStore()
    // El store ya contiene las categorías ENRIQUECIDAS por `cargarCategorias`
    // (vía `calcularAbreviaturas`), aunque el fixture de Supabase no traía
    // el campo `abreviatura`.
    expect(store.categorias.find((c) => c.id === 'ocio')?.abreviatura).toBe('OC')
    expect(store.categorias.find((c) => c.id === 'transporte')?.abreviatura).toBe('T')

    // Si se muta la abreviatura directamente en el store, la fila debe
    // reflejar ese valor tal cual (prueba de que lee del store y no la
    // recomputa ella misma a partir del nombre).
    const categoriaOcio = store.categorias.find((c) => c.id === 'ocio')!
    categoriaOcio.abreviatura = 'ZZ'
    await wrapper.vm.$nextTick()

    const filaCine = wrapper.findAll('.fila-gasto').find((f) => f.text().includes('Cine'))!
    expect(filaCine.find('.circulo-categoria').text()).toBe('ZZ')
  })

  it('editar: clic en "Editar ›" abre el modal en modo edición con cabecera "Editar gasto" (regresión HU-3.3)', async () => {
    const wrapper = mount(HistorialView)
    await flushPromises()

    const filaCine = wrapper.findAll('.fila-gasto').find((f) => f.text().includes('Cine'))!
    await filaCine.find('.indicador-editar').trigger('click')

    expect(wrapper.find('[role="dialog"] h2').text()).toBe('Editar gasto')
  })

  it('estado vacío genérico: sin ningún gasto, se muestra el mensaje genérico con CTA "Nuevo gasto" que abre el modal de alta', async () => {
    mockearCargaInicial({ gastos: [] })
    const wrapper = mount(HistorialView)
    await flushPromises()

    expect(wrapper.find('.estado-vacio-generico').exists()).toBe(true)
    expect(wrapper.find('.estado-vacio-filtro').exists()).toBe(false)
    expect(wrapper.find('.lista-gastos').exists()).toBe(false)
    // Sin gastos, los filtros ni siquiera se muestran (no tendría sentido filtrar nada).
    expect(wrapper.findComponent({ name: 'FiltrosHistorial' }).exists()).toBe(false)

    const cta = wrapper.find('.estado-vacio-generico button')
    expect(cta.text()).toBe('Nuevo gasto')
    await cta.trigger('click')

    expect(wrapper.find('[role="dialog"] h2').text()).toBe('Nuevo gasto')
  })
})

describe('HistorialView — cruce con Épica 4 (HU-4.3): categoría desactivada sigue resolviendo nombre y color', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('un gasto que referencia una categoría desactivada sigue mostrando su nombre, abreviatura y color tras cargar (simula recarga de página)', async () => {
    const categoriasConUnaInactiva = [
      { id: 'ocio', usuario_id: 'u1', nombre: 'Ocio', predefinida: true, activa: true, creado_en: '' },
      // "Transporte" fue desactivada (HU-4.3), pero `cargarCategorias` la
      // sigue trayendo (sin filtro `activa`) precisamente para este caso.
      {
        id: 'transporte',
        usuario_id: 'u1',
        nombre: 'Transporte',
        predefinida: true,
        activa: false,
        creado_en: '',
      },
    ] as unknown as Categoria[]

    const gastoHistoricoConCategoriaDesactivada: Gasto = {
      id: 'g-hist',
      usuario_id: 'u1',
      categoria_id: 'transporte',
      monto: 15,
      moneda: 'PEN',
      fecha: '2026-05-01',
      descripcion: 'Taxi viejo',
      origen: 'manual',
      estado: 'confirmado',
      gmail_message_id: null,
      gmail_fragmento: null,
      creado_en: '',
      actualizado_en: '',
    }

    mockearCargaInicial({
      categorias: categoriasConUnaInactiva,
      gastos: [gastoHistoricoConCategoriaDesactivada],
    })

    const wrapper = mount(HistorialView)
    await flushPromises()

    // La categoría desactivada sigue en el store (necesaria para resolver el
    // gasto histórico), aunque en `CategoriasView` no se listaría.
    const store = useGastosStore()
    expect(store.categorias.find((c) => c.id === 'transporte')?.activa).toBe(false)

    const fila = wrapper.findAll('.fila-gasto').find((f) => f.text().includes('Taxi viejo'))!
    expect(fila).toBeDefined()
    // Nombre real de la categoría desactivada (no "Sin categoría").
    expect(fila.find('.metadatos-gasto').text()).toBe('Transporte · 2026-05-01')
    // Color real (mapa curado de "transporte"), no el color de respaldo "otros".
    expect(fila.find('.circulo-categoria').attributes('style')).toContain(
      'var(--color-categoria-transporte)',
    )
    expect(fila.find('.circulo-categoria').text()).toBe('T')
  })
})

describe('HistorialView — filtros combinables (HU-3.2)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockearCargaInicial()
  })

  it('filtro por chip de moneda: "S/ Soles" deja solo gastos en PEN y marca el chip activo', async () => {
    const wrapper = mount(HistorialView)
    await flushPromises()

    const chipSoles = wrapper.findAll('.chip-moneda').find((c) => c.text() === 'S/ Soles')!
    await chipSoles.trigger('click')

    expect(wrapper.findAll('.fila-gasto')).toHaveLength(2) // Cine (PEN) y Taxi (PEN)
    expect(wrapper.text()).toContain('Cine')
    expect(wrapper.text()).toContain('Taxi')
    expect(wrapper.text()).not.toContain('Varios') // Varios es USD

    expect(chipSoles.classes()).toContain('activo')
    const chipTodos = wrapper.findAll('.chip-moneda').find((c) => c.text() === 'Todos')!
    expect(chipTodos.classes()).not.toContain('activo')
  })

  it('"Todos" quita el filtro de moneda tras haber activado "S/ Soles"', async () => {
    const wrapper = mount(HistorialView)
    await flushPromises()

    await wrapper.findAll('.chip-moneda').find((c) => c.text() === 'S/ Soles')!.trigger('click')
    expect(wrapper.findAll('.fila-gasto')).toHaveLength(2)

    await wrapper.findAll('.chip-moneda').find((c) => c.text() === 'Todos')!.trigger('click')
    expect(wrapper.findAll('.fila-gasto')).toHaveLength(3)
  })

  it('filtro por categoría: elegir "Ocio" deja solo el gasto de esa categoría', async () => {
    const wrapper = mount(HistorialView)
    await flushPromises()

    const select = wrapper.find('select[aria-label="Filtrar por categoría"]')
    await select.setValue('ocio')

    expect(wrapper.findAll('.fila-gasto')).toHaveLength(1)
    expect(wrapper.text()).toContain('Cine')
    expect(wrapper.text()).not.toContain('Taxi')
    expect(wrapper.text()).not.toContain('Varios')
  })

  it('filtro por mes: elegir "2026-06" deja solo los gastos de ese mes', async () => {
    const wrapper = mount(HistorialView)
    await flushPromises()

    const select = wrapper.find('select[aria-label="Filtrar por mes"]')
    await select.setValue('2026-06')

    expect(wrapper.findAll('.fila-gasto')).toHaveLength(1)
    expect(wrapper.text()).toContain('Taxi')
  })

  it('filtros combinables: moneda + categoría + mes aplican la intersección de los tres', async () => {
    const wrapper = mount(HistorialView)
    await flushPromises()

    await wrapper.findAll('.chip-moneda').find((c) => c.text() === '$ Dólares')!.trigger('click')
    await wrapper.find('select[aria-label="Filtrar por categoría"]').setValue('otro')
    await wrapper.find('select[aria-label="Filtrar por mes"]').setValue('2026-07')

    // Solo "Varios" (USD, categoría Otro, julio 2026) cumple las tres condiciones.
    expect(wrapper.findAll('.fila-gasto')).toHaveLength(1)
    expect(wrapper.text()).toContain('Varios')
  })
})

describe('HistorialView — estado vacío por filtro (HU-3.4)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockearCargaInicial()
  })

  it('filtro sin resultados con gastos existentes: muestra el estado vacío ESPECÍFICO, no el genérico', async () => {
    const wrapper = mount(HistorialView)
    await flushPromises()

    // "Ocio" (PEN) combinado con moneda "$ Dólares": ninguna fila cumple ambas.
    await wrapper.findAll('.chip-moneda').find((c) => c.text() === '$ Dólares')!.trigger('click')
    await wrapper.find('select[aria-label="Filtrar por categoría"]').setValue('ocio')

    expect(wrapper.findAll('.fila-gasto')).toHaveLength(0)
    expect(wrapper.find('.estado-vacio-filtro').exists()).toBe(true)
    expect(wrapper.find('.estado-vacio-generico').exists()).toBe(false) // no se confunden los dos estados
    expect(wrapper.text()).toContain('Sin gastos con este filtro')
    expect(wrapper.text()).toContain('Prueba cambiar el filtro o registra el primer gasto del mes.')
  })

  it('sin ningún gasto en absoluto, se ve el estado vacío GENÉRICO aunque no haya filtro activo (no el específico)', async () => {
    mockearCargaInicial({ gastos: [] })
    const wrapper = mount(HistorialView)
    await flushPromises()

    expect(wrapper.find('.estado-vacio-generico').exists()).toBe(true)
    expect(wrapper.find('.estado-vacio-filtro').exists()).toBe(false)
  })
})
