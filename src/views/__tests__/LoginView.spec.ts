import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import LoginView from '@/views/LoginView.vue'
import { supabase } from '@/lib/supabaseClient'
import type { Mock } from 'vitest'

function crearRouterDePrueba() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'login', component: { template: '<div />' } },
      { path: '/registro', name: 'registro', component: { template: '<div />' } },
      { path: '/recuperar-password', name: 'recuperar-password', component: { template: '<div />' } },
      { path: '/historial', name: 'historial', component: { template: '<div />' } },
      { path: '/dashboard', name: 'dashboard', component: { template: '<div />' } },
    ],
  })
}

const auth = supabase.auth as unknown as {
  signInWithPassword: Mock
}

async function montarVista() {
  const router = crearRouterDePrueba()
  router.push('/login')
  await router.isReady()
  const wrapper = mount(LoginView, {
    global: { plugins: [router] },
  })
  return { wrapper, router }
}

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe('LoginView (HU-1.2)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('Escenario: Login exitoso — redirige a /dashboard', async () => {
    auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: { id: 'u1', email: 'valido@test.com' } },
      error: null,
    })

    const { wrapper, router } = await montarVista()

    await wrapper.find('#email').setValue('valido@test.com')
    await wrapper.find('#password').setValue('password123')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('dashboard')
  })

  it('Escenario: Credenciales incorrectas — mensaje genérico, no revela si el email existe', async () => {
    auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Invalid login credentials' },
    })

    const { wrapper, router } = await montarVista()

    await wrapper.find('#email').setValue('desconocido@test.com')
    await wrapper.find('#password').setValue('cualquiera')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    const mensaje = wrapper.find('[role="alert"]').text()
    expect(mensaje).toBe('El email o la contraseña son incorrectos.')
    expect(mensaje).not.toMatch(/invalid login credentials/i)
    expect(router.currentRoute.value.name).toBe('login')
  })
})
