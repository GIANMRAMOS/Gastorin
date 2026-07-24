import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import TarjetaBalanceMoneda from '@/components/TarjetaBalanceMoneda.vue'

function montarTarjeta(props: {
  moneda: 'PEN' | 'USD'
  ingresos: number
  gastos: number
  balance: number
  montoSecundario?: number
  monedaSecundaria?: 'PEN' | 'USD'
}) {
  return mount(TarjetaBalanceMoneda, { props })
}

describe('TarjetaBalanceMoneda (HU-11.4)', () => {
  it('camino feliz: balance positivo usa --color-primario (clase balance-positivo), no una paleta nueva', async () => {
    const wrapper = montarTarjeta({ moneda: 'PEN', ingresos: 500, gastos: 200, balance: 300 })

    const monto = wrapper.find('.monto-balance')
    expect(monto.classes()).toContain('balance-positivo')
    expect(monto.classes()).not.toContain('balance-negativo')
    expect(wrapper.text()).toContain('Balance PEN')
    expect(wrapper.text()).toContain('S/')
  })

  it('borde: balance negativo usa --color-error (clase balance-negativo) con señal visual distinta', async () => {
    const wrapper = montarTarjeta({ moneda: 'PEN', ingresos: 100, gastos: 400, balance: -300 })

    const monto = wrapper.find('.monto-balance')
    expect(monto.classes()).toContain('balance-negativo')
    expect(monto.classes()).not.toContain('balance-positivo')
  })

  it('no se renderiza ningún ícono/triángulo junto al monto (solo texto)', async () => {
    const wrapper = montarTarjeta({ moneda: 'PEN', ingresos: 500, gastos: 200, balance: 300 })

    expect(wrapper.find('[aria-hidden="true"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('▲')
    expect(wrapper.text()).not.toContain('▼')
  })

  it('balance en cero se trata como no-negativo (clase balance-positivo), consistente con "≥0"', async () => {
    const wrapper = montarTarjeta({ moneda: 'USD', ingresos: 100, gastos: 100, balance: 0 })

    expect(wrapper.find('.monto-balance').classes()).toContain('balance-positivo')
  })

  it('borde clave — separación de monedas: PEN y USD se renderizan como tarjetas independientes, nunca sumadas entre sí', async () => {
    const wrapperPen = montarTarjeta({ moneda: 'PEN', ingresos: 500, gastos: 200, balance: 300 })
    const wrapperUsd = montarTarjeta({ moneda: 'USD', ingresos: 80, gastos: 20, balance: 60 })

    expect(wrapperPen.text()).toContain('Balance PEN')
    expect(wrapperPen.text()).not.toContain('Balance USD')
    expect(wrapperUsd.text()).toContain('Balance USD')
    expect(wrapperUsd.text()).not.toContain('Balance PEN')

    // Los montos se formatean en su propia moneda (S/ vs $), nunca mezclados.
    expect(wrapperPen.text()).toContain('S/')
    expect(wrapperUsd.text()).toContain('$')
  })

  it('no se renderiza ningún enlace "Ver ingresos" (se quitó de la tarjeta)', async () => {
    const wrapper = montarTarjeta({ moneda: 'PEN', ingresos: 500, gastos: 200, balance: 300 })

    expect(wrapper.find('.enlace-ver-ingresos').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Ver ingresos')
  })

  it('insignia USD (balance positivo): muestra el balance secundario formateado en $ sin afectar el signo del principal', async () => {
    const wrapper = montarTarjeta({
      moneda: 'PEN',
      ingresos: 500,
      gastos: 200,
      balance: 300,
      montoSecundario: 60,
      monedaSecundaria: 'USD',
    })

    const insignia = wrapper.find('.insignia-secundaria')
    expect(insignia.exists()).toBe(true)
    expect(insignia.text()).toContain('60.00')
    expect(insignia.text()).toContain('$')
    expect(wrapper.find('.monto-balance').classes()).toContain('balance-positivo')
  })

  it('insignia USD (balance negativo): la clase de signo del principal se mantiene con la insignia presente', async () => {
    const wrapper = montarTarjeta({
      moneda: 'PEN',
      ingresos: 100,
      gastos: 400,
      balance: -300,
      montoSecundario: -25,
      monedaSecundaria: 'USD',
    })

    const monto = wrapper.find('.monto-balance')
    expect(monto.classes()).toContain('balance-negativo')
    expect(wrapper.find('.insignia-secundaria').exists()).toBe(true)
  })

  it('borde: sin montoSecundario/monedaSecundaria no se renderiza la insignia', async () => {
    const wrapper = montarTarjeta({ moneda: 'PEN', ingresos: 500, gastos: 200, balance: 300 })

    expect(wrapper.find('.insignia-secundaria').exists()).toBe(false)
  })
})
