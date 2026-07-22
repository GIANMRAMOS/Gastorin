import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import HojaAccionesFab from '@/components/HojaAccionesFab.vue'
import { useUiStore } from '@/stores/ui'

let wrapperActivo: VueWrapper | null = null

describe('HojaAccionesFab (Épica 11, UX — bottom sheet del FAB móvil)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    wrapperActivo?.unmount()
    wrapperActivo = null
  })

  it('camino feliz: se abre con exactamente 2 opciones ("Registrar gasto" y "Registrar ingreso")', () => {
    const wrapper = mount(HojaAccionesFab)
    wrapperActivo = wrapper

    const opciones = wrapper.findAll('.opcion-hoja')
    expect(opciones).toHaveLength(2)
    expect(opciones[0].text()).toBe('Registrar gasto')
    expect(opciones[1].text()).toBe('Registrar ingreso')
  })

  it('contrato con AppShellLayout: al montarse llama storeUi.abrirModal() (oculta el bottom nav)', () => {
    const storeUi = useUiStore()
    expect(storeUi.modalAbierto).toBe(false)

    const wrapper = mount(HojaAccionesFab)
    wrapperActivo = wrapper

    expect(storeUi.modalAbierto).toBe(true)
  })

  it('al desmontarse llama storeUi.cerrarModal()', () => {
    const storeUi = useUiStore()
    const wrapper = mount(HojaAccionesFab)

    expect(storeUi.modalAbierto).toBe(true)
    wrapper.unmount()

    expect(storeUi.modalAbierto).toBe(false)
  })

  it('cierra al hacer clic en el backdrop (fuera del contenido de la hoja)', async () => {
    const wrapper = mount(HojaAccionesFab)
    wrapperActivo = wrapper

    await wrapper.find('.hoja-fondo').trigger('click')

    expect(wrapper.emitted('cerrar')).toHaveLength(1)
  })

  it('NO cierra al hacer clic dentro del contenido de la hoja (solo el backdrop dispara el cierre)', async () => {
    const wrapper = mount(HojaAccionesFab)
    wrapperActivo = wrapper

    await wrapper.find('.hoja-contenido').trigger('click')

    expect(wrapper.emitted('cerrar')).toBeUndefined()
  })

  it('cierra al presionar Escape, sin importar dónde esté el foco', async () => {
    const wrapper = mount(HojaAccionesFab)
    wrapperActivo = wrapper

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('cerrar')).toHaveLength(1)
  })

  it('otras teclas no disparan el cierre', async () => {
    const wrapper = mount(HojaAccionesFab)
    wrapperActivo = wrapper

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('cerrar')).toBeUndefined()
  })

  it('el botón "Cancelar" también emite cerrar', async () => {
    const wrapper = mount(HojaAccionesFab)
    wrapperActivo = wrapper

    await wrapper.find('.boton-cancelar-hoja').trigger('click')

    expect(wrapper.emitted('cerrar')).toHaveLength(1)
  })

  it('elegir "Registrar gasto" emite registrar-gasto (el orquestador — AppShellLayout — abre ModalGasto)', async () => {
    const wrapper = mount(HojaAccionesFab)
    wrapperActivo = wrapper

    await wrapper.findAll('.opcion-hoja')[0].trigger('click')

    expect(wrapper.emitted('registrar-gasto')).toHaveLength(1)
    expect(wrapper.emitted('registrar-ingreso')).toBeUndefined()
  })

  it('elegir "Registrar ingreso" emite registrar-ingreso (el orquestador — AppShellLayout — abre ModalIngreso)', async () => {
    const wrapper = mount(HojaAccionesFab)
    wrapperActivo = wrapper

    await wrapper.findAll('.opcion-hoja')[1].trigger('click')

    expect(wrapper.emitted('registrar-ingreso')).toHaveLength(1)
    expect(wrapper.emitted('registrar-gasto')).toBeUndefined()
  })
})
