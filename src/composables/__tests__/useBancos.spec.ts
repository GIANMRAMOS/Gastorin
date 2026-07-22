import { beforeEach, describe, expect, it, type Mock } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useBancos } from '@/composables/useBancos'
import { useIngresosStore } from '@/stores/ingresos'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabaseClient'
import { crearConstructorConsulta } from '@/lib/__mocks__/supabaseClient'
import type { Banco } from '@/types/ingreso'

/**
 * `supabase.from` viene del mock manual (`vi.mock('@/lib/supabaseClient')` en
 * `src/test/setup.ts`). Ver `useCategorias.spec.ts` para el patrón de mockeo.
 */
const fromMock = supabase.from as unknown as Mock

const bancoBase: Banco = {
  id: 'b1',
  usuario_id: 'u1',
  nombre: 'BCP',
  created_at: '',
}

describe('useBancos (HU-11.1)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('cargarBancos', () => {
    it('camino feliz: carga los bancos ordenados por nombre y los guarda en el store', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      const bancosFalsos = [bancoBase, { ...bancoBase, id: 'b2', nombre: 'Interbank' }]
      ;(builder.order as Mock).mockResolvedValueOnce({ data: bancosFalsos, error: null })

      const { cargarBancos } = useBancos()
      const store = useIngresosStore()
      const exito = await cargarBancos()

      expect(exito).toBe(true)
      expect(fromMock).toHaveBeenCalledWith('bancos')
      expect(builder.order).toHaveBeenCalledWith('nombre')
      expect(store.bancos).toEqual(bancosFalsos)
      expect(store.error).toBeNull()
    })

    it('borde: un array vacío NO es un error (usuario sin bancos todavía)', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.order as Mock).mockResolvedValueOnce({ data: [], error: null })

      const { cargarBancos } = useBancos()
      const store = useIngresosStore()
      const exito = await cargarBancos()

      expect(exito).toBe(true)
      expect(store.bancos).toEqual([])
      expect(store.error).toBeNull()
    })

    it('borde: error de Supabase deja un mensaje en español y cargando vuelve a false', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.order as Mock).mockResolvedValueOnce({
        data: null,
        error: { message: 'network error' },
      })

      const { cargarBancos } = useBancos()
      const store = useIngresosStore()
      const exito = await cargarBancos()

      expect(exito).toBe(false)
      expect(store.error).toBe('No se pudieron cargar los bancos.')
      expect(store.bancos).toEqual([])
      expect(store.cargando).toBe(false)
    })
  })

  describe('crearBanco', () => {
    it('camino feliz: inserta con usuario_id explícito y agrega el banco al store', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      const bancoCreado = { id: 'b-nuevo', usuario_id: 'u1', nombre: 'BCP', created_at: '' }
      ;(builder.single as Mock).mockResolvedValueOnce({ data: bancoCreado, error: null })

      const authStore = useAuthStore()
      authStore.establecerUsuario({ id: 'u1', email: 'a@a.com' } as never)

      const { crearBanco } = useBancos()
      const store = useIngresosStore()
      const exito = await crearBanco('BCP')

      expect(exito).toBe(true)
      expect(fromMock).toHaveBeenCalledWith('bancos')
      expect(builder.insert).toHaveBeenCalledWith({ usuario_id: 'u1', nombre: 'BCP' })
      expect(store.bancos).toEqual([bancoCreado])
      expect(store.error).toBeNull()
    })

    it('borde clave — Gherkin duplicado: banco con el mismo nombre en distinto case (error 23505) traduce el error de Postgres a un mensaje claro y NO lo filtra crudo', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.single as Mock).mockResolvedValueOnce({
        data: null,
        error: {
          code: '23505',
          message:
            'duplicate key value violates unique constraint "bancos_usuario_id_nombre_lower_idx"',
        },
      })

      const authStore = useAuthStore()
      authStore.establecerUsuario({ id: 'u1', email: 'a@a.com' } as never)

      const store = useIngresosStore()
      store.establecerBancos([bancoBase]) // ya existe "BCP"

      const { crearBanco } = useBancos()
      const exito = await crearBanco('bcp') // mismo nombre, distinto case

      expect(exito).toBe(false)
      expect(store.error).toBe('Ya existe un banco con ese nombre.')
      // El error crudo de Postgres NUNCA debe llegar al usuario.
      expect(store.error).not.toContain('duplicate key')
      expect(store.error).not.toContain('23505')
      expect(store.error).not.toContain('constraint')
      // No se agrega el banco duplicado al store.
      expect(store.bancos).toEqual([bancoBase])
    })

    it('borde: sin sesión activa NO llama a Supabase y devuelve un error claro', async () => {
      const authStore = useAuthStore()
      authStore.establecerUsuario(null)

      const { crearBanco } = useBancos()
      const store = useIngresosStore()
      const exito = await crearBanco('BCP')

      expect(exito).toBe(false)
      expect(store.error).toBe('No hay una sesión activa. Vuelve a iniciar sesión.')
      expect(fromMock).not.toHaveBeenCalled()
      expect(store.bancos).toEqual([])
    })

    it('borde: error genérico de Supabase (no 23505) deja un mensaje distinto al de duplicado', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.single as Mock).mockResolvedValueOnce({
        data: null,
        error: { code: '500', message: 'network error' },
      })

      const authStore = useAuthStore()
      authStore.establecerUsuario({ id: 'u1', email: 'a@a.com' } as never)

      const { crearBanco } = useBancos()
      const store = useIngresosStore()
      const exito = await crearBanco('BCP')

      expect(exito).toBe(false)
      expect(store.error).toBe('No se pudo crear el banco.')
      expect(store.bancos).toEqual([])
    })
  })
})
