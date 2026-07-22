import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { flushPromises as flushPromisesFakeTimers, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import BandejaView from '@/views/BandejaView.vue'
import { useGastosStore } from '@/stores/gastos'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabaseClient'
import { crearConstructorConsulta } from '@/lib/__mocks__/supabaseClient'
import type { Gasto } from '@/types/gasto'

const fromMock = supabase.from as unknown as Mock

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

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
  creado_en: '',
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
 * Estas pruebas cubren HU-5.2 a nivel de integración: `onMounted` dispara
 * `cargarCategorias`/`cargarBorradores`, por eso se estuba `from()` según la
 * tabla consultada (mismo patrón que `HistorialView.spec.ts`). Desde HU-5.5,
 * `onMounted` también consulta `estado_ingesta`; los mocks de `fromMock`
 * contemplan esa tabla para no romper los casos existentes.
 */
describe('BandejaView (HU-5.2)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useAuthStore().establecerUsuario({ id: 'u1', email: 'a@a.com' } as never)
  })

  it('camino feliz: muestra el banner "N gastos por confirmar" y una tarjeta por borrador', async () => {
    fromMock.mockImplementation((tabla: string) => {
      if (tabla === 'estado_ingesta') return builderEstadoIngestaSinEjecucion()
      const builder = crearConstructorConsulta()
      if (tabla === 'gastos') {
        ;(builder.order as Mock).mockResolvedValue({ data: [borradorFalso], error: null })
      } else {
        ;(builder.order as Mock).mockResolvedValue({ data: [], error: null })
      }
      return builder
    })

    const wrapper = mount(BandejaView)
    await flushPromises()

    expect(wrapper.text()).toContain('1 gasto por confirmar')
    expect(wrapper.findAll('.tarjeta-borrador')).toHaveLength(1)
    expect(wrapper.find('.estado-vacio').exists()).toBe(false)
  })

  it('estado vacío: sin borradores pendientes muestra "Bandeja al día" y sin banner', async () => {
    fromMock.mockImplementation((tabla: string) => {
      if (tabla === 'estado_ingesta') return builderEstadoIngestaSinEjecucion()
      const builder = crearConstructorConsulta()
      ;(builder.order as Mock).mockResolvedValue({ data: [], error: null })
      return builder
    })

    const wrapper = mount(BandejaView)
    await flushPromises()

    expect(wrapper.find('.banner-bandeja').exists()).toBe(false)
    expect(wrapper.text()).toContain('Bandeja al día')
  })

  it('camino feliz: al confirmar un borrador desde la tarjeta, desaparece de la bandeja', async () => {
    fromMock.mockImplementation((tabla: string) => {
      if (tabla === 'estado_ingesta') return builderEstadoIngestaSinEjecucion()
      const builder = crearConstructorConsulta()
      if (tabla === 'gastos') {
        ;(builder.order as Mock).mockResolvedValue({ data: [borradorFalso], error: null })
      } else {
        ;(builder.order as Mock).mockResolvedValue({ data: [], error: null })
      }
      return builder
    })

    const store = useGastosStore()
    const wrapper = mount(BandejaView)
    await flushPromises()

    expect(store.borradores).toHaveLength(1)

    const builderConfirmar = crearConstructorConsulta()
    fromMock.mockReturnValueOnce(builderConfirmar)
    ;(builderConfirmar.single as Mock).mockResolvedValueOnce({
      data: { ...borradorFalso, estado: 'confirmado' },
      error: null,
    })

    await wrapper.find('.boton-confirmar').trigger('click')
    await flushPromises()

    expect(store.borradores).toHaveLength(0)
    expect(wrapper.findAll('.tarjeta-borrador')).toHaveLength(0)
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
