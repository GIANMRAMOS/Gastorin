import { beforeEach, describe, expect, it, type Mock } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useMetasAhorro } from '@/composables/useMetasAhorro'
import { useGastosStore } from '@/stores/gastos'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabaseClient'
import { crearConstructorConsulta } from '@/lib/__mocks__/supabaseClient'
import type { MetaAhorro } from '@/types/metaAhorro'

/**
 * `supabase.from` viene del mock manual (`vi.mock('@/lib/supabaseClient')` en
 * `src/test/setup.ts`). Ver `useCategorias.spec.ts` para el patrón de mockeo.
 */
const fromMock = supabase.from as unknown as Mock

const metaBase: MetaAhorro = {
  usuario_id: 'u1',
  descripcion: 'Viaje 2027',
  monto: 5000,
  actualizado_en: '2026-07-20T00:00:00Z',
}

describe('useMetasAhorro', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('cargarMeta', () => {
    it('camino feliz: guarda la fila encontrada en `meta`', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.maybeSingle as Mock).mockResolvedValueOnce({ data: metaBase, error: null })

      const { meta, cargarMeta } = useMetasAhorro()
      const exito = await cargarMeta()

      expect(exito).toBe(true)
      expect(fromMock).toHaveBeenCalledWith('metas_ahorro')
      expect(meta.value).toEqual(metaBase)
    })

    it('borde: sin fila configurada, `meta` queda en null y NO es un error', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.maybeSingle as Mock).mockResolvedValueOnce({ data: null, error: null })

      const store = useGastosStore()
      const { meta, cargarMeta } = useMetasAhorro()
      const exito = await cargarMeta()

      expect(exito).toBe(true)
      expect(meta.value).toBeNull()
      expect(store.error).toBeNull()
    })

    it('borde: error de Supabase deja un mensaje en español y no toca `meta`', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.maybeSingle as Mock).mockResolvedValueOnce({ data: null, error: { message: 'boom' } })

      const store = useGastosStore()
      const { meta, cargarMeta } = useMetasAhorro()
      const exito = await cargarMeta()

      expect(exito).toBe(false)
      expect(meta.value).toBeNull()
      expect(store.error).toBe('No se pudo cargar la meta de ahorro.')
    })
  })

  describe('guardarMeta', () => {
    it('camino feliz: hace upsert por usuario_id y actualiza `meta`', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.single as Mock).mockResolvedValueOnce({ data: metaBase, error: null })

      const authStore = useAuthStore()
      authStore.establecerUsuario({ id: 'u1', email: 'a@a.com' } as never)

      const { meta, guardarMeta } = useMetasAhorro()
      const exito = await guardarMeta({ descripcion: 'Viaje 2027', monto: 5000 })

      expect(exito).toBe(true)
      expect(builder.upsert).toHaveBeenCalledWith(
        { usuario_id: 'u1', descripcion: 'Viaje 2027', monto: 5000 },
        { onConflict: 'usuario_id' },
      )
      expect(meta.value).toEqual(metaBase)
    })

    it('borde: sin sesión activa NO llama a Supabase', async () => {
      const authStore = useAuthStore()
      authStore.establecerUsuario(null)

      const store = useGastosStore()
      const { guardarMeta } = useMetasAhorro()
      const exito = await guardarMeta({ descripcion: 'Viaje 2027', monto: 5000 })

      expect(exito).toBe(false)
      expect(store.error).toBe('No hay una sesión activa. Vuelve a iniciar sesión.')
      expect(fromMock).not.toHaveBeenCalled()
    })

    it('borde: error de Supabase deja un mensaje en español y no toca `meta`', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.single as Mock).mockResolvedValueOnce({ data: null, error: { message: 'boom' } })

      const authStore = useAuthStore()
      authStore.establecerUsuario({ id: 'u1', email: 'a@a.com' } as never)

      const store = useGastosStore()
      const { meta, guardarMeta } = useMetasAhorro()
      const exito = await guardarMeta({ descripcion: 'Viaje 2027', monto: 5000 })

      expect(exito).toBe(false)
      expect(meta.value).toBeNull()
      expect(store.error).toBe('No se pudo guardar la meta de ahorro.')
    })
  })
})
