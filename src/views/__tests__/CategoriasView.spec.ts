import { beforeEach, describe, expect, it, type Mock } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import CategoriasView from '@/views/CategoriasView.vue'
import { useGastosStore } from '@/stores/gastos'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabaseClient'
import { crearConstructorConsulta } from '@/lib/__mocks__/supabaseClient'
import type { Categoria, Gasto } from '@/types/gasto'
import type { Ingreso } from '@/types/ingreso'

const fromMock = supabase.from as unknown as Mock

const categoriaComida: Categoria = {
  id: 'c1',
  usuario_id: 'u1',
  nombre: 'Comida',
  tipo: 'gasto',
  predefinida: true,
  activa: true,
  creado_en: '',
  abreviatura: 'C',
}

const categoriaOcio: Categoria = {
  id: 'c2',
  usuario_id: 'u1',
  nombre: 'Ocio',
  tipo: 'gasto',
  predefinida: true,
  activa: true,
  creado_en: '',
  abreviatura: 'O',
}

const categoriaMascotas: Categoria = {
  id: 'c3',
  usuario_id: 'u1',
  nombre: 'Mascotas',
  tipo: 'gasto',
  predefinida: false,
  activa: true,
  creado_en: '',
  abreviatura: 'M',
}

const categoriaIngresoOtros: Categoria = {
  id: 'ci1',
  usuario_id: 'u1',
  nombre: 'Otros ingresos',
  tipo: 'ingreso',
  predefinida: true,
  activa: true,
  creado_en: '',
  abreviatura: 'O',
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

function ingresoDe(categoriaId: string, fecha: string): Ingreso {
  return {
    id: `i-${categoriaId}-${fecha}`,
    usuario_id: 'u1',
    banco_id: 'b1',
    categoria_id: categoriaId,
    fecha,
    moneda: 'PEN',
    importe: 100,
    concepto: 'Concepto',
    created_at: '',
  }
}

/**
 * `onMounted` llama a `cargarCategorias`, `cargarGastos` y `cargarIngresos`
 * (Épica 12, toggle Egresos/Ingresos): se configuran los tres `from` en orden.
 */
function prepararCargaInicial(categorias: Categoria[], gastos: Gasto[], ingresos: Ingreso[] = []) {
  const builderCategorias = crearConstructorConsulta()
  const builderGastos = crearConstructorConsulta()
  const builderIngresos = crearConstructorConsulta()
  fromMock
    .mockReturnValueOnce(builderCategorias)
    .mockReturnValueOnce(builderGastos)
    .mockReturnValueOnce(builderIngresos)
  ;(builderCategorias.order as Mock).mockResolvedValueOnce({ data: categorias, error: null })
  ;(builderGastos.order as Mock).mockResolvedValueOnce({ data: gastos, error: null })
  ;(builderIngresos.order as Mock).mockResolvedValueOnce({ data: ingresos, error: null })
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
      expect(wrapper.text()).toContain('Todavía no tienes categorías personalizadas de Egreso.')
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
      expect(wrapper.text()).toContain('Todavía no tienes categorías personalizadas de Egreso.')
    })

    it('blindaje (GATE 1 Fase 2 + toggle Épica 12): en el tab Egresos (por defecto) una categoría de tipo "ingreso" NUNCA aparece, aunque `cargarCategorias` traiga ambos tipos mezclados', async () => {
      prepararCargaInicial([categoriaComida, categoriaIngresoOtros], [])

      const wrapper = mount(CategoriasView)
      await new Promise((r) => setTimeout(r, 0))
      await wrapper.vm.$nextTick()

      expect(wrapper.text()).not.toContain('Otros ingresos')
      expect(wrapper.findAll('.fila-categoria')).toHaveLength(1)
      // La categoría de ingreso sigue en el store (mixta), solo se filtra en el render.
      const store = useGastosStore()
      expect(store.categorias.some((c) => c.id === 'ci1')).toBe(true)
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

  describe('Épica 12 — toggle Egresos/Ingresos (hueco reportado tras la Fase 2 "Caudal")', () => {
    it('camino feliz: al tocar el chip "Ingresos", se muestran las categorías de tipo ingreso y se ocultan las de gasto', async () => {
      prepararCargaInicial([categoriaComida, categoriaIngresoOtros], [])

      const wrapper = mount(CategoriasView)
      await new Promise((r) => setTimeout(r, 0))
      await wrapper.vm.$nextTick()

      const chips = wrapper.findAll('.chip-tipo')
      expect(chips.map((c) => c.text())).toEqual(['Egresos', 'Ingresos'])
      await chips[1].trigger('click')

      expect(wrapper.text()).toContain('Otros ingresos')
      expect(wrapper.text()).not.toContain('Comida')
    })

    it('el contador de una categoría de Ingreso cuenta ingresos del mes (no gastos), y respeta el mes actual', async () => {
      prepararCargaInicial(
        [categoriaIngresoOtros],
        [],
        [ingresoDe('ci1', '2026-07-01'), ingresoDe('ci1', '2026-07-02'), ingresoDe('ci1', '2020-01-01')],
      )

      const wrapper = mount(CategoriasView)
      await new Promise((r) => setTimeout(r, 0))
      await wrapper.vm.$nextTick()

      await wrapper.find('.chip-tipo:nth-child(2)').trigger('click')

      const mesActual = new Date().toISOString().slice(0, 7)
      const esperado = mesActual === '2026-07' ? '2 ingresos este mes' : '0 ingresos este mes'
      expect(wrapper.text()).toContain(esperado)
    })

    it('crear una categoría nueva desde el tab Ingresos abre el modal con tipo="ingreso"', async () => {
      prepararCargaInicial([categoriaComida, categoriaIngresoOtros], [])

      const wrapper = mount(CategoriasView)
      await new Promise((r) => setTimeout(r, 0))
      await wrapper.vm.$nextTick()

      await wrapper.find('.chip-tipo:nth-child(2)').trigger('click')
      await wrapper.find('.boton-nuevo').trigger('click')

      const modal = wrapper.findComponent({ name: 'ModalCategoria' })
      expect(modal.props('tipo')).toBe('ingreso')
    })

    it('el mensaje de desactivar es coherente con el tipo de la categoría (menciona "ingresos" al desactivar una de tipo ingreso)', async () => {
      prepararCargaInicial([categoriaComida, categoriaIngresoOtros], [])

      const wrapper = mount(CategoriasView)
      await new Promise((r) => setTimeout(r, 0))
      await wrapper.vm.$nextTick()

      await wrapper.find('.chip-tipo:nth-child(2)').trigger('click')
      await wrapper.find('.fila-categoria').trigger('click')
      await wrapper.findComponent({ name: 'FormularioCategoria' }).find('.boton-desactivar').trigger('click')

      expect(wrapper.text()).toContain('nuevos ingresos')
    })
  })

  describe('HU-4.2 — crear categoría', () => {
    it('camino feliz: pulsar "+ Nueva categoría" abre el modal de alta (solo pide nombre)', async () => {
      prepararCargaInicial([categoriaComida], [])

      const wrapper = mount(CategoriasView)
      await new Promise((r) => setTimeout(r, 0))
      await wrapper.vm.$nextTick()

      await wrapper.find('.boton-nuevo').trigger('click')

      const modal = wrapper.findComponent({ name: 'ModalCategoria' })
      expect(modal.exists()).toBe(true)
      expect(modal.props('tipo')).toBe('gasto')
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
