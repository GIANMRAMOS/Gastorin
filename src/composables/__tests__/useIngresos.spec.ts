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
  fecha: '2026-07-10',
  moneda: 'PEN',
  importe: 100,
  concepto: 'Sueldo',
}

const ingresoBase: Ingreso = {
  id: 'i1',
  usuario_id: 'u1',
  banco_id: 'b1',
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
    it('camino feliz: consulta ordenada por fecha descendente y guarda el resultado en el store', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      const ingresosFalsos = [ingresoBase, { ...ingresoBase, id: 'i2', fecha: '2026-07-01' }]
      ;(builder.order as Mock).mockResolvedValueOnce({ data: ingresosFalsos, error: null })

      const { cargarIngresos } = useIngresos()
      const store = useIngresosStore()
      const exito = await cargarIngresos()

      expect(exito).toBe(true)
      expect(fromMock).toHaveBeenCalledWith('ingresos')
      expect(builder.order).toHaveBeenCalledWith('fecha', { ascending: false })
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

    it('borde Gherkin — importe negativo: mismo comportamiento, el composable llama a Supabase igualmente (el bloqueo real ocurre en el formulario) y traduce el error', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.single as Mock).mockResolvedValueOnce({
        data: null,
        error: { code: '23514', message: 'check constraint violated' },
      })

      const authStore = useAuthStore()
      authStore.establecerUsuario({ id: 'u1', email: 'a@a.com' } as never)

      const { crearIngreso } = useIngresos()
      const store = useIngresosStore()
      const exito = await crearIngreso({ ...inputBase, importe: -50 })

      expect(exito).toBe(false)
      expect(store.error).toBe('No se pudo guardar el ingreso.')
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
})
