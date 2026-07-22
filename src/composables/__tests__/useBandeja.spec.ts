import { beforeEach, describe, expect, it, type Mock } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useBandeja } from '@/composables/useBandeja'
import { useGastosStore } from '@/stores/gastos'
import { supabase } from '@/lib/supabaseClient'
import { crearConstructorConsulta } from '@/lib/__mocks__/supabaseClient'
import type { Gasto } from '@/types/gasto'

/**
 * `supabase.from` viene del mock manual (`vi.mock('@/lib/supabaseClient')` en
 * `src/test/setup.ts`). Ver `useCategorias.spec.ts` para el patrón de mockeo.
 */
const fromMock = supabase.from as unknown as Mock

const borradorBase: Gasto = {
  id: 'b1',
  usuario_id: 'u1',
  categoria_id: 'c1',
  monto: 45.5,
  moneda: 'PEN',
  fecha: '2026-07-20',
  descripcion: null,
  origen: 'correo',
  estado: 'borrador',
  gmail_message_id: 'msg-1',
  gmail_fragmento: 'BCP: compra por S/ 45.50',
  creado_en: '2026-07-20T00:00:00Z',
  actualizado_en: '2026-07-20T00:00:00Z',
}

const borradorRevisionManual: Gasto = {
  ...borradorBase,
  id: 'b2',
  monto: null,
  moneda: null,
  estado: 'revision_manual',
}

