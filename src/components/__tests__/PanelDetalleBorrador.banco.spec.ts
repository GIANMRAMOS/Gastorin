import { beforeEach, describe, expect, it, type Mock } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PanelDetalleBorrador from '@/components/PanelDetalleBorrador.vue'
import { useGastosStore } from '@/stores/gastos'
import { useIngresosStore } from '@/stores/ingresos'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabaseClient'
import { crearConstructorConsulta } from '@/lib/__mocks__/supabaseClient'
import type { Categoria, Gasto } from '@/types/gasto'
import type { Banco } from '@/types/ingreso'
import type { ReglaComercio } from '@/types/reglaComercio'

/**
 * `supabase.from` viene del mock manual (`vi.mock('@/lib/supabaseClient')` en
 * `src/test/setup.ts`). Se mockea por NOMBRE de tabla (`reglas_comercio` →
 * `maybeSingle`, `gastos` → `single`/`ilike`), nunca por posición: el
 * `onMounted` del panel dispara `buscarReglaPorComercio` y
 * `contarCargosComercio` sin orden garantizado entre sí.
 */
const fromMock = supabase.from as unknown as Mock

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

const bancoUno: Banco = { id: 'banco-1', usuario_id: 'u1', nombre: 'BCP', created_at: '' }
const bancoDos: Banco = { id: 'banco-2', usuario_id: 'u1', nombre: 'IBK', created_at: '' }

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
 * Mockea `from()` por nombre de tabla: `reglas_comercio` resuelve la regla
 * indicada (o `null`) y `gastos` resuelve el count de `contarCargosComercio`.
 * Devuelve ambos builders para poder sobreescribir el resto de la cadena
 * (ej. el `update`/`single` de `confirmar()`) en cada test.
 */
function mockearTablas(opciones: { regla?: ReglaComercio | null; countCargos?: number } = {}) {
  const builderReglas = crearConstructorConsulta()
  ;(builderReglas.maybeSingle as Mock).mockResolvedValue({ data: opciones.regla ?? null, error: null })
  ;(builderReglas.upsert as Mock).mockResolvedValue({ data: null, error: null })

  const builderGastos = crearConstructorConsulta()
  ;(builderGastos.ilike as Mock).mockResolvedValue({ count: opciones.countCargos ?? 0, error: null })

  fromMock.mockImplementation((tabla: string) => {
    if (tabla === 'reglas_comercio') return builderReglas
    if (tabla === 'gastos') return builderGastos
    return crearConstructorConsulta()
  })

  return { builderReglas, builderGastos }
}

