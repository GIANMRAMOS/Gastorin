import { beforeEach, describe, expect, it, type Mock } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useGastos } from '@/composables/useGastos'
import { useGastosStore } from '@/stores/gastos'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabaseClient'
import { crearConstructorConsulta } from '@/lib/__mocks__/supabaseClient'
import type { Gasto, GastoInput } from '@/types/gasto'

/**
 * `supabase.from` viene del mock manual (`vi.mock('@/lib/supabaseClient')` en
 * `src/test/setup.ts`). Cada test que necesita controlar la respuesta final
 * de una cadena (`.select().eq().order()`, `.insert().select().single()`, etc.)
 * crea su propio builder con `crearConstructorConsulta()`, lo devuelve una vez
 * con `from.mockReturnValueOnce(builder)` y sobreescribe el método que cierra
 * la cadena con `mockResolvedValueOnce({ data, error })`.
 */
const fromMock = supabase.from as unknown as Mock

const gastoBase: Gasto = {
  id: 'g1',
  usuario_id: 'u1',
  categoria_id: 'c1',
  monto: 10,
  moneda: 'PEN',
  fecha: '2026-07-01',
  descripcion: null,
  origen: 'manual',
  estado: 'confirmado',
  gmail_message_id: null,
  gmail_fragmento: null,
  creado_en: '2026-07-01T00:00:00Z',
  actualizado_en: '2026-07-01T00:00:00Z',
}

