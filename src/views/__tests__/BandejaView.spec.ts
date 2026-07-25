import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { flushPromises as flushPromisesFakeTimers, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import BandejaView from '@/views/BandejaView.vue'
import { useGastosStore } from '@/stores/gastos'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabaseClient'
import { crearConstructorConsulta } from '@/lib/__mocks__/supabaseClient'
import type { Categoria, Gasto } from '@/types/gasto'

const fromMock = supabase.from as unknown as Mock

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

const categoriaAlimentacion: Categoria = {
  id: 'c1',
  usuario_id: 'u1',
  nombre: 'Alimentación',
  tipo: 'gasto',
  predefinida: true,
  activa: true,
  creado_en: '',
  abreviatura: 'A',
}

const bancoFalso = { id: 'banco-1', usuario_id: 'u1', nombre: 'BCP', created_at: '' }

const borradorFalso: Gasto = {
  id: 'b1',
  usuario_id: 'u1',
  categoria_id: 'c1',
  banco_id: 'banco-1',
  monto: 45.5,
  moneda: 'PEN',
  fecha: '2026-07-20',
  descripcion: 'Compra supermercado',
  origen: 'correo',
  estado: 'borrador',
  gmail_message_id: 'msg-1',
  gmail_fragmento: 'BCP: consumo por S/ 45.50',
  creado_en: '2026-07-20T14:32:00Z',
  actualizado_en: '',
}

/**
 * Estado de ingesta "sin ejecución previa": simula el "no rows" de
 * PostgREST (`error.code === 'PGRST116'`) que devuelve `.single()` cuando la
 * tabla `estado_ingesta` no tiene fila para el usuario.
 */
function builderEstadoIngestaSinEjecucion() {
  const builder = crearConstructorConsulta()
  ;(builder.single as Mock).mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
  return builder
}

function builderEstadoIngestaCon(ultimaEjecucionEn: string) {
  const builder = crearConstructorConsulta()
  ;(builder.single as Mock).mockResolvedValue({
    data: { ultima_ejecucion_en: ultimaEjecucionEn },
    error: null,
  })
  return builder
}

/**
 * Configura `fromMock` para el camino feliz: `gastos` devuelve los borradores
 * indicados, `categorias`/`bancos` devuelven un set fijo, `estado_ingesta`
 * simula "sin ejecución previa", y `reglas_comercio` no encuentra regla salvo
 * que se pase explícitamente.
 */
function mockearTablas(opciones: {
  borradores?: Gasto[]
  reglaEncontrada?: { usuario_id: string; comercio: string; categoria_id: string; actualizado_en: string } | null
  errorReglas?: boolean
}) {
  fromMock.mockImplementation((tabla: string) => {
    if (tabla === 'estado_ingesta') return builderEstadoIngestaSinEjecucion()

    const builder = crearConstructorConsulta()
    if (tabla === 'gastos') {
      ;(builder.order as Mock).mockResolvedValue({ data: opciones.borradores ?? [], error: null })
    } else if (tabla === 'categorias') {
      ;(builder.order as Mock).mockResolvedValue({ data: [categoriaAlimentacion], error: null })
    } else if (tabla === 'bancos') {
      ;(builder.order as Mock).mockResolvedValue({ data: [bancoFalso], error: null })
    } else if (tabla === 'reglas_comercio') {
      ;(builder.maybeSingle as Mock).mockResolvedValue(
        opciones.errorReglas
          ? { data: null, error: { message: 'boom' } }
          : { data: opciones.reglaEncontrada ?? null, error: null },
      )
      ;(builder.upsert as Mock).mockResolvedValue({ data: null, error: null })
    } else {
      ;(builder.order as Mock).mockResolvedValue({ data: [], error: null })
    }
    return builder
  })
}

/**
 * Estas pruebas cubren HU-5.2 a nivel de integración: `onMounted` dispara
 * `cargarCategorias`/`cargarBancos`/`cargarBorradores`, por eso se estuba
 * `from()` según la tabla consultada (mismo patrón que `HistorialView.spec.ts`).
 * Desde la Fase 3 "Caudal", la Bandeja es un maestro-detalle: la lista de la
 * izquierda solo pinta filas (`FilaBorrador`); confirmar/descartar y la
 * sugerencia de HU-14.1 viven en el panel de detalle (`PanelDetalleBorrador`),
 * que solo aparece tras seleccionar una fila.
 */
describe('BandejaView (HU-5.2)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useAuthStore().establecerUsuario({ id: 'u1', email: 'a@a.com' } as never)
  })

  it('camino feliz: muestra el banner "N gastos por confirmar" y una fila por borrador', async () => {
    mockearTablas({ borradores: [borradorFalso] })

    const wrapper = mount(BandejaView)
    await flushPromises()

    expect(wrapper.text()).toContain('1 gasto por confirmar')
    expect(wrapper.findAll('.item-fila-borrador')).toHaveLength(1)
    expect(wrapper.text()).toContain('Compra supermercado')
    expect(wrapper.text()).toContain('BCP')
    expect(wrapper.find('.estado-vacio').exists()).toBe(false)
  })

  it('estado vacío: sin borradores pendientes muestra "Bandeja al día" y sin banner', async () => {
    mockearTablas({ borradores: [] })

    const wrapper = mount(BandejaView)
    await flushPromises()

    expect(wrapper.find('.banner-bandeja').exists()).toBe(false)
    expect(wrapper.text()).toContain('Bandeja al día')
  })

  it('camino feliz: seleccionar una fila resalta y abre el panel de detalle con el correo original', async () => {
    mockearTablas({ borradores: [borradorFalso] })

    const wrapper = mount(BandejaView)
    await flushPromises()

    expect(wrapper.find('.panel-detalle-borrador').exists()).toBe(false)
    expect(wrapper.text()).toContain('Selecciona un cargo')

    await wrapper.find('.fila-borrador').trigger('click')
    await flushPromises()

    expect(wrapper.find('.fila-borrador--seleccionada').exists()).toBe(true)
    expect(wrapper.find('.panel-detalle-borrador').exists()).toBe(true)
    expect(wrapper.text()).toContain('BCP: consumo por S/ 45.50')
  })

  it('camino feliz: al confirmar un borrador sin regla previa, sale de la bandeja y se crea la regla de comercio', async () => {
    mockearTablas({ borradores: [borradorFalso], reglaEncontrada: null })

    const store = useGastosStore()
    const wrapper = mount(BandejaView)
    await flushPromises()

    await wrapper.find('.fila-borrador').trigger('click')
    await flushPromises()

    expect(wrapper.find('.banner-regla-comercio').exists()).toBe(false)

    const builderConfirmar = crearConstructorConsulta()
    fromMock.mockReturnValueOnce(builderConfirmar)
    ;(builderConfirmar.single as Mock).mockResolvedValueOnce({
      data: { ...borradorFalso, estado: 'confirmado' },
      error: null,
    })

    const builderRegla = crearConstructorConsulta()
    fromMock.mockReturnValueOnce(builderRegla)
    ;(builderRegla.upsert as Mock).mockResolvedValueOnce({ data: null, error: null })

    await wrapper.find('.boton-confirmar').trigger('click')
    await flushPromises()

    expect(store.borradores).toHaveLength(0)
    expect(builderConfirmar.update).toHaveBeenCalledWith({ categoria_id: 'c1', estado: 'confirmado' })
    expect(builderRegla.upsert).toHaveBeenCalledWith(
      { usuario_id: 'u1', comercio: 'compra supermercado', categoria_id: 'c1' },
      { onConflict: 'usuario_id,comercio' },
    )
    // La bandeja queda al día: no hay más borradores por confirmar.
    expect(wrapper.text()).toContain('Bandeja al día')
  })

  it('HU-14.1: comercio con regla previa muestra el banner verde con la categoría preseleccionada', async () => {
    mockearTablas({
      borradores: [borradorFalso],
      reglaEncontrada: {
        usuario_id: 'u1',
        comercio: 'compra supermercado',
        categoria_id: 'c1',
        actualizado_en: '',
      },
    })

    const wrapper = mount(BandejaView)
    await flushPromises()

    await wrapper.find('.fila-borrador').trigger('click')
    await flushPromises()

    expect(wrapper.find('.banner-regla-comercio').exists()).toBe(true)
    expect(wrapper.text()).toContain('Categoría sugerida por')
  })

  it('borde: fallo del upsert de la regla NO revierte ni bloquea la confirmación ya hecha', async () => {
    mockearTablas({ borradores: [borradorFalso], reglaEncontrada: null })

    const store = useGastosStore()
    const wrapper = mount(BandejaView)
    await flushPromises()

    await wrapper.find('.fila-borrador').trigger('click')
    await flushPromises()

    const builderConfirmar = crearConstructorConsulta()
    fromMock.mockReturnValueOnce(builderConfirmar)
    ;(builderConfirmar.single as Mock).mockResolvedValueOnce({
      data: { ...borradorFalso, estado: 'confirmado' },
      error: null,
    })

    const builderRegla = crearConstructorConsulta()
    fromMock.mockReturnValueOnce(builderRegla)
    ;(builderRegla.upsert as Mock).mockResolvedValueOnce({ data: null, error: { message: 'boom' } })

    await wrapper.find('.boton-confirmar').trigger('click')
    await flushPromises()

    // El gasto ya confirmado sale de la bandeja igual, pese al fallo del upsert de la regla.
    expect(store.borradores).toHaveLength(0)
    expect(wrapper.text()).toContain('Bandeja al día')
    // El fallo del upsert (comodidad, no crítico) tampoco dispara el banner de error global.
    expect(wrapper.find('.mensaje-error').exists()).toBe(false)
  })

  it('HU-14.2: dos borradores con mismo monto, banco y fecha cercana muestran el badge de posible duplicado', async () => {
    const borradorDuplicado: Gasto = { ...borradorFalso, id: 'b2', fecha: '2026-07-22' }
    mockearTablas({ borradores: [borradorFalso, borradorDuplicado] })

    const wrapper = mount(BandejaView)
    await flushPromises()

    expect(wrapper.findAll('.badge-duplicado')).toHaveLength(2)
  })

  it('HU-14.2: mismo monto y banco pero fecha a más de 3 días NO muestra el badge', async () => {
    const borradorLejano: Gasto = { ...borradorFalso, id: 'b2', fecha: '2026-07-25' }
    mockearTablas({ borradores: [borradorFalso, borradorLejano] })

    const wrapper = mount(BandejaView)
    await flushPromises()

    expect(wrapper.findAll('.badge-duplicado')).toHaveLength(0)
  })

  it('borde: revisión manual sin monto/moneda bloquea Confirmar en el panel de detalle', async () => {
    const borradorRevision: Gasto = {
      ...borradorFalso,
      id: 'b2',
      monto: null,
      moneda: null,
      estado: 'revision_manual',
    }
    mockearTablas({ borradores: [borradorRevision] })

    const wrapper = mount(BandejaView)
    await flushPromises()

    await wrapper.find('.fila-borrador').trigger('click')
    await flushPromises()

    expect(wrapper.find('.etiqueta-alerta').exists()).toBe(true)
    expect(wrapper.find('.boton-confirmar').attributes('disabled')).toBeDefined()
  })
})

