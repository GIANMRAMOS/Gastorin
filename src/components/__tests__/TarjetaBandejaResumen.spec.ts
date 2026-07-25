import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import TarjetaBandejaResumen from '@/components/TarjetaBandejaResumen.vue'
import type { Gasto } from '@/types/gasto'

function gastoDe(datos: Partial<Gasto>): Gasto {
  return {
    id: 'b1',
    usuario_id: 'u1',
    categoria_id: 'c1',
    banco_id: 'bc1',
    monto: 45.5,
    moneda: 'PEN',
    fecha: '2026-07-10',
    descripcion: 'Grifo Primax',
    origen: 'correo',
    estado: 'borrador',
    gmail_message_id: null,
    gmail_fragmento: null,
    creado_en: '',
    actualizado_en: '',
    ...datos,
  }
}

/** Router mínimo con la ruta `bandeja` a la que navega el botón "Revisar bandeja". */
function crearRouterDePrueba() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'raiz', component: { template: '<div />' } },
      { path: '/bandeja', name: 'bandeja', component: { template: '<div>Bandeja</div>' } },
    ],
  })
}

describe('TarjetaBandejaResumen (Fase 1 "Caudal")', () => {
  it('camino feliz: con cantidad 0, muestra el blurb "todo al día" (SIEMPRE visible, ver GATE1)', () => {
    const wrapper = mount(TarjetaBandejaResumen, {
      props: { cantidad: 0 },
      global: { plugins: [crearRouterDePrueba()] },
    })

    expect(wrapper.text()).toContain('Todo al día')
    expect(wrapper.find('.conteo-bandeja-resumen').exists()).toBe(false)
  })

  it('camino feliz: con cantidad > 0, muestra el conteo y el peek del primer borrador', () => {
    const wrapper = mount(TarjetaBandejaResumen, {
      props: { cantidad: 3, peek: gastoDe({ descripcion: 'Grifo Primax', monto: 45.5, moneda: 'PEN' }) },
      global: { plugins: [crearRouterDePrueba()] },
    })

    expect(wrapper.find('.conteo-bandeja-resumen').text()).toContain('3 gastos por confirmar')
    expect(wrapper.find('.peek-descripcion-bandeja').text()).toBe('Grifo Primax')
    expect(wrapper.find('.peek-monto-bandeja').text()).toContain('45.50')
  })

  it('borde: singular "1 gasto por confirmar" (no "1 gastos")', () => {
    const wrapper = mount(TarjetaBandejaResumen, {
      props: { cantidad: 1, peek: gastoDe({}) },
      global: { plugins: [crearRouterDePrueba()] },
    })

    expect(wrapper.find('.conteo-bandeja-resumen').text()).toBe('1 gasto por confirmar')
  })

  it('borde: peek en revisión manual sin monto/moneda completos no muestra un monto inventado', () => {
    const wrapper = mount(TarjetaBandejaResumen, {
      props: {
        cantidad: 1,
        peek: gastoDe({ estado: 'revision_manual', monto: null, moneda: null }),
      },
      global: { plugins: [crearRouterDePrueba()] },
    })

    expect(wrapper.find('.peek-monto-bandeja').exists()).toBe(false)
  })

  it('botón "Revisar bandeja" navega a la ruta `bandeja`', async () => {
    const router = crearRouterDePrueba()
    router.push('/')
    await router.isReady()

    const wrapper = mount(TarjetaBandejaResumen, {
      props: { cantidad: 2, peek: gastoDe({}) },
      global: { plugins: [router] },
    })

    const boton = wrapper.find('.boton-revisar-bandeja')
    expect(boton.text()).toBe('Revisar bandeja')

    await boton.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('bandeja')
  })
})
