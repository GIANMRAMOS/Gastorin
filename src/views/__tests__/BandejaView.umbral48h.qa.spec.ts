import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { flushPromises as flushPromisesFakeTimers, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import BandejaView from '@/views/BandejaView.vue'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabaseClient'
import { crearConstructorConsulta } from '@/lib/__mocks__/supabaseClient'

const fromMock = supabase.from as unknown as Mock

/**
 * QA independiente (HU-5.5): verifica el punto de corte EXACTO del umbral de
 * 48h que implementó dev-builder (`Date.now() - ultimaEjecucion > 48h`,
 * comparación estrictamente MAYOR). "Ahora" fijo: 2026-07-22T12:00:00Z.
 */
function builderEstadoIngestaCon(ultimaEjecucionEn: string) {
  const builder = crearConstructorConsulta()
  ;(builder.single as Mock).mockResolvedValue({
    data: { ultima_ejecucion_en: ultimaEjecucionEn },
    error: null,
  })
  return builder
}

function mockearBandejaVacia(builderEstadoIngesta: ReturnType<typeof crearConstructorConsulta>) {
  fromMock.mockImplementation((tabla: string) => {
    if (tabla === 'estado_ingesta') return builderEstadoIngesta
    const builder = crearConstructorConsulta()
    ;(builder.order as Mock).mockResolvedValue({ data: [], error: null })
    return builder
  })
}

describe('BandejaView (HU-5.5) — QA independiente: umbral exacto de 48h', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useAuthStore().establecerUsuario({ id: 'u1', email: 'a@a.com' } as never)
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-22T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('a 47h59min (justo por debajo del umbral): NO debe mostrar advertencia', async () => {
    // "ahora" - 47h59min = 2026-07-20T12:01:00Z
    mockearBandejaVacia(builderEstadoIngestaCon('2026-07-20T12:01:00Z'))

    const wrapper = mount(BandejaView)
    await flushPromisesFakeTimers()

    expect(wrapper.find('.estado-ingesta').classes()).not.toContain('estado-ingesta--alerta')
  })

  it('exactamente a 48h00min00s (el límite mismo): NO debe mostrar advertencia (comparación estricta ">")', async () => {
    // "ahora" - 48h exactas = 2026-07-20T12:00:00Z
    mockearBandejaVacia(builderEstadoIngestaCon('2026-07-20T12:00:00Z'))

    const wrapper = mount(BandejaView)
    await flushPromisesFakeTimers()

    expect(wrapper.find('.estado-ingesta').classes()).not.toContain('estado-ingesta--alerta')
  })

  it('a 48h00min01s (un segundo después del límite): SÍ debe mostrar advertencia', async () => {
    // "ahora" - 48h - 1s = 2026-07-20T11:59:59Z
    mockearBandejaVacia(builderEstadoIngestaCon('2026-07-20T11:59:59Z'))

    const wrapper = mount(BandejaView)
    await flushPromisesFakeTimers()

    expect(wrapper.find('.estado-ingesta').classes()).toContain('estado-ingesta--alerta')
  })
})