describe('useBandeja', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('cargarBorradores', () => {
    it('camino feliz: carga borradores y revisión manual, más recientes primero, y los guarda en el store', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.order as Mock).mockResolvedValueOnce({
        data: [borradorBase, borradorRevisionManual],
        error: null,
      })

      const { cargarBorradores } = useBandeja()
      const store = useGastosStore()
      const exito = await cargarBorradores()

      expect(exito).toBe(true)
      expect(fromMock).toHaveBeenCalledWith('gastos')
      expect(builder.in).toHaveBeenCalledWith('estado', ['borrador', 'revision_manual'])
      expect(builder.order).toHaveBeenCalledWith('fecha', { ascending: false })
      expect(store.borradores).toEqual([borradorBase, borradorRevisionManual])
    })

    it('borde: un array vacío NO es un error (bandeja al día)', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.order as Mock).mockResolvedValueOnce({ data: [], error: null })

      const { cargarBorradores } = useBandeja()
      const store = useGastosStore()
      const exito = await cargarBorradores()

      expect(exito).toBe(true)
      expect(store.borradores).toEqual([])
    })

    it('borde: error de Supabase deja un mensaje en español', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.order as Mock).mockResolvedValueOnce({ data: null, error: { message: 'boom' } })

      const { cargarBorradores } = useBandeja()
      const store = useGastosStore()
      const exito = await cargarBorradores()

      expect(exito).toBe(false)
      expect(store.error).toBe('No se pudieron cargar los gastos por confirmar.')
    })
  })

  describe('confirmarBorrador', () => {
    it('camino feliz: un borrador normal se confirma con UPDATE (no INSERT), sale de la bandeja y entra a gastos', async () => {
      const store = useGastosStore()
      store.establecerBorradores([borradorBase])

      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      const gastoConfirmado = { ...borradorBase, estado: 'confirmado' as const }
      ;(builder.single as Mock).mockResolvedValueOnce({ data: gastoConfirmado, error: null })

      const { confirmarBorrador } = useBandeja()
      const exito = await confirmarBorrador('b1')

      expect(exito).toBe(true)
      expect(fromMock).toHaveBeenCalledWith('gastos')
      expect(builder.update).toHaveBeenCalledWith({ estado: 'confirmado' })
      expect(builder.eq).toHaveBeenCalledWith('id', 'b1')
      expect(store.borradores).toEqual([])
      expect(store.gastos).toEqual([gastoConfirmado])
    })

    it('borde: revisión manual sin monto/moneda completos NO llama a Supabase y devuelve error', async () => {
      const store = useGastosStore()
      store.establecerBorradores([borradorRevisionManual])

      const { confirmarBorrador } = useBandeja()
      const exito = await confirmarBorrador('b2')

      expect(exito).toBe(false)
      expect(store.error).toBe('Completa el monto y la moneda antes de confirmar.')
      expect(fromMock).not.toHaveBeenCalled()
      expect(store.borradores).toEqual([borradorRevisionManual])
    })

    it('camino feliz: revisión manual con los datos completados en el payload sí se confirma', async () => {
      const store = useGastosStore()
      store.establecerBorradores([borradorRevisionManual])

      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      const gastoConfirmado = { ...borradorRevisionManual, monto: 30, moneda: 'USD' as const, estado: 'confirmado' as const }
      ;(builder.single as Mock).mockResolvedValueOnce({ data: gastoConfirmado, error: null })

      const { confirmarBorrador } = useBandeja()
      const exito = await confirmarBorrador('b2', { monto: 30, moneda: 'USD' })

      expect(exito).toBe(true)
      expect(builder.update).toHaveBeenCalledWith({ monto: 30, moneda: 'USD', estado: 'confirmado' })
      expect(store.borradores).toEqual([])
    })

    it('borde: borrador que ya no está en la bandeja no llama a Supabase', async () => {
      const { confirmarBorrador } = useBandeja()
      const store = useGastosStore()
      const exito = await confirmarBorrador('inexistente')

      expect(exito).toBe(false)
      expect(store.error).toBe('El gasto ya no está en la bandeja.')
      expect(fromMock).not.toHaveBeenCalled()
    })

    it('borde: error de Supabase deja el borrador en la bandeja y setea el mensaje', async () => {
      const store = useGastosStore()
      store.establecerBorradores([borradorBase])

      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.single as Mock).mockResolvedValueOnce({ data: null, error: { message: 'boom' } })

      const { confirmarBorrador } = useBandeja()
      const exito = await confirmarBorrador('b1')

      expect(exito).toBe(false)
      expect(store.error).toBe('No se pudo confirmar el gasto.')
      expect(store.borradores).toEqual([borradorBase])
    })

    // --- Verificación INDEPENDIENTE (QA) del bloqueo en revisión manual a
    // nivel de composable, no solo de UI: reproduce el patrón del bug real de
    // la Épica 4 (confiar solo en que la plantilla deshabilite el botón).
    // Aquí se llama a `confirmarBorrador` directamente, sin pasar por
    // ninguna plantilla/`:disabled`, simulando un caller que se salte la UI
    // (ej. una tecla de atajo, un doble clic que dispare el handler antes de
    // que Vue re-renderice el `disabled`, o un test end-to-end que dispare el
    // evento programáticamente).
    it('QA-borde: revisión manual con SOLO el monto completado (falta moneda) sigue bloqueada a nivel de composable', async () => {
      const store = useGastosStore()
      store.establecerBorradores([borradorRevisionManual])

      const { confirmarBorrador } = useBandeja()
      const exito = await confirmarBorrador('b2', { monto: 30 })

      expect(exito).toBe(false)
      expect(store.error).toBe('Completa el monto y la moneda antes de confirmar.')
      expect(fromMock).not.toHaveBeenCalled()
      expect(store.borradores).toEqual([borradorRevisionManual])
    })

    it('QA-borde: revisión manual con SOLO la moneda completada (falta monto) sigue bloqueada a nivel de composable', async () => {
      const store = useGastosStore()
      store.establecerBorradores([borradorRevisionManual])

      const { confirmarBorrador } = useBandeja()
      const exito = await confirmarBorrador('b2', { moneda: 'USD' })

      expect(exito).toBe(false)
      expect(store.error).toBe('Completa el monto y la moneda antes de confirmar.')
      expect(fromMock).not.toHaveBeenCalled()
    })

    it('QA-borde: un borrador NORMAL (no revisión manual) que ya trae monto/moneda de la fila no requiere `datosCompletar` para confirmarse', async () => {
      const store = useGastosStore()
      store.establecerBorradores([borradorBase])
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.single as Mock).mockResolvedValueOnce({
        data: { ...borradorBase, estado: 'confirmado' },
        error: null,
      })

      const { confirmarBorrador } = useBandeja()
      const exito = await confirmarBorrador('b1')

      expect(exito).toBe(true)
      expect(fromMock).toHaveBeenCalled()
    })
  })

  describe('descartarBorrador', () => {
    it('camino feliz: marca estado=descartado (soft-delete) y quita el borrador de la bandeja', async () => {
      const store = useGastosStore()
      store.establecerBorradores([borradorBase])

      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.eq as Mock).mockResolvedValueOnce({ error: null })

      const { descartarBorrador } = useBandeja()
      const exito = await descartarBorrador('b1')

      expect(exito).toBe(true)
      expect(builder.update).toHaveBeenCalledWith({ estado: 'descartado' })
      expect(builder.eq).toHaveBeenCalledWith('id', 'b1')
      expect(store.borradores).toEqual([])
    })

    it('borde: error de Supabase deja el borrador en la bandeja', async () => {
      const store = useGastosStore()
      store.establecerBorradores([borradorBase])

      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.eq as Mock).mockResolvedValueOnce({ error: { message: 'boom' } })

      const { descartarBorrador } = useBandeja()
      const exito = await descartarBorrador('b1')

      expect(exito).toBe(false)
      expect(store.error).toBe('No se pudo descartar el gasto.')
      expect(store.borradores).toEqual([borradorBase])
    })
  })

  describe('editarCategoriaBorrador', () => {
    it('camino feliz: actualiza la categoría y reemplaza el borrador en el store sin sacarlo de la bandeja', async () => {
      const store = useGastosStore()
      store.establecerBorradores([borradorBase])

      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      const borradorActualizado = { ...borradorBase, categoria_id: 'c2' }
      ;(builder.single as Mock).mockResolvedValueOnce({ data: borradorActualizado, error: null })

      const { editarCategoriaBorrador } = useBandeja()
      const exito = await editarCategoriaBorrador('b1', 'c2')

      expect(exito).toBe(true)
      expect(builder.update).toHaveBeenCalledWith({ categoria_id: 'c2' })
      expect(store.borradores).toEqual([borradorActualizado])
    })

    it('borde: error de Supabase no toca el store', async () => {
      const store = useGastosStore()
      store.establecerBorradores([borradorBase])

      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.single as Mock).mockResolvedValueOnce({ data: null, error: { message: 'boom' } })

      const { editarCategoriaBorrador } = useBandeja()
      const exito = await editarCategoriaBorrador('b1', 'c2')

      expect(exito).toBe(false)
      expect(store.error).toBe('No se pudo actualizar la categoría del gasto.')
      expect(store.borradores).toEqual([borradorBase])
    })
  })
})
