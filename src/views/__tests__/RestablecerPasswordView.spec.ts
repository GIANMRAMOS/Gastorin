import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import RestablecerPasswordView from '@/views/RestablecerPasswordView.vue'
import { supabase } from '@/lib/supabaseClient'
import type { Mock } from 'vitest'

function crearRouterDePrueba() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/restablecer-password', name: 'restablecer-password', component: { template: '<div />' } },
      { path: '/login', name: 'login', component: { template: '<div />' } },
    ],
  })
}

const auth = supabase.auth as unknown as {
  updateUser: Mock
}

async function montarVista() {
  const router = crearRouterDePrueba()
  router.push('/restablecer-password')
  await router.isReady()
  const wrapper = mount(RestablecerPasswordView, {
    global: { plugins: [router] },
  })
  return { wrapper, router }
}

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe('RestablecerPasswordView (HU-1.3b)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('Escenario: Restablecer con enlace válido — actualiza la contraseña y redirige a login', async () => {
    auth.updateUser.mockResolvedValueOnce({
      data: { user: { id: 'u1', email: 'x@test.com' } },
      error: null,
    })

    const { wrapper, router } = await montarVista()

    await wrapper.find('#nueva-password').setValue('nuevaPassword123')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'nuevaPassword123' })
    expect(wrapper.text()).toMatch(/se ha actualizado correctamente/i)
    expect(router.currentRoute.value.name).toBe('login')
  })

  it('Escenario: Enlace expirado — muestra mensaje claro, no el error crudo de Supabase', async () => {
    auth.updateUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Token has expired or is invalid' },
    })

    const { wrapper, router } = await montarVista()

    await wrapper.find('#nueva-password').setValue('nuevaPassword123')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    const mensaje = wrapper.find('[role="alert"]').text()
    expect(mensaje).toBe('El enlace ha expirado, solicita uno nuevo.')
    expect(mensaje).not.toMatch(/token/i)
    expect(router.currentRoute.value.name).toBe('restablecer-password')
  })

  it('Borde: nueva contraseña < 8 caracteres bloquea el envío antes de llamar a Supabase', async () => {
    const { wrapper } = await montarVista()

    await wrapper.find('#nueva-password').setValue('corta')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(auth.updateUser).not.toHaveBeenCalled()
    expect(wrapper.find('[role="alert"]').text()).toMatch(/al menos 8 caracteres/i)
  })
})
