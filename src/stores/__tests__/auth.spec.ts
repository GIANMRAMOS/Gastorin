import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import type { Session, User } from '@supabase/supabase-js'

/**
 * Pruebas del store `auth` en aislamiento (sin pasar por `useAuth`/Supabase).
 * `useAuth.spec.ts` ya ejercita el store indirectamente a través de las
 * llamadas a Supabase; aquí se cubren las transiciones de estado propias
 * del store (getter derivado y `limpiarSesion`) que no todos los caminos de
 * `useAuth` recorren.
 */
describe('store auth', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('estado inicial: sin usuario, sin error, no cargando', () => {
    const store = useAuthStore()

    expect(store.usuario).toBeNull()
    expect(store.error).toBeNull()
    expect(store.cargando).toBe(false)
    expect(store.estaAutenticado).toBe(false)
  })

  it('camino feliz: establecerUsuario + establecerSesion marcan estaAutenticado en true', () => {
    const store = useAuthStore()
    const usuarioFalso = { id: 'u1', email: 'test@test.com' } as User
    const sesionFalsa = { access_token: 'token' } as Session

    store.establecerUsuario(usuarioFalso)
    store.establecerSesion(sesionFalsa)

    expect(store.usuario).toEqual(usuarioFalso)
    expect(store.sesion).toEqual(sesionFalsa)
    expect(store.estaAutenticado).toBe(true)
  })

  it('borde: hay usuario pero sin sesión real (ej. registro con confirmación de email pendiente) — estaAutenticado es false', () => {
    const store = useAuthStore()
    const usuarioFalso = { id: 'u1', email: 'test@test.com' } as User

    store.establecerUsuario(usuarioFalso)

    expect(store.usuario).toEqual(usuarioFalso)
    expect(store.sesion).toBeNull()
    expect(store.estaAutenticado).toBe(false)
  })

  it('borde: limpiarSesion resetea usuario, sesión, error y cargando aunque haya estado previo', () => {
    const store = useAuthStore()
    store.establecerUsuario({ id: 'u2', email: 'otro@test.com' } as User)
    store.establecerSesion({ access_token: 'token' } as Session)
    store.establecerError('algo falló')
    store.establecerCargando(true)

    store.limpiarSesion()

    expect(store.usuario).toBeNull()
    expect(store.sesion).toBeNull()
    expect(store.error).toBeNull()
    expect(store.cargando).toBe(false)
    expect(store.estaAutenticado).toBe(false)
  })

  it('borde: limpiarError no toca usuario, sesión ni cargando', () => {
    const store = useAuthStore()
    store.establecerUsuario({ id: 'u3', email: 'x@test.com' } as User)
    store.establecerSesion({ access_token: 'token' } as Session)
    store.establecerError('mensaje previo')
    store.establecerCargando(true)

    store.limpiarError()

    expect(store.error).toBeNull()
    expect(store.usuario).not.toBeNull()
    expect(store.sesion).not.toBeNull()
    expect(store.cargando).toBe(true)
  })
})
