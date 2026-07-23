import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import AppShellLayout from '@/layouts/AppShellLayout.vue'
import { useUiStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'
import { useIngresosStore } from '@/stores/ingresos'
import { useGastosStore } from '@/stores/gastos'
import { useVersion } from '@/composables/useVersion'
import { supabase } from '@/lib/supabaseClient'
import { crearConstructorConsulta } from '@/lib/__mocks__/supabaseClient'

// HU-9.1 — se mockea `useVersion` para controlar `textoVersion`/`commitCompleto`
// por caso sin depender de las constantes de build reales.
vi.mock('@/composables/useVersion', () => ({
  useVersion: vi.fn(),
}))

// El shell ahora hidrata bancos/categorías en su propio `onMounted` (fix del
// bug reportado por QA), así que dispara fetch real a Supabase al montarse:
// se mockea el cliente para no tocar red ni dejar promesas colgadas.
vi.mock('@/lib/supabaseClient')

const fromMock = supabase.from as unknown as Mock

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

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
  // Por defecto, catálogos vacíos: los describes que necesitan bancos/
  // categorías reales sobreescriben `fromMock` en su propio `beforeEach`/test.
  fromMock.mockImplementation(() => {
    const builder = crearConstructorConsulta()
    ;(builder.order as Mock).mockResolvedValue({ data: [], error: null })
    return builder
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

describe('AppShellLayout — orden de menú (Épica 11, ajuste de alcance)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    wrapperActivo?.unmount()
    wrapperActivo = null
  })

  it('sidebar de escritorio: orden exacto Dashboard, Registrar gasto, Egresos, Ingresos, Bandeja, Presupuestos, Categorías, Bancos, Registrar ingreso', async () => {
    const wrapper = await montarShell()
    const nav = wrapper.find('nav.navegacion')
    const items = nav.findAll('.item-nav, .item-nav-boton')

    expect(items.map((i) => i.text())).toEqual([
      'Dashboard',
      'Registrar gasto',
      'Egresos',
      'Ingresos',
      'Bandeja',
      'Presupuestos',
      'Categorías',
      'Bancos',
      'Registrar ingreso',
    ])
    // La ruta interna sigue llamándose "historial"; solo cambió el texto visible a "Egresos".
    expect(nav.findAll('.item-nav')[2].attributes('href')).toBe('/historial')
  })

  it('bottom nav móvil: mismas rutas en el mismo orden relativo (Dashboard, Egresos, Ingresos, Bandeja, Presupuestos, Categorías, Bancos), con FAB y Salir al final', async () => {
    const wrapper = await montarShell()
    const bottomNav = wrapper.find('nav.navegacion-inferior')
    const enlaces = bottomNav.findAll('a.item-nav-movil')

    expect(enlaces.map((e) => e.text())).toEqual([
      'Dashboard',
      'Egresos',
      'Ingresos',
      'Bandeja',
      'Presupuestos',
      'Categorías',
      'Bancos',
    ])
    expect(bottomNav.find('.boton-fab').exists()).toBe(true)
    const botones = bottomNav.findAll('button.item-nav-movil')
    expect(botones.at(-1)?.text()).toBe('Salir')
  })
})

