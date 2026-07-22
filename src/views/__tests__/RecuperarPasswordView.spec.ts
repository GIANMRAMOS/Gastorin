import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import RecuperarPasswordView from '@/views/RecuperarPasswordView.vue'
import { supabase } from '@/lib/supabaseClient'
import type { Mock } from 'vitest'

function crearRouterDePrueba() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/recuperar-password', name: 'recuperar-password', component: { template: '<div />' } },
      { path: '/login', name: 'login', component: { template: '<div />' } },
    ],
  })
}

const auth = supabase.auth as unknown as {
  resetPasswordForEmail: Mock
}

async function montarVista() {
  const router = crearRouterDePrueba()
  router.push('/recuperar-password')
  await router.isReady()
  const wrapper = mount(RecuperarPasswordView, {
    global: { plugins: [router] },
  })
  return { wrapper, router }
}

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe('RecuperarPasswordView (HU-1.3a)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('Escenario: Solicitud de recuperación — dispara el reset y muestra confirmación', async () => {
    auth.resetPasswordForEmail.mockResolvedValueOnce({ error: null })

    const { wrapper } = await montarVista()

    await wrapper.find('#email').setValue('alguien@test.com')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith(
      'alguien@test.com',
      expect.objectContaining({ redirectTo: expect.stringContaining('/restablecer-password') }),
    )
    expect(wrapper.text()).toMatch(/te hemos enviado un correo/i)
  })

  it('Borde: email vacío bloquea el envío antes de llamar a Supabase', async () => {
    const { wrapper } = await montarVista()

    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(auth.resetPasswordForEmail).not.toHaveBeenCalled()
    expect(wrapper.find('[role="alert"]').text()).toMatch(/introduce tu email/i)
  })
})
