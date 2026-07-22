import { beforeEach, describe, expect, it, type Mock } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import CategoriasView from '@/views/CategoriasView.vue'
import { useGastosStore } from '@/stores/gastos'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabaseClient'
import { crearConstructorConsulta } from '@/lib/__mocks__/supabaseClient'
import type { Categoria, Gasto } from '@/types/gasto'

const fromMock = supabase.from as unknown as Mock

const categoriaComida: Categoria = {
  id: 'c1',
  usuario_id: 'u1',
  nombre: 'Comida',
  predefinida: true,
  activa: true,
  creado_en: '',
  abreviatura: 'C',
}

const categoriaOcio: Categoria = {
  id: 'c2',
  usuario_id: 'u1',
  nombre: 'Ocio',
  predefinida: true,
  activa: true,
  creado_en: '',
  abreviatura: 'O',
}

const categoriaMascotas: Categoria = {
  id: 'c3',
  usuario_id: 'u1',
  nombre: 'Mascotas',
  predefinida: false,
  activa: true,
  creado_en: '',
  abreviatura: 'M',
}

function gastoDe(categoriaId: string, fecha: string): Gasto {
  return {
    id: `g-${categoriaId}-${fecha}`,
    usuario_id: 'u1',
    categoria_id: categoriaId,
    banco_id: 'b1',
    monto: 10,
    moneda: 'PEN',
    fecha,
    descripcion: null,
    origen: 'manual',
    estado: 'confirmado',
    gmail_message_id: null,
    gmail_fragmento: null,
    creado_en: '',
    actualizado_en: '',
  }
}

/** `onMounted` llama a `cargarCategorias` y `cargarGastos`: se configuran ambos `from` en orden. */
function prepararCargaInicial(categorias: Categoria[], gastos: Gasto[]) {
  const builderCategorias = crearConstructorConsulta()
  const builderGastos = crearConstructorConsulta()
  fromMock.mockReturnValueOnce(builderCategorias).mockReturnValueOnce(builderGastos)
  ;(builderCategorias.order as Mock).mockResolvedValueOnce({ data: categorias, error: null })
  ;(builderGastos.order as Mock).mockResolvedValueOnce({ data: gastos, error: null })
}

