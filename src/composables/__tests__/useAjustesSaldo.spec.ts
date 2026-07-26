import { beforeEach, describe, expect, it, type Mock } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAjustesSaldo } from '@/composables/useAjustesSaldo'
import { useGastosStore } from '@/stores/gastos'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabaseClient'
import { crearConstructorConsulta } from '@/lib/__mocks__/supabaseClient'
import type { AjusteSaldoCuenta } from '@/types/ajusteSaldo'

const fromMock = supabase.from as unknown as Mock

const ajusteBase: AjusteSaldoCuenta = {
  id: 'a1',
  usuario_id: 'u1',
  banco_id: 'b1',
  moneda: 'PEN',
  saldo: 1000,
  fecha: '2026-07-01',
  creado_en: '2026-07-01T10:00:00Z',
}

describe('useAjustesSaldo', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('cargarAjustesSaldo', () => {
    it('camino feliz: guarda el historial completo en `ajustes`', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.select as Mock).mockResolvedValueOnce({ data: [ajusteBase], error: null })

      const { ajustes, cargarAjustesSaldo } = useAjustesSaldo()
      const exito = await cargarAjustesSaldo()

      expect(exito).toBe(true)
      expect(fromMock).toHaveBeenCalledWith('ajustes_saldo_cuenta')
      expect(ajustes.value).toEqual([ajusteBase])
    })

    it('borde: sin ajustes todavía, `ajustes` queda en un array vacío y NO es un error', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.select as Mock).mockResolvedValueOnce({ data: [], error: null })

      const store = useGastosStore()
      const { ajustes, cargarAjustesSaldo } = useAjustesSaldo()
      const exito = await cargarAjustesSaldo()

      expect(exito).toBe(true)
      expect(ajustes.value).toEqual([])
      expect(store.error).toBeNull()
    })

    it('borde: error de Supabase deja un mensaje en español', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.select as Mock).mockResolvedValueOnce({ data: null, error: { message: 'boom' } })

      const store = useGastosStore()
      const { cargarAjustesSaldo } = useAjustesSaldo()
      const exito = await cargarAjustesSaldo()

      expect(exito).toBe(false)
      expect(store.error).toBe('No se pudieron cargar los ajustes de saldo.')
    })
  })

  describe('guardarAjusteSaldo', () => {
    it('camino feliz: hace un INSERT (no upsert) y agrega el ajuste devuelto al historial local', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.single as Mock).mockResolvedValueOnce({ data: ajusteBase, error: null })

      const authStore = useAuthStore()
      authStore.establecerUsuario({ id: 'u1', email: 'a@a.com' } as never)

      const { ajustes, guardarAjusteSaldo } = useAjustesSaldo()
      const exito = await guardarAjusteSaldo({ banco_id: 'b1', moneda: 'PEN', saldo: 1000, fecha: '2026-07-01' })

      expect(exito).toBe(true)
      expect(builder.insert).toHaveBeenCalledWith({
        usuario_id: 'u1',
        banco_id: 'b1',
        moneda: 'PEN',
        saldo: 1000,
        fecha: '2026-07-01',
      })
      expect(ajustes.value).toEqual([ajusteBase])
    })

    it('borde: un segundo ajuste se AGREGA al historial, no reemplaza al primero', async () => {
      const builder1 = crearConstructorConsulta()
      const builder2 = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder1).mockReturnValueOnce(builder2)
      ;(builder1.single as Mock).mockResolvedValueOnce({ data: ajusteBase, error: null })
      const segundoAjuste: AjusteSaldoCuenta = { ...ajusteBase, id: 'a2', fecha: '2026-07-15', saldo: 1500 }
      ;(builder2.single as Mock).mockResolvedValueOnce({ data: segundoAjuste, error: null })

      const authStore = useAuthStore()
      authStore.establecerUsuario({ id: 'u1', email: 'a@a.com' } as never)

      const { ajustes, guardarAjusteSaldo } = useAjustesSaldo()
      await guardarAjusteSaldo({ banco_id: 'b1', moneda: 'PEN', saldo: 1000, fecha: '2026-07-01' })
      await guardarAjusteSaldo({ banco_id: 'b1', moneda: 'PEN', saldo: 1500, fecha: '2026-07-15' })

      expect(ajustes.value).toEqual([ajusteBase, segundoAjuste])
    })

    it('borde: sin sesión activa NO llama a Supabase', async () => {
      const authStore = useAuthStore()
      authStore.establecerUsuario(null)

      const store = useGastosStore()
      const { guardarAjusteSaldo } = useAjustesSaldo()
      const exito = await guardarAjusteSaldo({ banco_id: 'b1', moneda: 'PEN', saldo: 1000, fecha: '2026-07-01' })

      expect(exito).toBe(false)
      expect(store.error).toBe('No hay una sesión activa. Vuelve a iniciar sesión.')
      expect(fromMock).not.toHaveBeenCalled()
    })

    it('borde: error de Supabase deja un mensaje en español y no toca el historial local', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.single as Mock).mockResolvedValueOnce({ data: null, error: { message: 'boom' } })

      const authStore = useAuthStore()
      authStore.establecerUsuario({ id: 'u1', email: 'a@a.com' } as never)

      const store = useGastosStore()
      const { ajustes, guardarAjusteSaldo } = useAjustesSaldo()
      const exito = await guardarAjusteSaldo({ banco_id: 'b1', moneda: 'PEN', saldo: 1000, fecha: '2026-07-01' })

      expect(exito).toBe(false)
      expect(ajustes.value).toEqual([])
      expect(store.error).toBe('No se pudo guardar el ajuste de saldo.')
    })
  })
})
