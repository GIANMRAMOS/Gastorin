import { beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import TarjetaPresupuesto from '@/components/TarjetaPresupuesto.vue'
import { useGastosStore } from '@/stores/gastos'
import type { Categoria, Presupuesto } from '@/types/gasto'

const categoriaComida: Categoria = {
  id: 'c1',
  usuario_id: 'u1',
  nombre: 'Comida',
  predefinida: true,
  activa: true,
  creado_en: '',
  abreviatura: 'C',
}

const presupuestoBase: Presupuesto = {
  id: 'p1',
  usuario_id: 'u1',
  categoria_id: 'c1',
  mes: '2026-07-01',
  moneda: 'PEN',
  monto_limite: 500,
  creado_en: '',
}

function montarTarjeta(gastado: number) {
  const store = useGastosStore()
  store.establecerCategorias([categoriaComida])
  return mount(TarjetaPresupuesto, { props: { presupuesto: presupuestoBase, gastado } })
}

describe('TarjetaPresupuesto', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('HU-6.2 — progreso y alerta de sobregiro', () => {
    it('camino feliz: muestra gastado/límite, porcentaje y el nombre de la categoría', () => {
      const wrapper = montarTarjeta(100)

      expect(wrapper.text()).toContain('Comida')
      expect(wrapper.find('.texto-porcentaje').text()).toBe('20%')
      expect(wrapper.find('.monto-gastado').exists()).toBe(true)
      expect(wrapper.find('.monto-limite').exists()).toBe(true)
    })

    it('estado normal (<85%): la barra no tiene clase de advertencia/sobregiro y no hay banner', () => {
      const wrapper = montarTarjeta(100)

      const barra = wrapper.find('.barra-progreso')
      expect(barra.classes()).toContain('estado-normal')
      expect(barra.classes()).not.toContain('estado-cerca')
      expect(barra.classes()).not.toContain('estado-sobregiro')
      expect(wrapper.find('.banner-sobregiro').exists()).toBe(false)
    })

    it('estado "cerca del límite" (85%-100%): la barra tiene la clase cerca', () => {
      const wrapper = montarTarjeta(425) // 85% de 500

      expect(wrapper.find('.barra-progreso').classes()).toContain('estado-cerca')
      expect(wrapper.find('.banner-sobregiro').exists()).toBe(false)
    })

    it('estado "cerca del límite" también cubre exactamente 100%', () => {
      const wrapper = montarTarjeta(500)

      expect(wrapper.find('.barra-progreso').classes()).toContain('estado-cerca')
    })

    it('estado sobregiro (>100%): la barra tiene la clase sobregiro y aparece el banner con el monto excedido', () => {
      const wrapper = montarTarjeta(600)

      expect(wrapper.find('.barra-progreso').classes()).toContain('estado-sobregiro')
      const banner = wrapper.find('.banner-sobregiro')
      expect(banner.exists()).toBe(true)
      // Excedente: 600 - 500 = 100.
      expect(banner.text()).toContain('100')
    })

    it('la barra visual no supera el 100% de ancho aunque el porcentaje real sea mayor', () => {
      const wrapper = montarTarjeta(1000) // 200% real

      const estilo = wrapper.find('.barra-progreso').attributes('style') ?? ''
      expect(estilo).toContain('width: 100%')
    })

    it('a11y: el texto del porcentaje siempre usa --color-texto, nunca el color variable de la barra (estado normal)', () => {
      const wrapper = montarTarjeta(100)
      verificarColorTextoFijo(wrapper)
    })

    it('a11y: el texto del porcentaje siempre usa --color-texto, nunca el color variable de la barra (estado cerca)', () => {
      const wrapper = montarTarjeta(450)
      verificarColorTextoFijo(wrapper)
    })

    it('a11y: el texto del porcentaje siempre usa --color-texto, nunca el color variable de la barra (estado sobregiro)', () => {
      const wrapper = montarTarjeta(600)
      verificarColorTextoFijo(wrapper)
    })
  })
})

/** El texto del porcentaje no debe llevar ninguna de las clases de estado de la barra. */
function verificarColorTextoFijo(wrapper: VueWrapper) {
  const texto = wrapper.find('.texto-porcentaje')
  expect(texto.classes()).not.toContain('estado-normal')
  expect(texto.classes()).not.toContain('estado-cerca')
  expect(texto.classes()).not.toContain('estado-sobregiro')
}
