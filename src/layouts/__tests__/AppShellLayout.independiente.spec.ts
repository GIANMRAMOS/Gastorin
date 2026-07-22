import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import AppShellLayout from '@/layouts/AppShellLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { useVersion } from '@/composables/useVersion'

/**
 * Validación INDEPENDIENTE de HU-9.1 (Épica 9), separada de
 * `AppShellLayout.spec.ts` de dev-builder. Se enfoca en dos afirmaciones
 * puntuales que el describe del builder no verifica explícitamente:
 * 1) el texto de versión NO se renderiza en absoluto en el bottom-nav móvil.
 * 2) al copiar, se pasa a `writeText` exactamente el valor de `commitCompleto`
 *    devuelto por el composable (sin recortarlo de nuevo en el componente).
 */
vi.mock('@/composables/useVersion', () => ({
  useVersion: vi.fn(),
}))

async function montarShell() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'dashboard', component: { template: '<div>Dashboard</div>' } },
      { path: '/historial', name: 'historial', component: { template: '<div>Historial</div>' } },
      { path: '/bandeja', name: 'bandeja', component: { template: '<div>Bandeja</div>' } },
      { path: '/categorias', name: 'categorias', component: { template: '<div>Categorías</div>' } },
      { path: '/presupuestos', name: 'presupuestos', component: { template: '<div>Presupuestos</div>' } },
    ],
  })
  router.push('/')
  await router.isReady()

  const authStore = useAuthStore()
  authStore.establecerUsuario({ id: 'u1', email: 'a@a.com' } as never)

  return mount(AppShellLayout, {
    attachTo: document.body,
    global: { plugins: [router] },
  })
}

describe('AppShellLayout — versión NO debe aparecer en el bottom-nav móvil (HU-9.1, independiente)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(useVersion).mockReturnValue({
      textoVersion: 'v9.9.9 · marcador0',
      commitCompleto: 'marcador0',
    })
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('el bottom-nav (.navegacion-inferior) no contiene .texto-version ni el texto de versión', async () => {
    const wrapper = await montarShell()
    const bottomNav = wrapper.find('nav.navegacion-inferior')

    expect(bottomNav.exists()).toBe(true)
    expect(bottomNav.find('.texto-version').exists()).toBe(false)
    expect(bottomNav.text()).not.toContain('marcador0')
    expect(bottomNav.text()).not.toContain('v9.9.9')
  })

  it('el texto de versión solo existe una vez en todo el documento (dentro del aside)', async () => {
    const wrapper = await montarShell()
    const ocurrencias = wrapper.findAll('.texto-version')

    expect(ocurrencias.length).toBe(1)
    expect(wrapper.find('aside.barra-lateral .texto-version').exists()).toBe(true)
  })
})

describe('AppShellLayout — copia el valor EXACTO de commitCompleto (HU-9.1, independiente)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('pasa a writeText el mismo string que devuelve el composable, sin transformarlo', async () => {
    const commitDeEjemplo = 'deadbeef-no-es-un-hash-real-pero-se-copia-tal-cual'
    vi.mocked(useVersion).mockReturnValue({
      textoVersion: `v1.0.0 · ${commitDeEjemplo.slice(0, 7)}`,
      commitCompleto: commitDeEjemplo,
    })
    const escribirEnPortapapeles = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: escribirEnPortapapeles },
      configurable: true,
    })

    const wrapper = await montarShell()
    await wrapper.find('.hash-commit').trigger('click')
    await wrapper.vm.$nextTick()

    expect(escribirEnPortapapeles).toHaveBeenCalledTimes(1)
    expect(escribirEnPortapapeles).toHaveBeenCalledWith(commitDeEjemplo)
    // No debe copiar el texto recortado que se muestra en pantalla.
    expect(escribirEnPortapapeles).not.toHaveBeenCalledWith(commitDeEjemplo.slice(0, 7))
  })
})