describe('CategoriasView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const authStore = useAuthStore()
    authStore.establecerUsuario({ id: 'u1', email: 'a@a.com' } as never)
  })

  describe('HU-4.1 — secciones agrupadas y contador', () => {
    it('camino feliz: renderiza las secciones Predefinidas y Personalizadas, cada fila con círculo, nombre y contador', async () => {
      prepararCargaInicial(
        [categoriaComida, categoriaOcio, categoriaMascotas],
        [gastoDe('c1', '2026-07-05'), gastoDe('c1', '2026-07-10'), gastoDe('c1', '2026-07-15')],
      )

      const wrapper = mount(CategoriasView)
      await new Promise((r) => setTimeout(r, 0))
      await wrapper.vm.$nextTick()

      const secciones = wrapper.findAll('.titulo-seccion')
      expect(secciones.map((s) => s.text())).toEqual(['Predefinidas', 'Personalizadas'])

      const filas = wrapper.findAll('.fila-categoria')
      expect(filas).toHaveLength(3)
      expect(wrapper.text()).toContain('Comida')
      expect(wrapper.text()).toContain('3 gastos este mes')
    })

    it('borde: sin categorías personalizadas, la sección aparece vacía sin romper la de predefinidas', async () => {
      prepararCargaInicial([categoriaComida, categoriaOcio], [])

      const wrapper = mount(CategoriasView)
      await new Promise((r) => setTimeout(r, 0))
      await wrapper.vm.$nextTick()

      expect(wrapper.findAll('.fila-categoria')).toHaveLength(2)
      expect(wrapper.text()).toContain('Todavía no tienes categorías personalizadas.')
    })

    it('borde: una categoría predefinida INACTIVA no aparece en esta vista (a diferencia de Historial, que sí debe resolverla para gastos históricos)', async () => {
      const predefinidaInactiva: Categoria = {
        ...categoriaOcio,
        id: 'c-inactiva-predef',
        activa: false,
      }
      prepararCargaInicial([categoriaComida, predefinidaInactiva], [])

      const wrapper = mount(CategoriasView)
      await new Promise((r) => setTimeout(r, 0))
      await wrapper.vm.$nextTick()

      // Solo la predefinida activa ("Comida") se lista; la desactivada queda
      // fuera de la gestión (aunque siga existiendo en el store para que
      // Historial pueda resolverla).
      expect(wrapper.findAll('.fila-categoria')).toHaveLength(1)
      const store = useGastosStore()
      expect(store.categorias.some((c) => c.id === 'c-inactiva-predef')).toBe(true)
    })

    it('borde: una categoría personalizada INACTIVA no aparece en "Personalizadas" y no cuenta como si estuviera vacía si hay otras activas', async () => {
      const personalizadaInactiva: Categoria = {
        ...categoriaMascotas,
        id: 'c-inactiva-personal',
        activa: false,
      }
      prepararCargaInicial([categoriaComida, personalizadaInactiva], [])

      const wrapper = mount(CategoriasView)
      await new Promise((r) => setTimeout(r, 0))
      await wrapper.vm.$nextTick()

      expect(wrapper.text()).not.toContain('Mascotas')
      expect(wrapper.text()).toContain('Todavía no tienes categorías personalizadas.')
    })

    it('el contador cuenta solo los gastos del mes actual (asume "hoy" dentro del mes 2026-07 en las pruebas)', async () => {
      prepararCargaInicial(
        [categoriaComida],
        [gastoDe('c1', '2026-07-01'), gastoDe('c1', '2026-07-02'), gastoDe('c1', '2020-01-01')],
      )

      const wrapper = mount(CategoriasView)
      await new Promise((r) => setTimeout(r, 0))
      await wrapper.vm.$nextTick()

      const mesActual = new Date().toISOString().slice(0, 7)
      const esperado = mesActual === '2026-07' ? '2 gastos este mes' : '0 gastos este mes'
      expect(wrapper.text()).toContain(esperado)
    })
  })

  describe('HU-4.2 — crear categoría', () => {
    it('camino feliz: pulsar "+ Nueva categoría" abre el modal de alta (solo pide nombre)', async () => {
      prepararCargaInicial([categoriaComida], [])

      const wrapper = mount(CategoriasView)
      await new Promise((r) => setTimeout(r, 0))
      await wrapper.vm.$nextTick()

      await wrapper.find('.boton-nuevo').trigger('click')

      expect(wrapper.findComponent({ name: 'ModalCategoria' }).exists()).toBe(true)
      expect(wrapper.find('#nombre').exists()).toBe(true)
    })
  })

  describe('HU-4.4 — abrir detalle al tocar una fila', () => {
    it('camino feliz: tocar una fila abre el modal de detalle con esa categoría', async () => {
      prepararCargaInicial([categoriaComida], [])

      const wrapper = mount(CategoriasView)
      await new Promise((r) => setTimeout(r, 0))
      await wrapper.vm.$nextTick()

      await wrapper.find('.fila-categoria').trigger('click')

      const modal = wrapper.findComponent({ name: 'ModalCategoria' })
      expect(modal.exists()).toBe(true)
      expect(modal.props('categoria')).toEqual(categoriaComida)
    })
  })

  describe('HU-4.3 — desactivar categoría', () => {
    it('camino feliz: confirmar la desactivación llama a Supabase y la categoría desaparece de la lista', async () => {
      prepararCargaInicial([categoriaComida, categoriaMascotas], [])

      const wrapper = mount(CategoriasView)
      await new Promise((r) => setTimeout(r, 0))
      await wrapper.vm.$nextTick()

      await wrapper.findAll('.fila-categoria')[1].trigger('click')
      await wrapper.findComponent({ name: 'FormularioCategoria' }).find('.boton-desactivar').trigger('click')

      const builderDesactivar = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builderDesactivar)
      const categoriaDesactivada = { ...categoriaMascotas, activa: false }
      ;(builderDesactivar.single as Mock).mockResolvedValueOnce({
        data: categoriaDesactivada,
        error: null,
      })

      await wrapper.find('.dialogo-acciones .boton-primario').trigger('click')
      await new Promise((r) => setTimeout(r, 0))
      await wrapper.vm.$nextTick()

      expect(builderDesactivar.update).toHaveBeenCalledWith({ activa: false })
      const store = useGastosStore()
      expect(store.categorias.find((c) => c.id === 'c3')?.activa).toBe(false)
      expect(wrapper.text()).not.toContain('Mascotas')
    })
  })
})