/**
 * Casos de aceptación de HU-5.5: los 3 escenarios de estado de la ingesta
 * automática en la Bandeja. `vi.setSystemTime` fija "ahora" para calcular la
 * ventana de 48h (mismo precedente que `DashboardView.spec.ts`).
 */
describe('BandejaView (HU-5.5): estado de la última ejecución de la ingesta', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useAuthStore().establecerUsuario({ id: 'u1', email: 'a@a.com' } as never)
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-22T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function mockearBandejaVacia(builderEstadoIngesta: ReturnType<typeof crearConstructorConsulta>) {
    fromMock.mockImplementation((tabla: string) => {
      if (tabla === 'estado_ingesta') return builderEstadoIngesta
      const builder = crearConstructorConsulta()
      ;(builder.order as Mock).mockResolvedValue({ data: [], error: null })
      return builder
    })
  }

  it('sin ejecución previa: muestra el mensaje neutral "Aún no se ha ejecutado la revisión automática"', async () => {
    mockearBandejaVacia(builderEstadoIngestaSinEjecucion())

    const wrapper = mount(BandejaView)
    await flushPromisesFakeTimers()

    expect(wrapper.find('.estado-ingesta').text()).toBe(
      'Aún no se ha ejecutado la revisión automática',
    )
    expect(wrapper.find('.estado-ingesta').classes()).not.toContain('estado-ingesta--alerta')
  })

  it('ejecución dentro de 48h: muestra "Última revisión: [fecha]" sin advertencia', async () => {
    // 10 horas antes de "ahora" (2026-07-22T12:00:00Z): dentro de la ventana de 48h.
    mockearBandejaVacia(builderEstadoIngestaCon('2026-07-22T02:00:00Z'))

    const wrapper = mount(BandejaView)
    await flushPromisesFakeTimers()

    expect(wrapper.find('.estado-ingesta').text()).toContain('Última revisión:')
    expect(wrapper.find('.estado-ingesta').classes()).not.toContain('estado-ingesta--alerta')
  })

  it('ejecución hace más de 48h: muestra el mismo texto con el indicador de advertencia', async () => {
    // 3 días antes de "ahora": supera las 48h.
    mockearBandejaVacia(builderEstadoIngestaCon('2026-07-19T12:00:00Z'))

    const wrapper = mount(BandejaView)
    await flushPromisesFakeTimers()

    expect(wrapper.find('.estado-ingesta').text()).toContain('Última revisión:')
    expect(wrapper.find('.estado-ingesta').classes()).toContain('estado-ingesta--alerta')
  })
})
