import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import TarjetaSaldosPorCuenta from '@/components/TarjetaSaldosPorCuenta.vue'
import type { SaldoCuenta } from '@/composables/useDashboard'

function montar(cuentas: SaldoCuenta[]) {
  return mount(TarjetaSaldosPorCuenta, { props: { cuentas } })
}

describe('TarjetaSaldosPorCuenta (reemplaza el placeholder "Próximamente")', () => {
  it('BCP: un tile con su nombre tal cual y el saldo en PEN', () => {
    const wrapper = montar([{ bancoId: 'b1', nombreBanco: 'BCP', saldoPen: 1250.5, saldoUsd: null }])

    const tiles = wrapper.findAll('.tile-saldo-cuenta')
    expect(tiles).toHaveLength(1)
    expect(tiles[0].find('.nombre-cuenta').text()).toBe('BCP')
    expect(tiles[0].text()).toContain('S/')
  })

  it('saldo positivo usa la clase "saldo-positivo", nunca "saldo-negativo"', () => {
    const wrapper = montar([{ bancoId: 'b1', nombreBanco: 'BCP', saldoPen: 500, saldoUsd: null }])

    const monto = wrapper.find('.monto-saldo-cuenta')
    expect(monto.classes()).toContain('saldo-positivo')
    expect(monto.classes()).not.toContain('saldo-negativo')
  })

  it('borde: saldo negativo (más gastado que ingresado en esa cuenta) usa la clase "saldo-negativo"', () => {
    const wrapper = montar([{ bancoId: 'b1', nombreBanco: 'BCP', saldoPen: -120, saldoUsd: null }])

    const monto = wrapper.find('.monto-saldo-cuenta')
    expect(monto.classes()).toContain('saldo-negativo')
    expect(monto.classes()).not.toContain('saldo-positivo')
  })

  it('BCP con USD: muestra el badge secundario en dólares (BCP no cambia de comportamiento)', () => {
    const wrapper = montar([{ bancoId: 'b1', nombreBanco: 'BCP', saldoPen: 500, saldoUsd: -15.1 }])

    const secundario = wrapper.find('.saldo-secundario-cuenta')
    expect(secundario.exists()).toBe(true)
    expect(secundario.text()).toContain('$')
  })

  it('BCP sin USD: NO muestra ningún badge secundario', () => {
    const wrapper = montar([{ bancoId: 'b1', nombreBanco: 'BCP', saldoPen: 500, saldoUsd: null }])

    expect(wrapper.find('.saldo-secundario-cuenta').exists()).toBe(false)
  })

  it('IBK: se etiqueta "IBK S/." y muestra su saldo en soles como monto principal', () => {
    const wrapper = montar([{ bancoId: 'b2', nombreBanco: 'IBK', saldoPen: 300, saldoUsd: null }])

    const tiles = wrapper.findAll('.tile-saldo-cuenta')
    expect(tiles).toHaveLength(1)
    expect(tiles[0].find('.nombre-cuenta').text()).toBe('IBK S/.')
    expect(tiles[0].text()).toContain('S/')
  })

  it('"IBK US$" es un banco REAL y separado (no una moneda secundaria de "IBK"): se etiqueta "IBK $" y su monto PRINCIPAL es el saldo en dólares, no en soles', () => {
    const wrapper = montar([{ bancoId: 'b3', nombreBanco: 'IBK US$', saldoPen: 0, saldoUsd: 5088 }])

    const tiles = wrapper.findAll('.tile-saldo-cuenta')
    expect(tiles).toHaveLength(1)
    expect(tiles[0].find('.nombre-cuenta').text()).toBe('IBK $')
    // Bug corregido: antes se mostraba "S/ 0.00" como principal (el campo saldoPen,
    // siempre 0 para esta cuenta) en vez del saldo real en dólares.
    expect(tiles[0].find('.monto-saldo-cuenta').text()).toContain('$')
    expect(tiles[0].find('.monto-saldo-cuenta').text()).not.toContain('S/')
  })

  it('BCP, IBK e "IBK US$" son 3 cuentas reales independientes: 3 tiles, uno por bancoId, sin dividir ninguna en dos', () => {
    const wrapper = montar([
      { bancoId: 'b1', nombreBanco: 'BCP', saldoPen: 1000, saldoUsd: null },
      { bancoId: 'b2', nombreBanco: 'IBK', saldoPen: 300, saldoUsd: null },
      { bancoId: 'b3', nombreBanco: 'IBK US$', saldoPen: 0, saldoUsd: 5088 },
    ])

    const tiles = wrapper.findAll('.tile-saldo-cuenta')
    expect(tiles).toHaveLength(3)
    expect(tiles.map((t) => t.find('.nombre-cuenta').text())).toEqual(['BCP', 'IBK S/.', 'IBK $'])
  })

  it('borde: sin cuentas (ni BCP ni IBK creadas todavía) muestra un mensaje, no tiles vacíos', () => {
    const wrapper = montar([])

    expect(wrapper.find('.mensaje-sin-cuentas').exists()).toBe(true)
    expect(wrapper.text()).toContain('BCP')
    expect(wrapper.text()).toContain('IBK')
    expect(wrapper.findAll('.tile-saldo-cuenta')).toHaveLength(0)
  })

  describe('setear saldo (migración 011): cada tile es clickeable', () => {
    it('camino feliz: cada tile es un <button>; tocar el de BCP emite "editar-cuenta" con su bancoId/moneda/etiqueta', async () => {
      const wrapper = montar([{ bancoId: 'b1', nombreBanco: 'BCP', saldoPen: 1000, saldoUsd: null }])

      const tile = wrapper.find('.tile-saldo-cuenta')
      expect(tile.element.tagName).toBe('BUTTON')
      await tile.trigger('click')

      expect(wrapper.emitted('editar-cuenta')).toEqual([[{ bancoId: 'b1', moneda: 'PEN', etiqueta: 'BCP' }]])
    })

    it('tocar el tile "IBK S/." emite editar-cuenta con moneda PEN y la etiqueta ya resuelta', async () => {
      const wrapper = montar([{ bancoId: 'b2', nombreBanco: 'IBK', saldoPen: 300, saldoUsd: null }])

      await wrapper.find('.tile-saldo-cuenta').trigger('click')

      expect(wrapper.emitted('editar-cuenta')).toEqual([[{ bancoId: 'b2', moneda: 'PEN', etiqueta: 'IBK S/.' }]])
    })

    it('tocar el tile "IBK $" emite editar-cuenta con moneda USD (el mismo bancoId de "IBK US$", no el de "IBK")', async () => {
      const wrapper = montar([{ bancoId: 'b3', nombreBanco: 'IBK US$', saldoPen: 0, saldoUsd: 5088 }])

      await wrapper.find('.tile-saldo-cuenta').trigger('click')

      expect(wrapper.emitted('editar-cuenta')).toEqual([[{ bancoId: 'b3', moneda: 'USD', etiqueta: 'IBK $' }]])
    })

    it('con 3 cuentas, cada tile emite su propio evento independiente al tocarlo', async () => {
      const wrapper = montar([
        { bancoId: 'b1', nombreBanco: 'BCP', saldoPen: 1000, saldoUsd: null },
        { bancoId: 'b2', nombreBanco: 'IBK', saldoPen: 300, saldoUsd: null },
        { bancoId: 'b3', nombreBanco: 'IBK US$', saldoPen: 0, saldoUsd: 5088 },
      ])

      const tiles = wrapper.findAll('.tile-saldo-cuenta')
      await tiles[2].trigger('click')

      expect(wrapper.emitted('editar-cuenta')).toEqual([[{ bancoId: 'b3', moneda: 'USD', etiqueta: 'IBK $' }]])
    })
  })
})
