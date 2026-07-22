import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import TarjetaBalanceMoneda from '@/components/TarjetaBalanceMoneda.vue'

async function montarTarjeta(props: {
  moneda: 'PEN' | 'USD'
  ingresos: number
  gastos: number
  balance: number
}) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'dashboard', component: { template: '<div />' } },
      { path: '/ingresos', name: 'ingresos', component: { template: '<div />' } },
    ],
  })
  router.push('/')
  await router.isReady()

  return mount(TarjetaBalanceMoneda, { props, global: { plugins: [router] } })
}

describe('TarjetaBalanceMoneda (HU-11.4)', () => {
  it('camino feliz: balance positivo usa --color-primario (clase balance-positivo), no una paleta nueva', async () => {
    const wrapper = await montarTarjeta({ moneda: 'PEN', ingresos: 500, gastos: 200, balance: 300 })

    const monto = wrapper.find('.monto-balance')
    expect(monto.classes()).toContain('balance-positivo')
    expect(monto.classes()).not.toContain('balance-negativo')
    expect(wrapper.text()).toContain('Balance PEN')
    expect(wrapper.text()).toContain('S/')
  })

  it('borde: balance negativo usa --color-error (clase balance-negativo) con señal visual distinta', async () => {
    const wrapper = await montarTarjeta({ moneda: 'PEN', ingresos: 100, gastos: 400, balance: -300 })

    const monto = wrapper.find('.monto-balance')
    expect(monto.classes()).toContain('balance-negativo')
    expect(monto.classes()).not.toContain('balance-positivo')
  })

  it('la señal visual (icono) difiere entre balance positivo y negativo', async () => {
    const wrapperPositivo = await montarTarjeta({ moneda: 'PEN', ingresos: 500, gastos: 200, balance: 300 })
    const wrapperNegativo = await montarTarjeta({ moneda: 'PEN', ingresos: 100, gastos: 400, balance: -300 })

    const iconoPositivo = wrapperPositivo.find('[aria-hidden="true"]').text()
    const iconoNegativo = wrapperNegativo.find('[aria-hidden="true"]').text()
    expect(iconoPositivo).not.toBe(iconoNegativo)
  })

  it('balance en cero se trata como no-negativo (clase balance-positivo), consistente con "≥0"', async () => {
    const wrapper = await montarTarjeta({ moneda: 'USD', ingresos: 100, gastos: 100, balance: 0 })

    expect(wrapper.find('.monto-balance').classes()).toContain('balance-positivo')
  })

  it('borde clave — separación de monedas: PEN y USD se renderizan como tarjetas independientes, nunca sumadas entre sí', async () => {
    const wrapperPen = await montarTarjeta({ moneda: 'PEN', ingresos: 500, gastos: 200, balance: 300 })
    const wrapperUsd = await montarTarjeta({ moneda: 'USD', ingresos: 80, gastos: 20, balance: 60 })

    expect(wrapperPen.text()).toContain('Balance PEN')
    expect(wrapperPen.text()).not.toContain('Balance USD')
    expect(wrapperUsd.text()).toContain('Balance USD')
    expect(wrapperUsd.text()).not.toContain('Balance PEN')

    // Los montos se formatean en su propia moneda (S/ vs $), nunca mezclados.
    expect(wrapperPen.text()).toContain('S/')
    expect(wrapperUsd.text()).toContain('$')
  })

  it('el enlace "Ver ingresos" apunta a la ruta {name: "ingresos"}', async () => {
    const wrapper = await montarTarjeta({ moneda: 'PEN', ingresos: 500, gastos: 200, balance: 300 })

    const enlace = wrapper.find('.enlace-ver-ingresos')
    expect(enlace.exists()).toBe(true)
    expect(enlace.attributes('href')).toBe('/ingresos')
  })
})
