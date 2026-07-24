import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ModalIngreso from '@/components/ModalIngreso.vue'
import { useUiStore } from '@/stores/ui'
import type { Ingreso } from '@/types/ingreso'

const ingresoBase: Ingreso = {
  id: 'i1',
  usuario_id: 'u1',
  banco_id: 'b1',
  fecha: '2026-07-10',
  moneda: 'PEN',
  importe: 100,
  concepto: 'Sueldo',
  created_at: '',
}

let wrapperActivo: VueWrapper | null = null

describe('ModalIngreso (cierre solo por botón explícito)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    wrapperActivo?.unmount()
    wrapperActivo = null
  })

  it('camino feliz: el botón X emite "cerrar"', async () => {
    const wrapper = mount(ModalIngreso, {
      global: { stubs: { FormularioIngreso: true } },
    })
    wrapperActivo = wrapper

    await wrapper.find('button.modal-cerrar').trigger('click')

    expect(wrapper.emitted('cerrar')).toHaveLength(1)
  })

  it('borde: clic en el backdrop NO cierra', async () => {
    const wrapper = mount(ModalIngreso, {
      global: { stubs: { FormularioIngreso: true } },
    })
    wrapperActivo = wrapper

    await wrapper.find('.modal-fondo').trigger('click')

    expect(wrapper.emitted('cerrar')).toBeUndefined()
  })

  it('borde: Escape NO cierra', async () => {
    const wrapper = mount(ModalIngreso, {
      global: { stubs: { FormularioIngreso: true } },
    })
    wrapperActivo = wrapper

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('cerrar')).toBeUndefined()
  })

  it('contrato con AppShellLayout: al montarse abre el modal en storeUi y al desmontarse lo cierra', () => {
    const storeUi = useUiStore()
    expect(storeUi.modalAbierto).toBe(false)

    const wrapper = mount(ModalIngreso, {
      global: { stubs: { FormularioIngreso: true } },
    })
    wrapperActivo = wrapper

    expect(storeUi.modalAbierto).toBe(true)

    wrapper.unmount()
    wrapperActivo = null

    expect(storeUi.modalAbierto).toBe(false)
  })

  it('sin prop ingreso: título "Nuevo ingreso"', () => {
    const wrapper = mount(ModalIngreso, {
      global: { stubs: { FormularioIngreso: true } },
    })
    wrapperActivo = wrapper

    expect(wrapper.find('h2').text()).toBe('Nuevo ingreso')
  })

  it('con prop ingreso: título "Editar ingreso" y el prop se reenvía a FormularioIngreso', () => {
    const wrapper = mount(ModalIngreso, {
      props: { ingreso: ingresoBase },
      global: { stubs: { FormularioIngreso: true } },
    })
    wrapperActivo = wrapper

    expect(wrapper.find('h2').text()).toBe('Editar ingreso')
    expect(wrapper.findComponent({ name: 'FormularioIngreso' }).props('ingreso')).toEqual(
      ingresoBase,
    )
  })
})
