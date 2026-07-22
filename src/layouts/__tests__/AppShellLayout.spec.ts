import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import AppShellLayout from '@/layouts/AppShellLayout.vue'
import { useUiStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { useVersion } from '@/composables/useVersion'

// HU-9.1 — se mockea `useVersion` para controlar `textoVersion`/`commitCompleto`
// por caso sin depender de las constantes de build reales.
vi.mock('@/composables/useVersion', () => ({
  useVersion: vi.fn(),
}))

/**
 * HU-8.5 — el bottom nav debe ocultarse mientras hay un modal abierto
 * (`storeUi.modalAbierto`), en cualquier ancho <900px (la regla @media que
 * lo oculta en ≥900px no es verificable en jsdom, así que aquí solo se
 * cubre el `v-show` ligado al store).
 */
let wrapperActivo: VueWrapper | null = null

// Valor por defecto del mock de `useVersion` para los describes que no
// prueban HU-9.1 directamente (evita que la destructuración falle).
beforeEach(() => {
  vi.mocked(useVersion).mockReturnValue({
    textoVersion: 'v1.0.0 · abc1234',
    commitCompleto: 'abc1234',
  })
})

async function montarShell() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'dashboard', component: { template: '<div>Dashboard</div>' } },
      { path: '/historial', name: 'historial', component: { template: '<div>Historial</div>' } },
      { path: '/bandeja', name: 'bandeja', component: { template: '<div>Bandeja</div>' } },
      { path: '/categorias', name: 'categorias', component: { template: '<div>Categorías</div>' } },
      { path: '/presupuestos', name: 'presupuestos', component: { template: '<div>Presupuestos</div>' } },
      { path: '/ingresos', name: 'ingresos', component: { template: '<div>Ingresos</div>' } },
      { path: '/bancos', name: 'bancos', component: { template: '<div>Bancos</div>' } },
    ],
  })
  router.push('/')
  await router.isReady()

  const authStore = useAuthStore()
  authStore.establecerUsuario({ id: 'u1', email: 'a@a.com' } as never)

  const wrapper = mount(AppShellLayout, {
    // `isVisible()` (usado para comprobar el `v-show` de HU-8.5) depende de
    // `getComputedStyle`, que en jsdom solo refleja el estilo real de
    // elementos adjuntos al documento. Sin `attachTo`, jsdom devuelve un
    // `CSSStyleDeclaration` vacío y el chequeo da siempre "visible".
    attachTo: document.body,
    global: { plugins: [router] },
  })
  wrapperActivo = wrapper
  return wrapper
}

describe('AppShellLayout — bottom nav durante modales (HU-8.5 / CP-8.5.1)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    wrapperActivo?.unmount()
    wrapperActivo = null
  })

  it('camino feliz: con storeUi.modalAbierto=false el bottom nav es visible', async () => {
    const storeUi = useUiStore()
    storeUi.modalAbierto = false

    const wrapper = await montarShell()
    const nav = wrapper.find('nav.navegacion-inferior')

    expect(nav.exists()).toBe(true)
    expect(nav.isVisible()).toBe(true)
  })

  it('camino feliz: al poner storeUi.modalAbierto=true el bottom nav se oculta (v-show)', async () => {
    const storeUi = useUiStore()
    storeUi.modalAbierto = false

    const wrapper = await montarShell()
    expect(wrapper.find('nav.navegacion-inferior').isVisible()).toBe(true)

    storeUi.modalAbierto = true
    await wrapper.vm.$nextTick()

    expect(wrapper.find('nav.navegacion-inferior').isVisible()).toBe(false)
  })

  it('camino feliz: al volver modalAbierto a false el bottom nav reaparece', async () => {
    const storeUi = useUiStore()

    const wrapper = await montarShell()

    storeUi.modalAbierto = true
    await wrapper.vm.$nextTick()
    expect(wrapper.find('nav.navegacion-inferior').isVisible()).toBe(false)

    storeUi.modalAbierto = false
    await wrapper.vm.$nextTick()
    expect(wrapper.find('nav.navegacion-inferior').isVisible()).toBe(true)
  })

  it('ciclo de vida: al abrir el modal de registro (FAB), storeUi.modalAbierto pasa a true y el bottom nav se oculta', async () => {
    const storeUi = useUiStore()
    storeUi.modalAbierto = false

    const wrapper = await montarShell()
    expect(wrapper.find('nav.navegacion-inferior').isVisible()).toBe(true)

    await wrapper.find('.boton-fab').trigger('click')

    expect(storeUi.modalAbierto).toBe(true)
    expect(wrapper.find('nav.navegacion-inferior').isVisible()).toBe(false)
  })
})

describe('AppShellLayout — versión y hash de commit en el sidebar (HU-9.1)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    wrapperActivo?.unmount()
    wrapperActivo = null
    vi.restoreAllMocks()
  })

  it('camino feliz: el texto de versión se renderiza dentro del sidebar', async () => {
    vi.mocked(useVersion).mockReturnValue({
      textoVersion: 'v1.2.3 · abc1234',
      commitCompleto: 'abc1234',
    })

    const wrapper = await montarShell()
    const aside = wrapper.find('aside.barra-lateral')
    const textoVersion = aside.find('.texto-version')

    expect(textoVersion.exists()).toBe(true)
    expect(textoVersion.text()).toContain('v1.2.3 · abc1234')
  })

  it('copia: al hacer click en el hash de commit, se copia el commit completo y aparece "Copiado"', async () => {
    vi.mocked(useVersion).mockReturnValue({
      textoVersion: 'v1.2.3 · abc1234',
      commitCompleto: 'abc1234',
    })
    const escribirEnPortapapeles = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: escribirEnPortapapeles },
      configurable: true,
    })

    const wrapper = await montarShell()
    await wrapper.find('.hash-commit').trigger('click')
    await wrapper.vm.$nextTick()

    expect(escribirEnPortapapeles).toHaveBeenCalledWith('abc1234')
    expect(wrapper.find('.confirmacion-copiado').exists()).toBe(true)
  })

  it('borde: con commitCompleto null, el hash no es tocable y no intenta copiar nada', async () => {
    vi.mocked(useVersion).mockReturnValue({
      textoVersion: 'v1.2.3 · sin commit',
      commitCompleto: null,
    })
    const escribirEnPortapapeles = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: escribirEnPortapapeles },
      configurable: true,
    })

    const wrapper = await montarShell()

    expect(wrapper.find('.hash-commit').exists()).toBe(false)
    expect(wrapper.find('.texto-version').text()).toContain('sin commit')
    expect(escribirEnPortapapeles).not.toHaveBeenCalled()
  })
})
