import { beforeEach, describe, expect, it, type Mock } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { calcularGastado, usePresupuestos } from '@/composables/usePresupuestos'
import { useGastosStore } from '@/stores/gastos'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabaseClient'
import { crearConstructorConsulta } from '@/lib/__mocks__/supabaseClient'
import type { Gasto, Presupuesto } from '@/types/gasto'

/**
 * `supabase.from` viene del mock manual (`vi.mock('@/lib/supabaseClient')` en
 * `src/test/setup.ts`). Ver `useCategorias.spec.ts` para el patrón de mockeo.
 */
const fromMock = supabase.from as unknown as Mock

const presupuestoBase: Presupuesto = {
  id: 'p1',
  usuario_id: 'u1',
  categoria_id: 'c1',
  mes: '2026-07-01',
  moneda: 'PEN',
  monto_limite: 500,
  creado_en: '2026-07-01T00:00:00Z',
}

function gastoDe(datos: Partial<Gasto>): Gasto {
  return {
    id: 'g1',
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

describe('usePresupuestos', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('cargarPresupuestos', () => {
    it('camino feliz: filtra por el mes actual y guarda los presupuestos en el store', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.eq as Mock).mockResolvedValueOnce({ data: [presupuestoBase], error: null })

      const { cargarPresupuestos } = usePresupuestos()
      const store = useGastosStore()
      const exito = await cargarPresupuestos()

      expect(exito).toBe(true)
      expect(fromMock).toHaveBeenCalledWith('presupuestos')
      const mesEsperado = `${new Date().toISOString().slice(0, 7)}-01`
      expect(builder.eq).toHaveBeenCalledWith('mes', mesEsperado)
      expect(store.presupuestos).toEqual([presupuestoBase])
    })

    it('borde: un array vacío NO es un error', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.eq as Mock).mockResolvedValueOnce({ data: [], error: null })

      const { cargarPresupuestos } = usePresupuestos()
      const store = useGastosStore()
      const exito = await cargarPresupuestos()

      expect(exito).toBe(true)
      expect(store.presupuestos).toEqual([])
    })

    it('borde: error de Supabase deja un mensaje en español', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.eq as Mock).mockResolvedValueOnce({ data: null, error: { message: 'boom' } })

      const { cargarPresupuestos } = usePresupuestos()
      const store = useGastosStore()
      const exito = await cargarPresupuestos()

      expect(exito).toBe(false)
      expect(store.error).toBe('No se pudieron cargar los presupuestos.')
    })
  })

  describe('crearPresupuesto', () => {
    it('camino feliz: inserta con usuario_id y mes día-1 del mes actual, y agrega al store', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.single as Mock).mockResolvedValueOnce({ data: presupuestoBase, error: null })

      const authStore = useAuthStore()
      authStore.establecerUsuario({ id: 'u1', email: 'a@a.com' } as never)

      const { crearPresupuesto } = usePresupuestos()
      const store = useGastosStore()
      const exito = await crearPresupuesto({ categoria_id: 'c1', moneda: 'PEN', monto_limite: 500 })

      expect(exito).toBe(true)
      const mesEsperado = `${new Date().toISOString().slice(0, 7)}-01`
      expect(builder.insert).toHaveBeenCalledWith({
        usuario_id: 'u1',
        categoria_id: 'c1',
        moneda: 'PEN',
        monto_limite: 500,
        mes: mesEsperado,
      })
      expect(store.presupuestos).toEqual([presupuestoBase])
    })

    it('borde: violación de unicidad (23505) muestra el mensaje esperado y no agrega el presupuesto', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.single as Mock).mockResolvedValueOnce({
        data: null,
        error: { code: '23505', message: 'duplicate key value violates unique constraint' },
      })

      const authStore = useAuthStore()
      authStore.establecerUsuario({ id: 'u1', email: 'a@a.com' } as never)

      const { crearPresupuesto } = usePresupuestos()
      const store = useGastosStore()
      const exito = await crearPresupuesto({ categoria_id: 'c1', moneda: 'PEN', monto_limite: 500 })

      expect(exito).toBe(false)
      expect(store.error).toBe('Ya existe un presupuesto para esa categoría, mes y moneda.')
      expect(store.presupuestos).toEqual([])
    })

    it('borde: sin sesión activa NO llama a Supabase', async () => {
      const authStore = useAuthStore()
      authStore.establecerUsuario(null)

      const { crearPresupuesto } = usePresupuestos()
      const store = useGastosStore()
      const exito = await crearPresupuesto({ categoria_id: 'c1', moneda: 'PEN', monto_limite: 500 })

      expect(exito).toBe(false)
      expect(store.error).toBe('No hay una sesión activa. Vuelve a iniciar sesión.')
      expect(fromMock).not.toHaveBeenCalled()
    })
  })

  describe('editarPresupuesto', () => {
    it('camino feliz: actualiza monto_limite y reemplaza el presupuesto en el store', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      const presupuestoEditado = { ...presupuestoBase, monto_limite: 800 }
      ;(builder.single as Mock).mockResolvedValueOnce({ data: presupuestoEditado, error: null })

      const store = useGastosStore()
      store.establecerPresupuestos([presupuestoBase])

      const { editarPresupuesto } = usePresupuestos()
      const exito = await editarPresupuesto('p1', 800)

      expect(exito).toBe(true)
      expect(builder.update).toHaveBeenCalledWith({ monto_limite: 800 })
      expect(builder.eq).toHaveBeenCalledWith('id', 'p1')
      expect(store.presupuestos).toEqual([presupuestoEditado])
    })
  })

  describe('eliminarPresupuesto', () => {
    it('camino feliz: elimina por id y quita el presupuesto del store', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.eq as Mock).mockResolvedValueOnce({ error: null })

      const store = useGastosStore()
      store.establecerPresupuestos([presupuestoBase])

      const { eliminarPresupuesto } = usePresupuestos()
      const exito = await eliminarPresupuesto('p1')

      expect(exito).toBe(true)
      expect(builder.delete).toHaveBeenCalled()
      expect(builder.eq).toHaveBeenCalledWith('id', 'p1')
      expect(store.presupuestos).toEqual([])
    })

    it('borde: error de Supabase no toca el store', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.eq as Mock).mockResolvedValueOnce({ error: { message: 'boom' } })

      const store = useGastosStore()
      store.establecerPresupuestos([presupuestoBase])

      const { eliminarPresupuesto } = usePresupuestos()
      const exito = await eliminarPresupuesto('p1')

      expect(exito).toBe(false)
      expect(store.error).toBe('No se pudo eliminar el presupuesto.')
      expect(store.presupuestos).toEqual([presupuestoBase])
    })
  })

  describe('calcularGastado', () => {
    it('camino feliz: suma solo los gastos confirmados de la misma categoría, moneda y mes', () => {
      const gastos = [
        gastoDe({ id: 'g1', monto: 100 }),
        gastoDe({ id: 'g2', monto: 50 }),
      ]

      expect(calcularGastado(gastos, presupuestoBase)).toBe(150)
    })

    it('ignora gastos de otra categoría', () => {
      const gastos = [gastoDe({ categoria_id: 'otra' })]

      expect(calcularGastado(gastos, presupuestoBase)).toBe(0)
    })

    it('ignora gastos de otra moneda', () => {
      const gastos = [gastoDe({ moneda: 'USD' })]

      expect(calcularGastado(gastos, presupuestoBase)).toBe(0)
    })

    it('ignora gastos de otro mes', () => {
      const gastos = [gastoDe({ fecha: '2026-06-30' })]

      expect(calcularGastado(gastos, presupuestoBase)).toBe(0)
    })

    it('borde: lista vacía devuelve 0', () => {
      expect(calcularGastado([], presupuestoBase)).toBe(0)
    })
  })
})
