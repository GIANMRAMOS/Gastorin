import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ProximamenteView from '@/views/ProximamenteView.vue'

/**
 * Vista placeholder compartida por las rutas stub `graficos`/`maestros`
 * (GATE1-#1 de `dev-plan.md`, Fase 1 "Caudal"): evita enlaces muertos en el
 * nav mientras esas secciones no tienen pantalla propia.
 */
describe('ProximamenteView (Fase 1 "Caudal")', () => {
  it('camino feliz: renderiza "Próximamente"', () => {
    const wrapper = mount(ProximamenteView)

    expect(wrapper.text()).toContain('Próximamente')
  })

  it('con un título, lo muestra en un h1', () => {
    const wrapper = mount(ProximamenteView, { props: { titulo: 'Gráficos' } })

    expect(wrapper.find('h1').text()).toBe('Gráficos')
  })

  it('sin título, no renderiza ningún h1 (uso genérico)', () => {
    const wrapper = mount(ProximamenteView)

    expect(wrapper.find('h1').exists()).toBe(false)
  })
})
