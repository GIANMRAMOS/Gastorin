import { beforeEach, describe, expect, it, type Mock } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuth } from '@/composables/useAuth'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabaseClient'

/**
 * `supabase` viene del mock automático (`vi.mock('@/lib/supabaseClient')` en
 * `src/test/setup.ts`), así que sus métodos ya son `vi.fn()` en tiempo de
 * ejecución. Este cast solo evita que `vue-tsc` intente comprobar los
 * argumentos/valores de retorno contra los tipos reales del SDK de Supabase.
 */
const auth = supabase.auth as unknown as {
  signUp: Mock
  signInWithPassword: Mock
  signOut: Mock
  resetPasswordForEmail: Mock
  updateUser: Mock
}

describe('useAuth', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('registrar', () => {
    it('camino feliz: confirmación de email desactivada — registra el usuario y guarda usuario + sesión', async () => {
      const usuarioFalso = { id: 'u1', email: 'nuevo@test.com', identities: [{ id: 'i1' }] }
      const sesionFalsa = { access_token: 'token' }
      auth.signUp.mockResolvedValueOnce({
        data: { user: usuarioFalso, session: sesionFalsa },
        error: null,
      })

      const { registrar } = useAuth()
      const store = useAuthStore()
      const exito = await registrar('nuevo@test.com', 'password123')

      expect(exito).toBe(true)
      expect(auth.signUp).toHaveBeenCalledWith({
        email: 'nuevo@test.com',
        password: 'password123',
      })
      expect(store.usuario).toEqual(usuarioFalso)
      expect(store.sesion).toEqual(sesionFalsa)
      expect(store.estaAutenticado).toBe(true)
      expect(store.error).toBeNull()
      expect(store.cargando).toBe(false)
    })

    it('borde: confirmación de email activa — email nuevo sin sesión no autentica pero sí es un registro exitoso', async () => {
      const usuarioFalso = { id: 'u1', email: 'nuevo@test.com', identities: [{ id: 'i1' }] }
      auth.signUp.mockResolvedValueOnce({
        data: { user: usuarioFalso, session: null },
        error: null,
      })

      const { registrar } = useAuth()
      const store = useAuthStore()
      const exito = await registrar('nuevo@test.com', 'password123')

      expect(exito).toBe(true)
      expect(store.usuario).toEqual(usuarioFalso)
      expect(store.sesion).toBeNull()
      expect(store.estaAutenticado).toBe(false)
    })

    it('borde: email ya registrado (Supabase devuelve error) normaliza el mensaje de error', async () => {
      auth.signUp.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'User already registered' },
      })

      const { registrar } = useAuth()
      const store = useAuthStore()
      const exito = await registrar('repetido@test.com', 'password123')

      expect(exito).toBe(false)
      expect(store.error).toBe('El email ya está registrado.')
      expect(store.usuario).toBeNull()
    })

    it('borde: email ya registrado con confirmación activa — Supabase responde sin error pero con identities vacío (anti-enumeración)', async () => {
      const usuarioOfuscado = { id: 'u-ofuscado', email: 'repetido@test.com', identities: [] }
      auth.signUp.mockResolvedValueOnce({
        data: { user: usuarioOfuscado, session: null },
        error: null,
      })

      const { registrar } = useAuth()
      const store = useAuthStore()
      const exito = await registrar('repetido@test.com', 'password123')

      expect(exito).toBe(false)
      expect(store.error).toBe('El email ya está registrado.')
      expect(store.usuario).toBeNull()
      expect(store.sesion).toBeNull()
    })
  })

  describe('iniciarSesion', () => {
    it('camino feliz: inicia sesión y guarda el usuario', async () => {
      const usuarioFalso = { id: 'u2', email: 'valido@test.com' }
      auth.signInWithPassword.mockResolvedValueOnce({
        data: { user: usuarioFalso },
        error: null,
      })

      const { iniciarSesion } = useAuth()
      const store = useAuthStore()
      const exito = await iniciarSesion('valido@test.com', 'password123')

      expect(exito).toBe(true)
      expect(store.usuario).toEqual(usuarioFalso)
    })

    it('borde: credenciales incorrectas muestran un mensaje genérico (no revela si el email existe)', async () => {
      auth.signInWithPassword.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Invalid login credentials' },
      })

      const { iniciarSesion } = useAuth()
      const store = useAuthStore()
      const exito = await iniciarSesion('quien-sabe@test.com', 'mala-password')

      expect(exito).toBe(false)
      expect(store.error).toBe('El email o la contraseña son incorrectos.')
      expect(store.error).not.toMatch(/invalid login credentials/i)
    })
  })

  describe('cerrarSesion', () => {
    it('camino feliz: limpia la sesión del store', async () => {
      auth.signOut.mockResolvedValueOnce({ error: null })

      const { cerrarSesion } = useAuth()
      const store = useAuthStore()
      store.establecerUsuario({ id: 'u3', email: 'x@test.com' } as never)

      const exito = await cerrarSesion()

      expect(exito).toBe(true)
      expect(store.usuario).toBeNull()
    })

    it('borde: si Supabase devuelve error, se conserva el mensaje y no se limpia la sesión', async () => {
      auth.signOut.mockResolvedValueOnce({ error: { message: 'network error' } })

      const { cerrarSesion } = useAuth()
      const store = useAuthStore()
      store.establecerUsuario({ id: 'u3', email: 'x@test.com' } as never)

      const exito = await cerrarSesion()

      expect(exito).toBe(false)
      expect(store.error).toBe('network error')
      expect(store.usuario).not.toBeNull()
    })
  })

  describe('recuperarPassword', () => {
    it('camino feliz: dispara el reset apuntando a la ruta pública de restablecer', async () => {
      auth.resetPasswordForEmail.mockResolvedValueOnce({ error: null })

      const { recuperarPassword } = useAuth()
      const exito = await recuperarPassword('alguien@test.com')

      expect(exito).toBe(true)
      expect(auth.resetPasswordForEmail).toHaveBeenCalledWith(
        'alguien@test.com',
        expect.objectContaining({ redirectTo: expect.stringContaining('/restablecer-password') }),
      )
    })

    it('borde: propaga el error si Supabase falla al enviar el correo', async () => {
      auth.resetPasswordForEmail.mockResolvedValueOnce({
        error: { message: 'rate limit exceeded' },
      })

      const { recuperarPassword } = useAuth()
      const store = useAuthStore()
      const exito = await recuperarPassword('alguien@test.com')

      expect(exito).toBe(false)
      expect(store.error).toBe('rate limit exceeded')
    })
  })

  describe('restablecerPassword', () => {
    it('camino feliz: actualiza la contraseña y guarda el usuario', async () => {
      const usuarioFalso = { id: 'u4', email: 'x@test.com' }
      auth.updateUser.mockResolvedValueOnce({ data: { user: usuarioFalso }, error: null })

      const { restablecerPassword } = useAuth()
      const store = useAuthStore()
      const exito = await restablecerPassword('nuevaPassword123')

      expect(exito).toBe(true)
      expect(auth.updateUser).toHaveBeenCalledWith({ password: 'nuevaPassword123' })
      expect(store.usuario).toEqual(usuarioFalso)
    })

    it('borde: enlace expirado muestra un mensaje claro, no el error crudo de Supabase', async () => {
      auth.updateUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Token has expired or is invalid' },
      })

      const { restablecerPassword } = useAuth()
      const store = useAuthStore()
      const exito = await restablecerPassword('nuevaPassword123')

      expect(exito).toBe(false)
      expect(store.error).toBe('El enlace ha expirado, solicita uno nuevo.')
      expect(store.error).not.toMatch(/token/i)
    })
  })
})
