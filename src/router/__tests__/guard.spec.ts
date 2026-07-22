import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import router from '@/router/index'
import { useAuthStore } from '@/stores/auth'

describe('Guard global del router (HU-1.2)', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    // Empezamos siempre desde una ruta pública para no arrastrar estado de navegación entre tests.
    await router.push('/login')
    await router.isReady()
  })

  it('Escenario: Acceso a ruta protegida sin sesión — redirige a /login', async () => {
    const store = useAuthStore()
    expect(store.estaAutenticado).toBe(false)

    await router.push('/historial')

    expect(router.currentRoute.value.name).toBe('login')
  })

  it('Con sesión activa, se permite el acceso a la ruta protegida', async () => {
    const store = useAuthStore()
    store.establecerUsuario({ id: 'u1', email: 'x@test.com' } as never)
    store.establecerSesion({ access_token: 'token' } as never)
    expect(store.estaAutenticado).toBe(true)

    await router.push('/historial')

    expect(router.currentRoute.value.name).toBe('historial')
  })

  it('Con usuario pero sin sesión real (ej. registro con confirmación pendiente), se redirige a /login', async () => {
    const store = useAuthStore()
    store.establecerUsuario({ id: 'u1', email: 'x@test.com' } as never)
    expect(store.estaAutenticado).toBe(false)

    await router.push('/historial')

    expect(router.currentRoute.value.name).toBe('login')
  })

  it('Las rutas públicas (login, registro, recuperar/restablecer) son accesibles sin sesión', async () => {
    const store = useAuthStore()
    expect(store.estaAutenticado).toBe(false)

    await router.push('/registro')
    expect(router.currentRoute.value.name).toBe('registro')

    await router.push('/recuperar-password')
    expect(router.currentRoute.value.name).toBe('recuperar-password')

    await router.push('/restablecer-password')
    expect(router.currentRoute.value.name).toBe('restablecer-password')
  })
})