describe('AppShellLayout — bottom nav scrollable no rompe el layout (Épica 11, ajuste de alcance)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    wrapperActivo?.unmount()
    wrapperActivo = null
  })

  // Nota: jsdom bajo Vitest no inyecta el CSS `scoped` compilado de los SFC
  // (getComputedStyle devuelve '' para `overflow-x`/`flex-shrink` aunque la
  // regla exista en `<style scoped>`), así que no se puede verificar el
  // layout real aquí. En su lugar se verifica que el DOM tenga exactamente
  // las clases de las que dependen esas reglas (fuente de verdad: el bloque
  // `<style>` de `AppShellLayout.vue`, revisado manualmente junto a este test:
  // `.navegacion-inferior { overflow-x: auto }` y
  // `.item-nav-movil, .boton-fab, .texto-version-movil { flex-shrink: 0 }`).
  it('el contenedor del bottom nav tiene la clase "navegacion-inferior" (única regla de overflow-x:auto del layout)', async () => {
    const wrapper = await montarShell()
    const bottomNav = wrapper.find('nav.navegacion-inferior')

    expect(bottomNav.exists()).toBe(true)
    expect(bottomNav.classes()).toContain('navegacion-inferior')
  })

  it('cada ítem del bottom nav (enlaces, FAB y "Salir") tiene la clase con flex-shrink:0, para no recortarse dentro del scroll', async () => {
    const wrapper = await montarShell()
    const bottomNav = wrapper.find('nav.navegacion-inferior')

    const enlaces = bottomNav.findAll('a.item-nav-movil')
    const botonSalir = bottomNav.findAll('button.item-nav-movil').at(-1)
    const boton = bottomNav.find('.boton-fab')

    expect(enlaces.length).toBeGreaterThan(0)
    for (const enlace of enlaces) {
      expect(enlace.classes()).toContain('item-nav-movil')
    }
    expect(botonSalir?.classes()).toContain('item-nav-movil')
    expect(boton.classes()).toContain('boton-fab')
  })

  it('el texto de versión dentro del bottom nav tiene la clase "texto-version-movil" (flex-shrink:0, no se aplasta en el scroll)', async () => {
    const wrapper = await montarShell()
    const textoVersionMovil = wrapper.find('nav.navegacion-inferior .texto-version')

    expect(textoVersionMovil.exists()).toBe(true)
    expect(textoVersionMovil.classes()).toContain('texto-version-movil')
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

/**
 * Regresión del bug reportado por QA: al abrir "Nuevo gasto" desde el
 * Dashboard recién cargado (sin haber visitado antes Historial/Bancos/
 * Ingresos, las únicas vistas que antes cargaban el catálogo), el selector
 * de Banco mostraba "No hay bancos; créalos primero." aunque el usuario sí
 * tuviera bancos en BD. El fix mueve la carga de bancos/categorías al
 * `onMounted` del shell, que es el único componente garantizado activo
 * antes de que cualquier modal pueda abrirse.
 */
describe('AppShellLayout — fix: bancos/categorías se cargan al montar el shell, sin depender de la vista activa', () => {
  const bancoFalso = { id: 'b1', usuario_id: 'u1', nombre: 'BCP', created_at: '' }
  const categoriaFalsa = {
    id: 'c1',
    usuario_id: 'u1',
    nombre: 'Comida',
    predefinida: false,
    activa: true,
    creado_en: '',
  }

  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    wrapperActivo?.unmount()
    wrapperActivo = null
  })

  /** Abre "Nuevo gasto" desde el botón directo del sidebar (equivalente desktop al FAB móvil). */
  async function abrirNuevoGasto(wrapper: VueWrapper) {
    const botonGasto = wrapper
      .findAll('.item-nav-boton')
      .find((boton) => boton.text() === 'Registrar gasto')!
    await botonGasto.trigger('click')
    await wrapper.vm.$nextTick()
  }

  it('camino feliz: con bancos reales en BD, tras montar el shell en el Dashboard el selector de Banco YA NO muestra "No hay bancos; créalos primero."', async () => {
    fromMock.mockImplementation((tabla: string) => {
      const builder = crearConstructorConsulta()
      if (tabla === 'bancos') {
        ;(builder.order as Mock).mockResolvedValue({ data: [bancoFalso], error: null })
      } else {
        ;(builder.order as Mock).mockResolvedValue({ data: [], error: null })
      }
      return builder
    })

    const storeIngresos = useIngresosStore()
    expect(storeIngresos.bancos).toHaveLength(0)

    const wrapper = await montarShell()
    await flushPromises()

    // El shell hidrató el store de bancos sin que ninguna vista lo pidiera.
    expect(storeIngresos.bancos.length).toBeGreaterThan(0)

    await abrirNuevoGasto(wrapper)

    const alertas = wrapper.findAll('[role="alert"]')
    expect(alertas.some((alerta) => alerta.text().includes('No hay bancos'))).toBe(false)
    expect(wrapper.find('#banco').attributes('disabled')).toBeUndefined()
  })

  it('camino feliz simétrico (categorías): con categorías activas reales en BD, el formulario de gasto YA NO muestra "No hay categorías; créalas primero."', async () => {
    fromMock.mockImplementation((tabla: string) => {
      const builder = crearConstructorConsulta()
      if (tabla === 'categorias') {
        ;(builder.order as Mock).mockResolvedValue({ data: [categoriaFalsa], error: null })
      } else {
        ;(builder.order as Mock).mockResolvedValue({ data: [], error: null })
      }
      return builder
    })

    const storeGastos = useGastosStore()
    expect(storeGastos.categorias).toHaveLength(0)

    const wrapper = await montarShell()
    await flushPromises()

    expect(storeGastos.categorias.length).toBeGreaterThan(0)

    await abrirNuevoGasto(wrapper)

    const alertas = wrapper.findAll('[role="alert"]')
    expect(alertas.some((alerta) => alerta.text().includes('No hay categorías'))).toBe(false)
  })

  it('borde: si el usuario realmente no tiene bancos, "No hay bancos; créalos primero." SÍ aparece y el envío queda deshabilitado', async () => {
    // El mock por defecto del `beforeEach` global ya devuelve listas vacías
    // para todas las tablas: reproduce al usuario sin bancos ni categorías.
    const wrapper = await montarShell()
    await flushPromises()

    await abrirNuevoGasto(wrapper)

    const alertas = wrapper.findAll('[role="alert"]')
    expect(alertas.some((alerta) => alerta.text().includes('No hay bancos'))).toBe(true)
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined()
  })

  it('borde: el shell pide bancos y categorías exactamente una vez en su onMounted (punto único de carga por sesión)', async () => {
    await montarShell()
    await flushPromises()

    const llamadasBancos = fromMock.mock.calls.filter(([tabla]) => tabla === 'bancos')
    const llamadasCategorias = fromMock.mock.calls.filter(([tabla]) => tabla === 'categorias')

    expect(llamadasBancos).toHaveLength(1)
    expect(llamadasCategorias).toHaveLength(1)
  })
})
