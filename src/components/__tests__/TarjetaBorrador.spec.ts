import { beforeEach, describe, expect, it, type Mock } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import TarjetaBorrador from '@/components/TarjetaBorrador.vue'
import { useGastosStore } from '@/stores/gastos'
import { supabase } from '@/lib/supabaseClient'
import { crearConstructorConsulta } from '@/lib/__mocks__/supabaseClient'
import type { Categoria, Gasto } from '@/types/gasto'

const fromMock = supabase.from as unknown as Mock

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

const categorias: Categoria[] = [
  { id: 'c1', usuario_id: 'u1', nombre: 'Alimentación', predefinida: true, activa: true, creado_en: '', abreviatura: 'A' },
  { id: 'c2', usuario_id: 'u1', nombre: 'Transporte', predefinida: true, activa: true, creado_en: '', abreviatura: 'T' },
]

const borradorCompleto: Gasto = {
  id: 'b1',
  usuario_id: 'u1',
  categoria_id: 'c1',
  monto: 45.5,
  moneda: 'PEN',
  fecha: '2026-07-20',
  descripcion: 'Compra supermercado',
  origen: 'correo',
  estado: 'borrador',
  gmail_message_id: 'msg-1',
  gmail_fragmento: 'BCP: consumo por S/ 45.50',
  creado_en: '',
  actualizado_en: '',
}

const borradorRevisionManual: Gasto = {
  ...borradorCompleto,
  id: 'b2',
  monto: null,
  moneda: null,
  estado: 'revision_manual',
}

describe('TarjetaBorrador', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('camino feliz: muestra el fragmento de correo, comercio, monto/moneda y fecha', () => {
    const wrapper = mount(TarjetaBorrador, { props: { borrador: borradorCompleto, categorias } })

    expect(wrapper.text()).toContain('BCP: consumo por S/ 45.50')
    expect(wrapper.text()).toContain('Compra supermercado')
    expect(wrapper.text()).toContain('2026-07-20')
    expect(wrapper.find('.chip-moneda').text()).toBe('PEN')
    expect(wrapper.find('.etiqueta-alerta').exists()).toBe(false)
  })

  it('borde: revisión manual muestra el indicador de advertencia y bloquea Confirmar', () => {
    const wrapper = mount(TarjetaBorrador, { props: { borrador: borradorRevisionManual, categorias } })

    expect(wrapper.find('.etiqueta-alerta').exists()).toBe(true)
    expect(wrapper.find('.campo-dudoso.resaltado').exists()).toBe(true)
    const botonConfirmar = wrapper.find('.boton-confirmar')
    expect(botonConfirmar.attributes('disabled')).toBeDefined()
  })

  it('la categoría se muestra tras un chip tocable que expande alternativas al tocarlo (1 toque abre)', async () => {
    const wrapper = mount(TarjetaBorrador, { props: { borrador: borradorCompleto, categorias } })

    expect(wrapper.find('.chips-categoria-alternativas').exists()).toBe(false)
    await wrapper.find('.chip-categoria-tocable').trigger('click')
    expect(wrapper.find('.chips-categoria-alternativas').exists()).toBe(true)
  })

  it('camino feliz: elegir un chip alternativo (1 toque) persiste la nueva categoría', async () => {
    const wrapper = mount(TarjetaBorrador, { props: { borrador: borradorCompleto, categorias } })
    await wrapper.find('.chip-categoria-tocable').trigger('click')

    const builder = crearConstructorConsulta()
    fromMock.mockReturnValueOnce(builder)
    ;(builder.single as Mock).mockResolvedValueOnce({
      data: { ...borradorCompleto, categoria_id: 'c2' },
      error: null,
    })

    const chips = wrapper.findAll('.chips-categoria-alternativas .chip-categoria')
    const chipTransporte = chips.find((c) => c.text().includes('Transporte'))!
    await chipTransporte.trigger('click')
    await flushPromises()

    expect(builder.update).toHaveBeenCalledWith({ categoria_id: 'c2' })
    expect(builder.eq).toHaveBeenCalledWith('id', 'b1')
    expect(wrapper.find('.chips-categoria-alternativas').exists()).toBe(false)
  })

  it('camino feliz: confirmar un borrador completo llama a confirmarBorrador con un UPDATE', async () => {
    useGastosStore().establecerBorradores([borradorCompleto])
    const wrapper = mount(TarjetaBorrador, { props: { borrador: borradorCompleto, categorias } })

    const builder = crearConstructorConsulta()
    fromMock.mockReturnValueOnce(builder)
    ;(builder.single as Mock).mockResolvedValueOnce({
      data: { ...borradorCompleto, estado: 'confirmado' },
      error: null,
    })

    await wrapper.find('.boton-confirmar').trigger('click')
    await flushPromises()

    expect(builder.update).toHaveBeenCalledWith({ estado: 'confirmado' })
  })

  it('camino feliz: completar monto/moneda en revisión manual habilita Confirmar y lo envía', async () => {
    useGastosStore().establecerBorradores([borradorRevisionManual])
    const wrapper = mount(TarjetaBorrador, { props: { borrador: borradorRevisionManual, categorias } })

    await wrapper.find('input[type="text"]').setValue('30')
    await wrapper.findAll('.toggle-moneda button')[0].trigger('click') // PEN

    expect(wrapper.find('.boton-confirmar').attributes('disabled')).toBeUndefined()

    const builder = crearConstructorConsulta()
    fromMock.mockReturnValueOnce(builder)
    ;(builder.single as Mock).mockResolvedValueOnce({
      data: { ...borradorRevisionManual, monto: 30, moneda: 'PEN', estado: 'confirmado' },
      error: null,
    })

    await wrapper.find('.boton-confirmar').trigger('click')
    await flushPromises()

    expect(builder.update).toHaveBeenCalledWith({ monto: 30, moneda: 'PEN', estado: 'confirmado' })
  })

  it('camino feliz: descartar llama al soft-delete estado=descartado', async () => {
    const wrapper = mount(TarjetaBorrador, { props: { borrador: borradorCompleto, categorias } })

    const builder = crearConstructorConsulta()
    fromMock.mockReturnValueOnce(builder)
    ;(builder.eq as Mock).mockResolvedValueOnce({ error: null })

    await wrapper.find('.boton-descartar').trigger('click')
    await flushPromises()

    expect(builder.update).toHaveBeenCalledWith({ estado: 'descartado' })
    expect(builder.eq).toHaveBeenCalledWith('id', 'b1')
  })
})
