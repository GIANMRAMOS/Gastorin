import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ModalCategoria from '@/components/ModalCategoria.vue'
import { useUiStore } from '@/stores/ui'

let wrapperActivo: VueWrapper | null = null

describe('ModalCategoria (cierre solo por botón explícito)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    wrapperActivo?.unmount()
    wrapperActivo = null
  })

  it('camino feliz: el botón X emite "cerrar"', async () => {
    const wrapper = mount(ModalCategoria, {
      props: { categoria: null },
      global: { stubs: { FormularioCategoria: true } },
    })
    wrapperActivo = wrapper

    await wrapper.find('button.modal-cerrar').trigger('click')

    expect(wrapper.emitted('cerrar')).toHaveLength(1)
  })

  it('borde: clic en el backdrop NO cierra', async () => {
    const wrapper = mount(ModalCategoria, {
      props: { categoria: null },
      global: { stubs: { FormularioCategoria: true } },
    })
    wrapperActivo = wrapper

    await wrapper.find('.modal-fondo').trigger('click')

    expect(wrapper.emitted('cerrar')).toBeUndefined()
  })

  it('borde: Escape NO cierra', async () => {
    const wrapper = mount(ModalCategoria, {
      props: { categoria: null },
      global: { stubs: { FormularioCategoria: true } },
    })
    wrapperActivo = wrapper

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('cerrar')).toBeUndefined()
  })

  it('contrato con AppShellLayout: al montarse abre el modal en storeUi y al desmontarse lo cierra', () => {
    const storeUi = useUiStore()
    expect(storeUi.modalAbierto).toBe(false)

    const wrapper = mount(ModalCategoria, {
      props: { categoria: null },
      global: { stubs: { FormularioCategoria: true } },
    })
    wrapperActivo = wrapper

    expect(storeUi.modalAbierto).toBe(true)

    wrapper.unmount()
    wrapperActivo = null

    expect(storeUi.modalAbierto).toBe(false)
  })
})