describe('useGastos', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('cargarGastos', () => {
    it('camino feliz: carga los gastos ordenados por fecha descendente', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.order as Mock).mockResolvedValueOnce({ data: [gastoBase], error: null })

      const { cargarGastos } = useGastos()
      const store = useGastosStore()
      const exito = await cargarGastos()

      expect(exito).toBe(true)
      expect(fromMock).toHaveBeenCalledWith('gastos')
      // Filtra a confirmados: los borradores de correo viven en `useBandeja`
      // y no deben aparecer en el Historial (ver `useBandeja.spec.ts`).
      expect(builder.eq).toHaveBeenCalledWith('estado', 'confirmado')
      expect(builder.order).toHaveBeenCalledWith('fecha', { ascending: false })
      expect(store.gastos).toEqual([gastoBase])
    })

    it('borde: error de Supabase no deja la lista a medias y setea el mensaje', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.order as Mock).mockResolvedValueOnce({
        data: null,
        error: { message: 'boom' },
      })

      const { cargarGastos } = useGastos()
      const store = useGastosStore()
      const exito = await cargarGastos()

      expect(exito).toBe(false)
      expect(store.error).toBe('No se pudieron cargar los gastos.')
      expect(store.gastos).toEqual([])
    })
  })

  describe('crearGasto', () => {
    it('camino feliz: inserta con usuario_id explícito, origen manual y estado confirmado', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      const gastoCreado: Gasto = { ...gastoBase, id: 'g2', moneda: 'USD', monto: 45.5 }
      ;(builder.single as Mock).mockResolvedValueOnce({ data: gastoCreado, error: null })

      const authStore = useAuthStore()
      authStore.establecerUsuario({ id: 'u1', email: 'a@a.com' } as never)

      const { crearGasto } = useGastos()
      const store = useGastosStore()
      const input: GastoInput = {
        monto: 45.5,
        moneda: 'USD',
        categoria_id: 'c1',
        fecha: '2026-07-20',
        descripcion: null,
      }
      const exito = await crearGasto(input)

      expect(exito).toBe(true)
      expect(fromMock).toHaveBeenCalledWith('gastos')
      // La policy RLS `with check (usuario_id = auth.uid())` exige enviar el
      // usuario_id explícito: se toma del store de auth, no se autocompleta.
      expect(builder.insert).toHaveBeenCalledWith({
        ...input,
        usuario_id: 'u1',
        origen: 'manual',
        estado: 'confirmado',
      })
      expect(store.gastos[0]).toEqual(gastoCreado)
      expect(store.cargando).toBe(false)
      expect(store.error).toBeNull()
    })

    it('borde: sin sesión activa NO llama a Supabase y devuelve un error claro', async () => {
      const authStore = useAuthStore()
      authStore.establecerUsuario(null)

      const { crearGasto } = useGastos()
      const store = useGastosStore()
      const exito = await crearGasto({
        monto: 10,
        moneda: 'PEN',
        categoria_id: 'c1',
        fecha: '2026-07-20',
        descripcion: null,
      })

      expect(exito).toBe(false)
      expect(store.error).toBe('No hay una sesión activa. Vuelve a iniciar sesión.')
      expect(fromMock).not.toHaveBeenCalled()
      expect(store.gastos).toHaveLength(0)
      expect(store.cargando).toBe(false)
    })

    it('borde: error de Supabase/RLS al insertar no agrega el gasto y deja mensaje en español', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.single as Mock).mockResolvedValueOnce({
        data: null,
        error: { message: 'new row violates row-level security policy' },
      })

      const authStore = useAuthStore()
      authStore.establecerUsuario({ id: 'u1', email: 'a@a.com' } as never)

      const { crearGasto } = useGastos()
      const store = useGastosStore()
      const exito = await crearGasto({
        monto: 10,
        moneda: 'PEN',
        categoria_id: 'c1',
        fecha: '2026-07-20',
        descripcion: null,
      })

      expect(exito).toBe(false)
      expect(store.error).toBe('No se pudo guardar el gasto.')
      expect(store.gastos).toHaveLength(0)
      expect(store.cargando).toBe(false)
    })
  })

  describe('editarGasto', () => {
    it('camino feliz: gasto manual — actualiza todos los campos enviados y reemplaza el gasto en el store', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      const gastoActualizado: Gasto = {
        ...gastoBase,
        monto: 99,
        moneda: 'USD',
        categoria_id: 'c2',
        fecha: '2026-07-21',
        descripcion: 'actualizado',
      }
      ;(builder.single as Mock).mockResolvedValueOnce({ data: gastoActualizado, error: null })

      const store = useGastosStore()
      store.agregarGasto(gastoBase)

      const { editarGasto } = useGastos()
      const input: GastoInput = {
        monto: 99,
        moneda: 'USD',
        categoria_id: 'c2',
        fecha: '2026-07-21',
        descripcion: 'actualizado',
      }
      const exito = await editarGasto('g1', input)

      expect(exito).toBe(true)
      expect(builder.update).toHaveBeenCalledWith(input)
      expect(builder.eq).toHaveBeenCalledWith('id', 'g1')
      expect(store.gastos[0]).toEqual(gastoActualizado)
    })

    it('borde: gasto origen correo — el payload enviado NO incluye monto ni fecha', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      const gastoCorreo: Gasto = {
        ...gastoBase,
        id: 'g3',
        origen: 'correo',
        categoria_id: 'c3',
        descripcion: 'actualizado desde correo',
      }
      ;(builder.single as Mock).mockResolvedValueOnce({ data: gastoCorreo, error: null })

      const store = useGastosStore()
      store.agregarGasto({ ...gastoBase, id: 'g3', origen: 'correo' })

      const { editarGasto } = useGastos()
      // El formulario (FormularioGasto) es responsable de omitir monto/fecha
      // para origen='correo'; aquí se verifica que el composable respeta el
      // payload parcial recibido sin añadir esos campos por su cuenta.
      const exito = await editarGasto('g3', {
        categoria_id: 'c3',
        descripcion: 'actualizado desde correo',
      })

      expect(exito).toBe(true)
      expect(builder.update).toHaveBeenCalledWith({
        categoria_id: 'c3',
        descripcion: 'actualizado desde correo',
      })
      expect(builder.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ monto: expect.anything() }),
      )
      expect(builder.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ fecha: expect.anything() }),
      )
    })

    it('borde: error de Supabase al actualizar deja mensaje en español y no toca el store', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.single as Mock).mockResolvedValueOnce({
        data: null,
        error: { message: 'boom' },
      })

      const store = useGastosStore()
      store.agregarGasto(gastoBase)

      const { editarGasto } = useGastos()
      const exito = await editarGasto('g1', { descripcion: 'no debería aplicarse' })

      expect(exito).toBe(false)
      expect(store.error).toBe('No se pudo actualizar el gasto.')
      expect(store.gastos[0]).toEqual(gastoBase)
    })
  })

  describe('eliminarGasto', () => {
    it('camino feliz: elimina por id y quita el gasto del store', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.eq as Mock).mockResolvedValueOnce({ error: null })

      const store = useGastosStore()
      store.agregarGasto(gastoBase)

      const { eliminarGasto } = useGastos()
      const exito = await eliminarGasto('g1')

      expect(exito).toBe(true)
      expect(fromMock).toHaveBeenCalledWith('gastos')
      expect(builder.delete).toHaveBeenCalled()
      expect(builder.eq).toHaveBeenCalledWith('id', 'g1')
      expect(store.gastos).toHaveLength(0)
    })

    it('borde: error de Supabase al eliminar deja el gasto en el store y setea el mensaje', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.eq as Mock).mockResolvedValueOnce({ error: { message: 'boom' } })

      const store = useGastosStore()
      store.agregarGasto(gastoBase)

      const { eliminarGasto } = useGastos()
      const exito = await eliminarGasto('g1')

      expect(exito).toBe(false)
      expect(store.error).toBe('No se pudo eliminar el gasto.')
      expect(store.gastos).toHaveLength(1)
    })
  })
})
