import { beforeEach, describe, expect, it, type Mock } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useReglasComercio } from '@/composables/useReglasComercio'
import { useGastosStore } from '@/stores/gastos'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabaseClient'
import { crearConstructorConsulta } from '@/lib/__mocks__/supabaseClient'
import type { ReglaComercio } from '@/types/reglaComercio'

/**
 * `supabase.from` viene del mock manual (`vi.mock('@/lib/supabaseClient')` en
 * `src/test/setup.ts`). Ver `useCategorias.spec.ts` para el patrón de mockeo.
 */
const fromMock = supabase.from as unknown as Mock

const reglaBase: ReglaComercio = {
  usuario_id: 'u1',
  comercio: 'primax surco',
  categoria_id: 'c1',
  actualizado_en: '2026-07-20T00:00:00Z',
}

describe('useReglasComercio (HU-14.1)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('normalizarComercio', () => {
    it('quita espacios al borde y pasa a minúsculas', () => {
      const { normalizarComercio } = useReglasComercio()
      expect(normalizarComercio('  Primax Surco  ')).toBe('primax surco')
      expect(normalizarComercio('PRIMAX SURCO')).toBe('primax surco')
    })
  })

  describe('buscarReglaPorComercio', () => {
    it('camino feliz: encuentra la regla normalizando el comercio de búsqueda', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.maybeSingle as Mock).mockResolvedValueOnce({ data: reglaBase, error: null })

      const { buscarReglaPorComercio } = useReglasComercio()
      const resultado = await buscarReglaPorComercio('  Primax Surco  ')

      expect(resultado).toEqual(reglaBase)
      expect(fromMock).toHaveBeenCalledWith('reglas_comercio')
      expect(builder.eq).toHaveBeenCalledWith('comercio', 'primax surco')
    })

    it('borde: sin regla previa devuelve null y NO es un error', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.maybeSingle as Mock).mockResolvedValueOnce({ data: null, error: null })

      const store = useGastosStore()
      const { buscarReglaPorComercio } = useReglasComercio()
      const resultado = await buscarReglaPorComercio('comercio nuevo')

      expect(resultado).toBeNull()
      expect(store.error).toBeNull()
    })

    it('borde: un error real de Supabase degrada a "sin sugerencia" sin marcar error en el store (comodidad, no crítico)', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.maybeSingle as Mock).mockResolvedValueOnce({
        data: null,
        error: { message: 'network error' },
      })

      const store = useGastosStore()
      const { buscarReglaPorComercio } = useReglasComercio()
      const resultado = await buscarReglaPorComercio('primax surco')

      expect(resultado).toBeNull()
      expect(store.error).toBeNull()
    })
  })

  describe('contarCargosComercio', () => {
    it('camino feliz: devuelve el count exacto de cargos confirmados de ese comercio', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.ilike as Mock).mockResolvedValueOnce({ count: 3, error: null })

      const { contarCargosComercio } = useReglasComercio()
      const resultado = await contarCargosComercio('Primax Surco')

      expect(resultado).toBe(3)
      expect(fromMock).toHaveBeenCalledWith('gastos')
      expect(builder.eq).toHaveBeenCalledWith('estado', 'confirmado')
      expect(builder.eq).toHaveBeenCalledWith('origen', 'correo')
      expect(builder.ilike).toHaveBeenCalledWith('descripcion', 'primax surco')
    })

    it('borde: si falla el count, devuelve 0 sin marcar error en el store', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.ilike as Mock).mockResolvedValueOnce({ count: null, error: { message: 'boom' } })

      const store = useGastosStore()
      const { contarCargosComercio } = useReglasComercio()
      const resultado = await contarCargosComercio('primax surco')

      expect(resultado).toBe(0)
      expect(store.error).toBeNull()
    })
  })

  describe('guardarRegla', () => {
    it('camino feliz: hace upsert con onConflict sobre (usuario_id, comercio) normalizado', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.upsert as Mock).mockResolvedValueOnce({ data: null, error: null })

      const authStore = useAuthStore()
      authStore.establecerUsuario({ id: 'u1', email: 'a@a.com' } as never)

      const { guardarRegla } = useReglasComercio()
      const exito = await guardarRegla('  Primax Surco  ', 'c1')

      expect(exito).toBe(true)
      expect(fromMock).toHaveBeenCalledWith('reglas_comercio')
      expect(builder.upsert).toHaveBeenCalledWith(
        { usuario_id: 'u1', comercio: 'primax surco', categoria_id: 'c1' },
        { onConflict: 'usuario_id,comercio' },
      )
    })

    it('borde: sin sesión activa NO llama a Supabase, devuelve false y NO marca error en el store', async () => {
      const authStore = useAuthStore()
      authStore.establecerUsuario(null)

      const { guardarRegla } = useReglasComercio()
      const store = useGastosStore()
      const exito = await guardarRegla('primax surco', 'c1')

      expect(exito).toBe(false)
      expect(store.error).toBeNull()
      expect(fromMock).not.toHaveBeenCalled()
    })

    it('borde: error de Supabase devuelve false sin marcar error en el store (el gasto ya confirmado no debe verse afectado)', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.upsert as Mock).mockResolvedValueOnce({ data: null, error: { message: 'boom' } })

      const authStore = useAuthStore()
      authStore.establecerUsuario({ id: 'u1', email: 'a@a.com' } as never)

      const { guardarRegla } = useReglasComercio()
      const store = useGastosStore()
      const exito = await guardarRegla('primax surco', 'c1')

      expect(exito).toBe(false)
      expect(store.error).toBeNull()
    })
  })
})
