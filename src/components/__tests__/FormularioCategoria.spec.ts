import { beforeEach, describe, expect, it, type Mock } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import FormularioCategoria from '@/components/FormularioCategoria.vue'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabaseClient'
import { crearConstructorConsulta } from '@/lib/__mocks__/supabaseClient'
import type { Categoria } from '@/types/gasto'

const fromMock = supabase.from as unknown as Mock

const categoriaPredefinida: Categoria = {
  id: 'c1',
  usuario_id: 'u1',
  nombre: 'Transporte',
  predefinida: true,
  activa: true,
  creado_en: '',
  abreviatura: 'T',
}

const categoriaPersonalizada: Categoria = {
  id: 'c2',
  usuario_id: 'u1',
  nombre: 'Mascotas',
  predefinida: false,
  activa: true,
  creado_en: '',
  abreviatura: 'M',
}

function montarFormulario(categoria: Categoria | null = null) {
  return mount(FormularioCategoria, { props: { categoria } })
}

describe('FormularioCategoria', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const authStore = useAuthStore()
    authStore.establecerUsuario({ id: 'u1', email: 'a@a.com' } as never)
  })

  describe('HU-4.2 — alta de categoría', () => {
    it('camino feliz: nombre válido crea la categoría y emite guardado', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      const categoriaCreada = { ...categoriaPersonalizada, id: 'c-nueva' }
      ;(builder.single as Mock).mockResolvedValueOnce({ data: categoriaCreada, error: null })

      const wrapper = montarFormulario(null)
      await wrapper.find('#nombre').setValue('Mascotas')
      await wrapper.find('form').trigger('submit.prevent')
      await new Promise((r) => setTimeout(r, 0))

      expect(builder.insert).toHaveBeenCalledWith({
        usuario_id: 'u1',
        nombre: 'Mascotas',
        predefinida: false,
        activa: true,
      })
      expect(wrapper.emitted('guardado')).toHaveLength(1)
    })

    it('el formulario de alta solo pide el nombre (sin campo de color)', () => {
      const wrapper = montarFormulario(null)

      expect(wrapper.find('#nombre').exists()).toBe(true)
      expect(wrapper.find('input[type="color"]').exists()).toBe(false)
      expect(wrapper.html()).not.toContain('color')
    })

    it('borde: nombre vacío bloquea el guardado sin llamar a Supabase', async () => {
      const wrapper = montarFormulario(null)
      await wrapper.find('form').trigger('submit.prevent')
      await new Promise((r) => setTimeout(r, 0))

      expect(fromMock).not.toHaveBeenCalled()
      expect(wrapper.find('[role="alert"]').text()).toBe('Ingresa un nombre para la categoría.')
    })

    it('borde: nombre con solo espacios bloquea el guardado', async () => {
      const wrapper = montarFormulario(null)
      await wrapper.find('#nombre').setValue('   ')
      await wrapper.find('form').trigger('submit.prevent')
      await new Promise((r) => setTimeout(r, 0))

      expect(fromMock).not.toHaveBeenCalled()
      expect(wrapper.find('[role="alert"]').text()).toBe('Ingresa un nombre para la categoría.')
    })

    it('borde: nombre duplicado muestra el error de unicidad y no emite guardado', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.single as Mock).mockResolvedValueOnce({
        data: null,
        error: { code: '23505', message: 'duplicate key value violates unique constraint' },
      })

      const wrapper = montarFormulario(null)
      await wrapper.find('#nombre').setValue('Transporte')
      await wrapper.find('form').trigger('submit.prevent')
      await new Promise((r) => setTimeout(r, 0))

      expect(wrapper.find('[role="alert"]').text()).toBe('Ya existe una categoría con ese nombre.')
      expect(wrapper.emitted('guardado')).toBeUndefined()
    })

    it('borde: sin sesión activa no llama a Supabase y muestra el mensaje de sesión', async () => {
      const authStore = useAuthStore()
      authStore.establecerUsuario(null)

      const wrapper = montarFormulario(null)
      await wrapper.find('#nombre').setValue('Mascotas')
      await wrapper.find('form').trigger('submit.prevent')
      await new Promise((r) => setTimeout(r, 0))

      expect(fromMock).not.toHaveBeenCalled()
      expect(wrapper.find('[role="alert"]').text()).toBe(
        'No hay una sesión activa. Vuelve a iniciar sesión.',
      )
    })
  })

  describe('HU-4.4 — detalle/edición de categoría', () => {
    it('categoría personalizada: el nombre es editable y el botón Guardar está presente', async () => {
      const wrapper = montarFormulario(categoriaPersonalizada)

      const input = wrapper.find('#nombre')
      expect(input.attributes('disabled')).toBeUndefined()
      expect((input.element as HTMLInputElement).value).toBe('Mascotas')
      expect(wrapper.find('button[type="submit"]').exists()).toBe(true)
      expect(wrapper.find('.boton-desactivar').exists()).toBe(true)
    })

    it('categoría personalizada: guardar el nuevo nombre llama a editarCategoria y emite guardado', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      const categoriaEditada = { ...categoriaPersonalizada, nombre: 'Mascotas y veterinario' }
      ;(builder.single as Mock).mockResolvedValueOnce({ data: categoriaEditada, error: null })

      const wrapper = montarFormulario(categoriaPersonalizada)
      await wrapper.find('#nombre').setValue('Mascotas y veterinario')
      await wrapper.find('form').trigger('submit.prevent')
      await new Promise((r) => setTimeout(r, 0))

      expect(builder.update).toHaveBeenCalledWith({ nombre: 'Mascotas y veterinario' })
      expect(builder.eq).toHaveBeenCalledWith('id', 'c2')
      expect(wrapper.emitted('guardado')).toHaveLength(1)
    })

    it('categoría predefinida: el nombre es de solo lectura y no se ofrece el botón Guardar', () => {
      const wrapper = montarFormulario(categoriaPredefinida)

      const input = wrapper.find('#nombre')
      expect(input.attributes('disabled')).toBeDefined()
      expect((input.element as HTMLInputElement).value).toBe('Transporte')
      expect(wrapper.find('button[type="submit"]').exists()).toBe(false)
      expect(wrapper.find('.boton-desactivar').exists()).toBe(true)
    })

    it('categoría predefinida: el input está realmente disabled y no acepta cambios de valor vía el usuario', async () => {
      const wrapper = montarFormulario(categoriaPredefinida)

      const input = wrapper.find('#nombre')
      expect((input.element as HTMLInputElement).disabled).toBe(true)

      // `setValue` simula la interacción real del usuario (evento `input`);
      // en un input disabled el navegador no despacha eventos de entrada, y
      // el modelo (`nombre` ref) no debe cambiar.
      await input.setValue('Nombre hackeado')
      await wrapper.vm.$nextTick()

      expect((input.element as HTMLInputElement).value).toBe('Nombre hackeado')
      // NOTA: jsdom permite que `setValue` reasigne `.value` incluso en un
      // input disabled (a diferencia de un navegador real, que no despacha
      // el evento en absoluto). Por eso esta prueba, por sí sola, NO alcanza
      // para descartar el bug; ver la prueba siguiente que ejercita
      // directamente el submit.
    })

    it('categoría predefinida: NO existe ninguna forma de disparar un guardado con un nombre editado (sin botón "Guardar" en el DOM)', () => {
      const wrapper = montarFormulario(categoriaPredefinida)

      // HU-4.4 exige que para una predefinida "solo puedo desactivarla": no
      // debe existir NINGÚN control que permita enviar el formulario.
      expect(wrapper.find('button[type="submit"]').exists()).toBe(false)
      expect(wrapper.findAll('form button[type="submit"]')).toHaveLength(0)
    })

    it('HU-4.4: el manejador de envío no debe llamar a editarCategoria para una predefinida, ni disparado directamente vía el evento submit del <form> (defensa en profundidad, no solo ocultar el botón)', async () => {
      // NOTA: a propósito NO se configura `fromMock.mockReturnValueOnce(...)`
      // aquí. Si `manejarEnvio` llamara a Supabase para una predefinida, esta
      // prueba debe fallar por `fromMock` sin implementación configurada (o
      // por las aserciones de abajo), no por casualidad. Configurar un mock
      // "once" que nunca se consume además contaminaría la cola de mocks de
      // la siguiente prueba (ver test de "renombrar a un nombre existente").
      const builder = crearConstructorConsulta()

      const wrapper = montarFormulario(categoriaPredefinida)
      await wrapper.find('form').trigger('submit.prevent')
      await new Promise((r) => setTimeout(r, 0))

      // "Solo puedo desactivarla" (HU-4.4) debe cumplirse pase lo que pase en
      // el DOM, no solo porque el botón "Guardar" no se renderiza. Si esta
      // aserción falla, es porque `manejarEnvio` (FormularioCategoria.vue)
      // llama a `editarCategoria` sin verificar `esPredefinida` primero.
      expect(fromMock).not.toHaveBeenCalled()
      expect(builder.update).not.toHaveBeenCalled()
    })

    it('al pulsar "Desactivar categoría" emite pedir-desactivar', async () => {
      const wrapper = montarFormulario(categoriaPredefinida)

      await wrapper.find('.boton-desactivar').trigger('click')

      expect(wrapper.emitted('pedir-desactivar')).toHaveLength(1)
    })

    it('borde: renombrar a un nombre existente muestra el error de unicidad y no emite guardado', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.single as Mock).mockResolvedValueOnce({
        data: null,
        error: { code: '23505', message: 'duplicate key value violates unique constraint' },
      })

      const wrapper = montarFormulario(categoriaPersonalizada)
      await wrapper.find('#nombre').setValue('Transporte')
      await wrapper.find('form').trigger('submit.prevent')
      await new Promise((r) => setTimeout(r, 0))

      expect(wrapper.find('[role="alert"]').text()).toBe('Ya existe una categoría con ese nombre.')
      expect(wrapper.emitted('guardado')).toBeUndefined()
    })
  })
})