function montarPanel(borrador: Gasto = borradorFalso) {
  return mount(PanelDetalleBorrador, {
    props: { borrador, categorias: [categoriaAlimentacion, categoriaTransporte] },
  })
}

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe('PanelDetalleBorrador — banco editable con sugerencia por historial de comercio', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useAuthStore().establecerUsuario({ id: 'u1', email: 'a@a.com' } as never)
    useGastosStore().establecerBorradores([borradorFalso])
    useIngresosStore().establecerBancos([bancoUno, bancoDos])
  })

  it('CA1-a (camino feliz): regla con banco_id distinto al del borrador deja el select en el banco de la regla', async () => {
    mockearTablas({ regla: { usuario_id: 'u1', comercio: 'compra supermercado', categoria_id: 'c1', banco_id: 'banco-2', actualizado_en: '' } })

    const wrapper = montarPanel()
    await flushPromises()

    expect((wrapper.find('.entrada-banco-panel').element as HTMLSelectElement).value).toBe('banco-2')
  })

  it('CA1-b: sin regla previa, el select queda en el banco del borrador', async () => {
    mockearTablas({ regla: null })

    const wrapper = montarPanel()
    await flushPromises()

    expect((wrapper.find('.entrada-banco-panel').element as HTMLSelectElement).value).toBe('banco-1')
  })

  it('CA1-c (borde): regla con banco_id null (regla anterior a la migración 012) conserva el banco del borrador', async () => {
    mockearTablas({ regla: { usuario_id: 'u1', comercio: 'compra supermercado', categoria_id: 'c1', banco_id: null, actualizado_en: '' } })

    const wrapper = montarPanel()
    await flushPromises()

    expect((wrapper.find('.entrada-banco-panel').element as HTMLSelectElement).value).toBe('banco-1')
  })

  it('CA2: cambiar el select de banco deja el valor cambiado y NO dispara ningún UPDATE sobre gastos', async () => {
    const { builderGastos } = mockearTablas({ regla: null })

    const wrapper = montarPanel()
    await flushPromises()

    await wrapper.find('.entrada-banco-panel').setValue('banco-2')

    expect((wrapper.find('.entrada-banco-panel').element as HTMLSelectElement).value).toBe('banco-2')
    expect(builderGastos.update).not.toHaveBeenCalled()
  })

  it('CA5-a: cambiar el banco no altera el chip de categoría y el payload de confirmación conserva la categoria_id original', async () => {
    const { builderGastos } = mockearTablas({ regla: null })

    const wrapper = montarPanel()
    await flushPromises()

    await wrapper.find('.entrada-banco-panel').setValue('banco-2')
    expect(wrapper.find('.chip-categoria-tocable').text()).toContain('Alimentación')

    ;(builderGastos.single as Mock).mockResolvedValueOnce({
      data: { ...borradorFalso, banco_id: 'banco-2', estado: 'confirmado' },
      error: null,
    })

    await wrapper.find('.boton-confirmar').trigger('click')
    await flushPromises()

    expect(builderGastos.update).toHaveBeenCalledWith({
      categoria_id: 'c1',
      banco_id: 'banco-2',
      estado: 'confirmado',
    })
  })

  it('CA5-b: elegir otro chip de categoría no altera el valor del select de banco', async () => {
    mockearTablas({ regla: null })

    const wrapper = montarPanel()
    await flushPromises()

    await wrapper.find('.chip-categoria-tocable').trigger('click')
    const chipTransporte = wrapper.findAll('.chip-categoria').find((c) => c.text().includes('Transporte'))
    expect(chipTransporte).toBeTruthy()
    await chipTransporte!.trigger('click')

    expect((wrapper.find('.entrada-banco-panel').element as HTMLSelectElement).value).toBe('banco-1')
  })

  it('Borde-1: catálogo de bancos vacío deja el select disabled y confirmar manda el banco_id del borrador, nunca \'\'', async () => {
    useIngresosStore().establecerBancos([])
    const { builderGastos } = mockearTablas({ regla: null })

    const wrapper = montarPanel()
    await flushPromises()

    expect(wrapper.find('.entrada-banco-panel').attributes('disabled')).toBeDefined()

    ;(builderGastos.single as Mock).mockResolvedValueOnce({
      data: { ...borradorFalso, estado: 'confirmado' },
      error: null,
    })

    await wrapper.find('.boton-confirmar').trigger('click')
    await flushPromises()

    expect(builderGastos.update).toHaveBeenCalledWith({
      categoria_id: 'c1',
      banco_id: 'banco-1',
      estado: 'confirmado',
    })
  })

  it('Borde-2: borrador sin descripción no consulta reglas_comercio ni hace upsert, pero el banco cambiado a mano sí viaja en el UPDATE', async () => {
    const borradorSinDescripcion: Gasto = { ...borradorFalso, descripcion: null }
    useGastosStore().establecerBorradores([borradorSinDescripcion])
    const { builderReglas, builderGastos } = mockearTablas({ regla: null })

    const wrapper = montarPanel(borradorSinDescripcion)
    await flushPromises()

    expect(fromMock).not.toHaveBeenCalledWith('reglas_comercio')

    await wrapper.find('.entrada-banco-panel').setValue('banco-2')

    ;(builderGastos.single as Mock).mockResolvedValueOnce({
      data: { ...borradorSinDescripcion, banco_id: 'banco-2', estado: 'confirmado' },
      error: null,
    })

    await wrapper.find('.boton-confirmar').trigger('click')
    await flushPromises()

    expect(builderGastos.update).toHaveBeenCalledWith({
      categoria_id: 'c1',
      banco_id: 'banco-2',
      estado: 'confirmado',
    })
    expect(builderReglas.upsert).not.toHaveBeenCalled()
  })

  it('Borde-3: un borrador revision_manual con monto/moneda completados a mano confirma con monto, moneda, categoria_id y banco_id en el mismo UPDATE', async () => {
    const borradorRevision: Gasto = {
      ...borradorFalso,
      monto: null,
      moneda: null,
      estado: 'revision_manual',
    }
    useGastosStore().establecerBorradores([borradorRevision])
    const { builderGastos } = mockearTablas({ regla: null })

    const wrapper = montarPanel(borradorRevision)
    await flushPromises()

    await wrapper.find('input[type="text"][inputmode="decimal"]').setValue('30')
    await wrapper.findAll('button').find((b) => b.text() === 'USD')!.trigger('click')
    await wrapper.find('.entrada-banco-panel').setValue('banco-2')

    ;(builderGastos.single as Mock).mockResolvedValueOnce({
      data: { ...borradorRevision, monto: 30, moneda: 'USD', banco_id: 'banco-2', estado: 'confirmado' },
      error: null,
    })

    await wrapper.find('.boton-confirmar').trigger('click')
    await flushPromises()

    expect(builderGastos.update).toHaveBeenCalledWith({
      categoria_id: 'c1',
      monto: 30,
      moneda: 'USD',
      banco_id: 'banco-2',
      estado: 'confirmado',
    })
  })
})
