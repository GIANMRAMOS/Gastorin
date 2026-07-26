import { beforeEach, describe, expect, it, type Mock } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useIngresos } from '@/composables/useIngresos'
import { useIngresosStore } from '@/stores/ingresos'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabaseClient'
import { crearConstructorConsulta } from '@/lib/__mocks__/supabaseClient'
import type { Ingreso, IngresoInput } from '@/types/ingreso'

const fromMock = supabase.from as unknown as Mock

const inputBase: IngresoInput = {
  banco_id: 'b1',
  categoria_id: 'ci1',
  fecha: '2026-07-10',
  moneda: 'PEN',
  importe: 100,
  concepto: 'Sueldo',
}

const ingresoBase: Ingreso = {
  id: 'i1',
  usuario_id: 'u1',
  banco_id: 'b1',
  categoria_id: 'ci1',
  fecha: '2026-07-10',
  moneda: 'PEN',
  importe: 100,
  concepto: 'Sueldo',
  created_at: '',
}

describe('useIngresos (HU-11.2 / HU-11.3)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('cargarIngresos (HU-11.3)', () => {
    it('camino feliz: consulta ordenada por fecha de registro descendente y guarda el resultado en el store', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      const ingresosFalsos = [ingresoBase, { ...ingresoBase, id: 'i2', fecha: '2026-07-01' }]
      ;(builder.order as Mock).mockResolvedValueOnce({ data: ingresosFalsos, error: null })

      const { cargarIngresos } = useIngresos()
      const store = useIngresosStore()
      const exito = await cargarIngresos()

      expect(exito).toBe(true)
      expect(fromMock).toHaveBeenCalledWith('ingresos')
      expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false })
      expect(store.ingresos).toEqual(ingresosFalsos)
      expect(store.error).toBeNull()
    })

    it('borde: un array vacío NO es un error (usuario sin ingresos todavía)', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.order as Mock).mockResolvedValueOnce({ data: [], error: null })

      const { cargarIngresos } = useIngresos()
      const store = useIngresosStore()
      const exito = await cargarIngresos()

      expect(exito).toBe(true)
      expect(store.ingresos).toEqual([])
      expect(store.error).toBeNull()
    })

    it('borde: error de Supabase deja un mensaje en español y cargando vuelve a false', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.order as Mock).mockResolvedValueOnce({ data: null, error: { message: 'boom' } })

      const { cargarIngresos } = useIngresos()
      const store = useIngresosStore()
      const exito = await cargarIngresos()

      expect(exito).toBe(false)
      expect(store.error).toBe('No se pudieron cargar los ingresos.')
      expect(store.ingresos).toEqual([])
      expect(store.cargando).toBe(false)
    })
  })

  describe('crearIngreso (HU-11.2)', () => {
    it('camino feliz: inserta con usuario_id explícito y agrega el ingreso al store', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      const ingresoCreado = { ...ingresoBase, id: 'i-nuevo' }
      ;(builder.single as Mock).mockResolvedValueOnce({ data: ingresoCreado, error: null })

      const authStore = useAuthStore()
      authStore.establecerUsuario({ id: 'u1', email: 'a@a.com' } as never)

      const { crearIngreso } = useIngresos()
      const store = useIngresosStore()
      const exito = await crearIngreso(inputBase)

      expect(exito).toBe(true)
      expect(fromMock).toHaveBeenCalledWith('ingresos')
      expect(builder.insert).toHaveBeenCalledWith({ ...inputBase, usuario_id: 'u1' })
      expect(store.ingresos).toEqual([ingresoCreado])
      expect(store.error).toBeNull()
    })

    it('borde Gherkin — importe = 0: el CHECK de la BD lo rechazaría, pero la última línea de defensa (Postgres) tampoco expone su error crudo', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.single as Mock).mockResolvedValueOnce({
        data: null,
        error: { code: '23514', message: 'new row for relation "ingresos" violates check constraint' },
      })

      const authStore = useAuthStore()
      authStore.establecerUsuario({ id: 'u1', email: 'a@a.com' } as never)

      const { crearIngreso } = useIngresos()
      const store = useIngresosStore()
      const exito = await crearIngreso({ ...inputBase, importe: 0 })

      expect(exito).toBe(false)
      expect(store.error).toBe('No se pudo guardar el ingreso.')
      expect(store.ingresos).toEqual([])
    })

    it('camino feliz — importe negativo: la BD ahora lo acepta (CHECK importe <> 0), el composable inserta y agrega al store', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      const ingresoCreado = { ...ingresoBase, importe: -50 }
      ;(builder.single as Mock).mockResolvedValueOnce({ data: ingresoCreado, error: null })

      const authStore = useAuthStore()
      authStore.establecerUsuario({ id: 'u1', email: 'a@a.com' } as never)

      const { crearIngreso } = useIngresos()
      const store = useIngresosStore()
      const exito = await crearIngreso({ ...inputBase, importe: -50 })

      expect(exito).toBe(true)
      expect(builder.insert).toHaveBeenCalledWith({ ...inputBase, importe: -50, usuario_id: 'u1' })
      expect(store.ingresos).toEqual([ingresoCreado])
      expect(store.error).toBeNull()
    })

    it('borde: payload sin banco_id (vacío) igual llega al insert tal cual — la validación de bloqueo real vive en FormularioIngreso, no aquí', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.single as Mock).mockResolvedValueOnce({
        data: null,
        error: { code: '23502', message: 'null value in column "banco_id" violates not-null constraint' },
      })

      const authStore = useAuthStore()
      authStore.establecerUsuario({ id: 'u1', email: 'a@a.com' } as never)

      const { crearIngreso } = useIngresos()
      const store = useIngresosStore()
      const exito = await crearIngreso({ ...inputBase, banco_id: '' })

      expect(exito).toBe(false)
      expect(builder.insert).toHaveBeenCalledWith({ ...inputBase, banco_id: '', usuario_id: 'u1' })
      expect(store.error).toBe('No se pudo guardar el ingreso.')
    })

    it('borde: payload sin concepto (vacío) traduce el error de la BD sin exponerlo crudo', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.single as Mock).mockResolvedValueOnce({
        data: null,
        error: { code: '23502', message: 'null value in column "concepto" violates not-null constraint' },
      })

      const authStore = useAuthStore()
      authStore.establecerUsuario({ id: 'u1', email: 'a@a.com' } as never)

      const { crearIngreso } = useIngresos()
      const store = useIngresosStore()
      const exito = await crearIngreso({ ...inputBase, concepto: '' })

      expect(exito).toBe(false)
      expect(store.error).toBe('No se pudo guardar el ingreso.')
      expect(store.error).not.toContain('constraint')
    })

    it('borde: sin sesión activa NO llama a Supabase y devuelve un error claro', async () => {
      const authStore = useAuthStore()
      authStore.establecerUsuario(null)

      const { crearIngreso } = useIngresos()
      const store = useIngresosStore()
      const exito = await crearIngreso(inputBase)

      expect(exito).toBe(false)
      expect(store.error).toBe('No hay una sesión activa. Vuelve a iniciar sesión.')
      expect(fromMock).not.toHaveBeenCalled()
      expect(store.ingresos).toEqual([])
    })
  })

  describe('editarIngreso (HU-11.3)', () => {
    it('camino feliz: actualiza por id y reemplaza el ingreso en el store', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      const ingresoActualizado: Ingreso = {
        ...ingresoBase,
        importe: 250,
        concepto: 'Bono',
        fecha: '2026-07-15',
      }
      ;(builder.single as Mock).mockResolvedValueOnce({ data: ingresoActualizado, error: null })

      const store = useIngresosStore()
      store.agregarIngreso(ingresoBase)

      const { editarIngreso } = useIngresos()
      const input: IngresoInput = {
        banco_id: 'b1',
        categoria_id: 'ci1',
        fecha: '2026-07-15',
        moneda: 'PEN',
        importe: 250,
        concepto: 'Bono',
      }
      const exito = await editarIngreso('i1', input)

      expect(exito).toBe(true)
      expect(builder.update).toHaveBeenCalledWith(input)
      expect(builder.eq).toHaveBeenCalledWith('id', 'i1')
      expect(store.ingresos[0]).toEqual(ingresoActualizado)
      expect(store.error).toBeNull()
    })

    it('borde: error de Supabase al actualizar deja mensaje en español y no toca el store', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.single as Mock).mockResolvedValueOnce({
        data: null,
        error: { message: 'boom' },
      })

      const store = useIngresosStore()
      store.agregarIngreso(ingresoBase)

      const { editarIngreso } = useIngresos()
      const exito = await editarIngreso('i1', { concepto: 'no debería aplicarse' })

      expect(exito).toBe(false)
      expect(store.error).toBe('No se pudo actualizar el ingreso.')
      expect(store.ingresos[0]).toEqual(ingresoBase)
    })

    it('regresión HU-18.1: editar un ingreso en medio del listado conserva su posición (no salta al tope)', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      const ingresoEditado: Ingreso = { ...ingresoBase, id: 'i2', importe: 500, concepto: 'editado' }
      ;(builder.single as Mock).mockResolvedValueOnce({ data: ingresoEditado, error: null })

      const store = useIngresosStore()
      // El orden del store lo fija `created_at` desc (ver `cargarIngresos`);
      // se simula ese orden ya establecido con 3 ingresos y se edita el del medio.
      store.agregarIngreso({ ...ingresoBase, id: 'i3' })
      store.agregarIngreso({ ...ingresoBase, id: 'i2' })
      store.agregarIngreso({ ...ingresoBase, id: 'i1' })
      expect(store.ingresos.map((i) => i.id)).toEqual(['i1', 'i2', 'i3'])

      const { editarIngreso } = useIngresos()
      const input: IngresoInput = {
        banco_id: 'b1',
        categoria_id: 'ci1',
        fecha: '2026-07-10',
        moneda: 'PEN',
        importe: 500,
        concepto: 'editado',
      }
      const exito = await editarIngreso('i2', input)

      expect(exito).toBe(true)
      // El payload de edición (`IngresoInput`) no lleva `created_at`: el
      // criterio de orden es inmutable frente a una edición de categoría/
      // concepto/monto/fecha.
      const payloadEnviado = (builder.update as Mock).mock.calls[0][0]
      expect(payloadEnviado).not.toHaveProperty('created_at')
      // `actualizarIngreso` reemplaza por índice (`findIndex` + asignación),
      // no hace `unshift`: la posición se conserva, no salta al tope.
      expect(store.ingresos.map((i) => i.id)).toEqual(['i1', 'i2', 'i3'])
      expect(store.ingresos[1]).toEqual(ingresoEditado)
    })
  })

  describe('eliminarIngreso (HU-11.4)', () => {
    it('camino feliz: elimina por id y quita el ingreso del store', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.eq as Mock).mockResolvedValueOnce({ error: null })

      const store = useIngresosStore()
      store.agregarIngreso(ingresoBase)

      const { eliminarIngreso } = useIngresos()
      const exito = await eliminarIngreso('i1')

      expect(exito).toBe(true)
      expect(fromMock).toHaveBeenCalledWith('ingresos')
      expect(builder.delete).toHaveBeenCalled()
      expect(builder.eq).toHaveBeenCalledWith('id', 'i1')
      expect(store.ingresos).toHaveLength(0)
    })

    it('borde: error de Supabase al eliminar deja el ingreso en el store y setea el mensaje', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.eq as Mock).mockResolvedValueOnce({ error: { message: 'boom' } })

      const store = useIngresosStore()
      store.agregarIngreso(ingresoBase)

      const { eliminarIngreso } = useIngresos()
      const exito = await eliminarIngreso('i1')

      expect(exito).toBe(false)
      expect(store.error).toBe('No se pudo eliminar el ingreso.')
      expect(store.ingresos).toHaveLength(1)
    })
  })
})
