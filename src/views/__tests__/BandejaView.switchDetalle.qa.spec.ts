import { beforeEach, describe, expect, it, type Mock } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import BandejaView from '@/views/BandejaView.vue'
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

const bancoFalso = { id: 'banco-1', usuario_id: 'u1', nombre: 'BCP', created_at: '' }

const borradorA: Gasto = {
  id: 'bA',
  usuario_id: 'u1',
  categoria_id: 'c1',
  banco_id: 'banco-1',
  monto: 45.5,
  moneda: 'PEN',
  fecha: '2026-07-20',
  descripcion: 'Comercio A',
  origen: 'correo',
  estado: 'borrador',
  gmail_message_id: 'msg-a',
  gmail_fragmento: null,
  creado_en: '2026-07-20T14:32:00Z',
  actualizado_en: '',
}

const borradorB: Gasto = {
  ...borradorA,
  id: 'bB',
  categoria_id: 'c1',
  descripcion: 'Comercio B',
  gmail_message_id: 'msg-b',
}

function mockearTablas() {
  fromMock.mockImplementation((tabla: string) => {
    const builder = crearConstructorConsulta()
    if (tabla === 'estado_ingesta') {
      ;(builder.single as Mock).mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    } else if (tabla === 'gastos') {
      ;(builder.order as Mock).mockResolvedValue({ data: [borradorA, borradorB], error: null })
    } else if (tabla === 'categorias') {
      ;(builder.order as Mock).mockResolvedValue({
        data: [categoriaAlimentacion, categoriaTransporte],
        error: null,
      })
    } else if (tabla === 'bancos') {
      ;(builder.order as Mock).mockResolvedValue({ data: [bancoFalso], error: null })
    } else if (tabla === 'reglas_comercio') {
      ;(builder.maybeSingle as Mock).mockResolvedValue({ data: null, error: null })
      ;(builder.upsert as Mock).mockResolvedValue({ data: null, error: null })
    } else {
      ;(builder.order as Mock).mockResolvedValue({ data: [], error: null })
    }
    return builder
  })
}

/**
 * QA independiente (rediseño "Caudal" Fase 3): al cambiar de categoría en el
 * panel de detalle de un borrador y, SIN confirmar, seleccionar otro
 * borrador distinto de la lista, hay dos riesgos concretos a verificar:
 *  1. Que la categoría recién tocada (no guardada) del borrador A no se
 *     "filtre" visualmente al panel del borrador B (el bug clásico de
 *     reutilizar estado local entre props distintas).
 *  2. Que, al volver al borrador A, su cambio de categoría no persistido se
 *     haya perdido (comportamiento esperado dado que no hay borrador ->
 *     persistencia parcial), sin que quede ningún rastro incorrecto.
 * `PanelDetalleBorrador` se monta con `:key="borrador.id"` en `BandejaView`,
 * lo cual en teoría fuerza un remount limpio; este test lo verifica de punta
 * a punta en vez de solo confiar en la lectura del código.
 */
describe('BandejaView — QA independiente: cambiar de borrador sin confirmar no debe filtrar categoría', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useAuthStore().establecerUsuario({ id: 'u1', email: 'a@a.com' } as never)
    mockearTablas()
  })

  it('cambiar la categoría del borrador A y saltar a B no deja la categoría de A visible en el panel de B', async () => {
    const wrapper = mount(BandejaView)
    await flushPromises()

    const filas = wrapper.findAll('.fila-borrador')
    expect(filas).toHaveLength(2)

    // Abre el borrador A (comercio A, categoría inicial "Alimentación").
    await filas[0].trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Alimentación')

    // Cambia la categoría de A a "Transporte" SIN confirmar.
    await wrapper.find('.chip-categoria-tocable').trigger('click')
    await flushPromises()
    const chipsA = wrapper.findAll('.chip-categoria')
    const chipTransporte = chipsA.find((c) => c.text().includes('Transporte'))
    expect(chipTransporte).toBeTruthy()
    await chipTransporte!.trigger('click')
    await flushPromises()
    expect(wrapper.find('.chip-categoria-tocable').text()).toContain('Transporte')

    // Salta al borrador B sin confirmar el cambio de A.
    const filasActualizadas = wrapper.findAll('.fila-borrador')
    await filasActualizadas[1].trigger('click')
    await flushPromises()

    // El panel de B debe mostrar SU categoría original ("Alimentación"), no
    // "Transporte" filtrada desde el estado local del borrador A.
    expect(wrapper.find('.chip-categoria-tocable').text()).toContain('Alimentación')
    expect(wrapper.find('.chip-categoria-tocable').text()).not.toContain('Transporte')
  })

  it('volver al borrador A tras saltar a B muestra la categoría original de A (el cambio no persistido se perdió, sin rastro incorrecto)', async () => {
    const wrapper = mount(BandejaView)
    await flushPromises()

    const filas = wrapper.findAll('.fila-borrador')
    await filas[0].trigger('click')
    await flushPromises()

    await wrapper.find('.chip-categoria-tocable').trigger('click')
    await flushPromises()
    const chipTransporte = wrapper.findAll('.chip-categoria').find((c) => c.text().includes('Transporte'))
    await chipTransporte!.trigger('click')
    await flushPromises()

    // Salta a B y vuelve a A sin haber confirmado nunca.
    await wrapper.findAll('.fila-borrador')[1].trigger('click')
    await flushPromises()
    await wrapper.findAll('.fila-borrador')[0].trigger('click')
    await flushPromises()

    // A vuelve a nacer desde `borrador.categoria_id` (fuente de la verdad
    // hasta que se confirme), no desde el chip tocado y descartado.
    expect(wrapper.find('.chip-categoria-tocable').text()).toContain('Alimentación')
  })
})

/**
 * QA independiente (pregunta 5 del pase de QA): en el layout responsive
 * (overlay de detalle en ≤900px), el botón "Volver a la lista" debe existir
 * siempre en el DOM (el toggle mobile/desktop es puramente CSS vía la clase
 * `grid-bandeja--detalle-abierto`, sin ningún `v-if` que lo condicione a un
 * ancho de pantalla) y su click debe cerrar el panel sin recargar la página
 * (basta con volver `idSeleccionado` a `null`). Esto no depende de simular un
 * viewport real en jsdom: la lógica de Vue (emitir `cerrar` y limpiar el id
 * seleccionado) es la misma sin importar el breakpoint, y es lo único que
 * este test puede verificar sin un navegador real.
 */
describe('BandejaView — QA independiente: el botón "Volver a la lista" cierra el detalle sin recargar', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useAuthStore().establecerUsuario({ id: 'u1', email: 'a@a.com' } as never)
    mockearTablas()
  })

  it('clickear "Volver a la lista" cierra el panel de detalle y vuelve a mostrar el estado "Selecciona un cargo"', async () => {
    const wrapper = mount(BandejaView)
    await flushPromises()

    await wrapper.find('.fila-borrador').trigger('click')
    await flushPromises()
    expect(wrapper.find('.panel-detalle-borrador').exists()).toBe(true)

    await wrapper.find('.boton-volver').trigger('click')
    await flushPromises()

    expect(wrapper.find('.panel-detalle-borrador').exists()).toBe(false)
    expect(wrapper.text()).toContain('Selecciona un cargo')
    // Ambos borradores siguen en la lista: cerrar el detalle no descarta ni confirma nada.
    expect(wrapper.findAll('.fila-borrador')).toHaveLength(2)
  })
})
