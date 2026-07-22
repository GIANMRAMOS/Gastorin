import { defineStore } from 'pinia'
import type { Session, User } from '@supabase/supabase-js'

/**
 * Store de autenticación: fuente única de verdad del estado de sesión.
 * `useAuth` es responsable de ejecutar las operaciones contra Supabase
 * y de escribir aquí el resultado (usuario, sesión, estado de carga y errores).
 */
export const useAuthStore = defineStore('auth', {
  state: () => ({
    usuario: null as User | null,
    sesion: null as Session | null,
    cargando: false,
    error: null as string | null,
  }),
  getters: {
    // La autenticación requiere una sesión real, no solo un objeto de usuario:
    // Supabase puede devolver `user` sin `session` (ej. registro con confirmación
    // de email pendiente), y en ese caso el usuario no debe considerarse logueado.
    estaAutenticado: (estado) => estado.usuario !== null && estado.sesion !== null,
  },
  actions: {
    /** Guarda el usuario autenticado actual (o null si no hay sesión). */
    establecerUsuario(usuario: User | null) {
      this.usuario = usuario
    },
    /** Guarda la sesión activa actual (o null si no hay sesión real). */
    establecerSesion(sesion: Session | null) {
      this.sesion = sesion
    },
    /** Marca el estado de carga de una operación de auth en curso. */
    establecerCargando(cargando: boolean) {
      this.cargando = cargando
    },
    /** Guarda el mensaje de error de la última operación de auth. */
    establecerError(error: string | null) {
      this.error = error
    },
    /** Limpia el error actual (por ejemplo, al reintentar un envío). */
    limpiarError() {
      this.error = null
    },
    /** Limpia por completo el estado de sesión (usado al cerrar sesión). */
    limpiarSesion() {
      this.usuario = null
      this.sesion = null
      this.error = null
      this.cargando = false
    },
  },
})
