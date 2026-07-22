import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabaseClient'

/** Mensaje genérico para no revelar si un email existe o no en el sistema. */
const MENSAJE_CREDENCIALES_INVALIDAS = 'El email o la contraseña son incorrectos.'
/** Mensaje claro para cuando el enlace de restablecimiento ya no es válido. */
const MENSAJE_ENLACE_EXPIRADO = 'El enlace ha expirado, solicita uno nuevo.'

/**
 * Composable que encapsula todas las llamadas a Supabase Auth.
 * Ninguna vista debe llamar a Supabase directamente: siempre a través de aquí.
 * Cada función actualiza `cargando`/`error` en el store y normaliza los mensajes de error.
 */
export function useAuth() {
  const store = useAuthStore()

  /** Registra un nuevo usuario con email y contraseña. */
  async function registrar(email: string, password: string) {
    store.establecerCargando(true)
    store.limpiarError()
    try {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) {
        const emailYaExiste = /already registered|already exists|user already registered/i.test(
          error.message,
        )
        store.establecerError(
          emailYaExiste ? 'El email ya está registrado.' : error.message,
        )
        return false
      }
      // Con confirmación de email activa, Supabase no devuelve error al reintentar
      // el signUp de un email ya registrado (anti-enumeración): responde con un
      // usuario ofuscado sin identidades asociadas. Hay que tratarlo como el
      // mismo caso de "email ya registrado".
      if (data.user?.identities?.length === 0) {
        store.establecerError('El email ya está registrado.')
        return false
      }
      store.establecerUsuario(data.user ?? null)
      store.establecerSesion(data.session ?? null)
      return true
    } finally {
      store.establecerCargando(false)
    }
  }

  /** Inicia sesión con email y contraseña. Error genérico si las credenciales son inválidas. */
  async function iniciarSesion(email: string, password: string) {
    store.establecerCargando(true)
    store.limpiarError()
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        store.establecerError(MENSAJE_CREDENCIALES_INVALIDAS)
        return false
      }
      store.establecerUsuario(data.user ?? null)
      store.establecerSesion(data.session ?? null)
      return true
    } finally {
      store.establecerCargando(false)
    }
  }

  /** Cierra la sesión actual y limpia el estado del store. */
  async function cerrarSesion() {
    store.establecerCargando(true)
    store.limpiarError()
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        store.establecerError(error.message)
        return false
      }
      store.limpiarSesion()
      return true
    } finally {
      store.establecerCargando(false)
    }
  }

  /** Dispara el correo de recuperación de contraseña, apuntando al restablecimiento público. */
  async function recuperarPassword(email: string) {
    store.establecerCargando(true)
    store.limpiarError()
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/restablecer-password`,
      })
      if (error) {
        store.establecerError(error.message)
        return false
      }
      return true
    } finally {
      store.establecerCargando(false)
    }
  }

  /**
   * Restablece la contraseña usando la sesión temporal creada por el enlace del correo.
   * Si el enlace expiró, se muestra un mensaje claro en vez del error crudo de Supabase.
   */
  async function restablecerPassword(nuevaPassword: string) {
    store.establecerCargando(true)
    store.limpiarError()
    try {
      const { data, error } = await supabase.auth.updateUser({ password: nuevaPassword })
      if (error) {
        const enlaceExpirado = /expired|invalid|token/i.test(error.message)
        store.establecerError(enlaceExpirado ? MENSAJE_ENLACE_EXPIRADO : error.message)
        return false
      }
      store.establecerUsuario(data.user ?? null)
      return true
    } finally {
      store.establecerCargando(false)
    }
  }

  return {
    registrar,
    iniciarSesion,
    cerrarSesion,
    recuperarPassword,
    restablecerPassword,
  }
}
