import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import RegistroView from '@/views/RegistroView.vue'
import { supabase } from '@/lib/supabaseClient'
import type { Mock } from 'vitest'

function crearRouterDePrueba() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/registro', name: 'registro', component: { template: '<div />' } },
      { path: '/login', name: 'login', component: { template: '<div />' } },
      { path: '/historial', name: 'historial', component: { template: '<div />' } },
      { path: '/dashboard', name: 'dashboard', component: { template: '<div />' } },
    ],
  })
}

const auth = supabase.auth as unknown as {
  signUp: Mock
}

async function montarVista() {
  const router = crearRouterDePrueba()
  router.push('/registro')
  await router.isReady()
  const wrapper = mount(RegistroView, {
    global: { plugins: [router] },
  })
  return { wrapper, router }
}

describe('RegistroView (HU-1.1)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('Escenario: Registro exitoso con sesión (confirmación de email desactivada) — crea la cuenta y redirige', async () => {
    auth.signUp.mockResolvedValueOnce({
      data: {
        user: { id: 'u1', email: 'nuevo@test.com', identities: [{ id: 'i1' }] },
        session: { access_token: 'token' },
      },
      error: null,
    })

    const { wrapper, router } = await montarVista()

    await wrapper.find('#email').setValue('nuevo@test.com')
    await wrapper.find('#password').setValue('password123')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(auth.signUp).toHaveBeenCalledWith({
      email: 'nuevo@test.com',
      password: 'password123',
    })
    expect(router.currentRoute.value.name).toBe('dashboard')
  })

  it('Escenario: Registro exitoso sin sesión (confirmación de email pendiente) — no redirige y muestra mensaje', async () => {
    auth.signUp.mockResolvedValueOnce({
      data: {
        user: { id: 'u1', email: 'nuevo@test.com', identities: [{ id: 'i1' }] },
        session: null,
      },
      error: null,
    })

    const { wrapper, router } = await montarVista()

    await wrapper.find('#email').setValue('nuevo@test.com')
    await wrapper.find('#password').setValue('password123')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('registro')
    expect(wrapper.find('[role="status"]').text()).toMatch(/revisa tu correo/i)
  })

  it('Escenario: Email ya registrado con confirmación activa — Supabase responde sin error pero con identities vacío', async () => {
    auth.signUp.mockResolvedValueOnce({
      data: {
        user: { id: 'u-ofuscado', email: 'repetido@test.com', identities: [] },
        session: null,
      },
      error: null,
    })

    const { wrapper, router } = await montarVista()

    await wrapper.find('#email').setValue('repetido@test.com')
    await wrapper.find('#password').setValue('password123')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').text()).toMatch(/ya está registrado/i)
    expect(router.currentRoute.value.name).toBe('registro')
  })

  it('Escenario: Contraseña débil — el envío se bloquea antes de llamar a Supabase', async () => {
    const { wrapper } = await montarVista()

    await wrapper.find('#email').setValue('nuevo@test.com')
    await wrapper.find('#password').setValue('corta')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(auth.signUp).not.toHaveBeenCalled()
    expect(wrapper.find('[role="alert"]').text()).toMatch(/al menos 8 caracteres/i)
  })

  it('Escenario: Email ya registrado — muestra el error de email en uso', async () => {
    auth.signUp.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'User already registered' },
    })

    const { wrapper, router } = await montarVista()

    await wrapper.find('#email').setValue('repetido@test.com')
    await wrapper.find('#password').setValue('password123')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').text()).toMatch(/ya está registrado/i)
    expect(router.currentRoute.value.name).toBe('registro')
  })
})

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}
