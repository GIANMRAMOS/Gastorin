import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import TarjetaPresupuesto from '@/components/TarjetaPresupuesto.vue'
import { useGastosStore } from '@/stores/gastos'
import type { Categoria, Presupuesto } from '@/types/gasto'

/**
 * Suite de validación INDEPENDIENTE (QA), no del dev-builder. Se enfoca en
 * los umbrales EXACTOS de la barra de progreso (HU-6.2) y en confirmar, de
 * forma estructural (no solo revisando texto de CSS), que el color del
 * texto del porcentaje nunca cambia entre estados.
 */
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

describe('TarjetaPresupuesto — umbrales exactos y a11y (QA independiente, HU-6.2)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('umbrales exactos de la barra', () => {
    it('84% exacto (420/500) es estado normal, NO cerca', () => {
      const wrapper = montarTarjeta(420)
      const barra = wrapper.find('.barra-progreso')
      expect(barra.classes()).toContain('estado-normal')
      expect(barra.classes()).not.toContain('estado-cerca')
      expect(barra.classes()).not.toContain('estado-sobregiro')
    })

    it('85% exacto (425/500) ya es estado "cerca" (umbral >=85%)', () => {
      const wrapper = montarTarjeta(425)
      const barra = wrapper.find('.barra-progreso')
      expect(barra.classes()).toContain('estado-cerca')
      expect(barra.classes()).not.toContain('estado-normal')
      expect(barra.classes()).not.toContain('estado-sobregiro')
    })

    it('99.99% (499.95/500) sigue siendo "cerca", NO sobregiro', () => {
      const wrapper = montarTarjeta(499.95)
      const barra = wrapper.find('.barra-progreso')
      expect(barra.classes()).toContain('estado-cerca')
      expect(barra.classes()).not.toContain('estado-sobregiro')
    })

    it('100% EXACTO (500/500) es "cerca", NO sobregiro (el backlog exige ">100%" para sobregiro)', () => {
      const wrapper = montarTarjeta(500)
      const barra = wrapper.find('.barra-progreso')
      expect(barra.classes()).toContain('estado-cerca')
      expect(barra.classes()).not.toContain('estado-sobregiro')
      expect(wrapper.find('.banner-sobregiro').exists()).toBe(false)
    })

    it('100.01% exacto (500.05/500) ya es sobregiro, con banner', () => {
      const wrapper = montarTarjeta(500.05)
      const barra = wrapper.find('.barra-progreso')
      expect(barra.classes()).toContain('estado-sobregiro')
      expect(barra.classes()).not.toContain('estado-cerca')
      expect(wrapper.find('.banner-sobregiro').exists()).toBe(true)
    })

    it('un centavo por encima del límite (500.01/500) ya cuenta como sobregiro', () => {
      const wrapper = montarTarjeta(500.01)
      expect(wrapper.find('.barra-progreso').classes()).toContain('estado-sobregiro')
    })
  })

  describe('a11y del texto de porcentaje — verificación estructural, no solo de CSS en texto', () => {
    it('el elemento .texto-porcentaje NO lleva ninguna clase dinámica de estado en ninguno de los 3 casos, mientras la barra sí cambia de clase', () => {
      const casos = [
        { gastado: 100, estadoEsperadoBarra: 'estado-normal' }, // 20%
        { gastado: 450, estadoEsperadoBarra: 'estado-cerca' }, // 90%
        { gastado: 600, estadoEsperadoBarra: 'estado-sobregiro' }, // 120%
      ]

      const clasesTextoPorEstado = casos.map(({ gastado, estadoEsperadoBarra }) => {
        const wrapper = montarTarjeta(gastado)
        const barra = wrapper.find('.barra-progreso')
        const texto = wrapper.find('.texto-porcentaje')

        // La barra SÍ debe reflejar el estado correspondiente (si esto
        // fallara, invalidaría el resto de la prueba).
        expect(barra.classes()).toContain(estadoEsperadoBarra)

        return texto.classes().sort().join(',')
      })

      // El texto del porcentaje debe tener EXACTAMENTE la misma lista de
      // clases (ninguna clase de estado) en los 3 casos.
      expect(new Set(clasesTextoPorEstado).size).toBe(1)
      expect(clasesTextoPorEstado[0]).toBe('texto-porcentaje')
    })

    it('el template fuente no liga ninguna clase condicional (:class) al elemento .texto-porcentaje (evita regresión silenciosa)', () => {
      const rutaComponente = resolve(process.cwd(), 'src/components/TarjetaPresupuesto.vue')
      const fuente = readFileSync(rutaComponente, 'utf-8')
      const matchTemplate = fuente.match(/<template>[\s\S]*<\/template>/)
      expect(matchTemplate).not.toBeNull()
      const template = matchTemplate![0]
      const lineaTexto = template.split('\n').find((linea) => linea.includes('texto-porcentaje'))
      expect(lineaTexto).toBeDefined()
      // Solo debe llevar la clase estática "texto-porcentaje", sin binding
      // `:class` que pudiera introducir un color dependiente del estado.
      expect(lineaTexto).not.toMatch(/:class/)
    })

    it('la regla CSS .texto-porcentaje no está condicionada por .estado-normal/.estado-cerca/.estado-sobregiro (color fijo)', () => {
      const rutaComponente = resolve(process.cwd(), 'src/components/TarjetaPresupuesto.vue')
      const fuente = readFileSync(rutaComponente, 'utf-8')
      // No debe existir un selector combinado que ligue el texto de
      // porcentaje a alguna clase de estado (p.ej. ".estado-sobregiro .texto-porcentaje").
      expect(fuente).not.toMatch(/estado-(normal|cerca|sobregiro)[^{]*texto-porcentaje/)
      expect(fuente).not.toMatch(/texto-porcentaje[^{]*estado-(normal|cerca|sobregiro)/)
    })
  })
})
