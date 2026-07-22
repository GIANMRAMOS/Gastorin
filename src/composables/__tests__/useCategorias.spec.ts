import { beforeEach, describe, expect, it, type Mock } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useCategorias } from '@/composables/useCategorias'
import { useGastosStore } from '@/stores/gastos'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabaseClient'
import { crearConstructorConsulta } from '@/lib/__mocks__/supabaseClient'
import type { Categoria } from '@/types/gasto'

/**
 * `supabase.from` viene del mock manual (`vi.mock('@/lib/supabaseClient')` en
 * `src/test/setup.ts`). Ver `useGastos.spec.ts` para el patrón de mockeo.
 */
const fromMock = supabase.from as unknown as Mock

const categoriaBase: Categoria = {
  id: 'c1',
  usuario_id: 'u1',
  nombre: 'Comida',
  predefinida: true,
  activa: true,
  creado_en: '',
  abreviatura: 'C',
}

describe('useCategorias', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('cargarCategorias', () => {
    it('camino feliz: carga TODAS las categorías (activas e inactivas) ordenadas por nombre y las guarda en el store', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      const categoriasFalsas = [
        { id: 'c1', usuario_id: 'u1', nombre: 'Comida', predefinida: true, activa: true, creado_en: '' },
        { id: 'c2', usuario_id: 'u1', nombre: 'Ocio', predefinida: true, activa: false, creado_en: '' },
      ]
      ;(builder.order as Mock).mockResolvedValueOnce({ data: categoriasFalsas, error: null })

      const { cargarCategorias } = useCategorias()
      const store = useGastosStore()
      const exito = await cargarCategorias()

      expect(exito).toBe(true)
      expect(fromMock).toHaveBeenCalledWith('categorias')
      // Sin filtro `.eq('activa', true)`: el historial debe poder resolver
      // categorías desactivadas de gastos ya registrados.
      expect(builder.eq).not.toHaveBeenCalled()
      expect(builder.order).toHaveBeenCalledWith('nombre')
      expect(store.categorias).toEqual([
        { ...categoriasFalsas[0], abreviatura: 'C' },
        { ...categoriasFalsas[1], abreviatura: 'O' },
      ])
      expect(store.cargando).toBe(false)
      expect(store.error).toBeNull()
    })

    it('borde: un array vacío NO es un error (usuario sin categorías todavía)', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.order as Mock).mockResolvedValueOnce({ data: [], error: null })

      const { cargarCategorias } = useCategorias()
      const store = useGastosStore()
      const exito = await cargarCategorias()

      expect(exito).toBe(true)
      expect(store.categorias).toEqual([])
      expect(store.error).toBeNull()
    })

    it('borde: error de Supabase deja un mensaje en español y cargando vuelve a false', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.order as Mock).mockResolvedValueOnce({
        data: null,
        error: { message: 'network error' },
      })

      const { cargarCategorias } = useCategorias()
      const store = useGastosStore()
      const exito = await cargarCategorias()

      expect(exito).toBe(false)
      expect(store.error).toBe('No se pudieron cargar las categorías.')
      expect(store.categorias).toEqual([])
      expect(store.cargando).toBe(false)
    })
  })

  describe('crearCategoria', () => {
    it('camino feliz: inserta con usuario_id explícito, predefinida false y activa true, y recalcula abreviaturas', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      const categoriaCreada = {
        id: 'c2',
        usuario_id: 'u1',
        nombre: 'Mascotas',
        predefinida: false,
        activa: true,
        creado_en: '',
      }
      ;(builder.single as Mock).mockResolvedValueOnce({ data: categoriaCreada, error: null })

      const authStore = useAuthStore()
      authStore.establecerUsuario({ id: 'u1', email: 'a@a.com' } as never)

      const store = useGastosStore()
      store.establecerCategorias([categoriaBase])

      const { crearCategoria } = useCategorias()
      const exito = await crearCategoria('Mascotas')

      expect(exito).toBe(true)
      expect(fromMock).toHaveBeenCalledWith('categorias')
      expect(builder.insert).toHaveBeenCalledWith({
        usuario_id: 'u1',
        nombre: 'Mascotas',
        predefinida: false,
        activa: true,
      })
      expect(store.categorias).toHaveLength(2)
      expect(store.categorias.find((c) => c.id === 'c2')?.abreviatura).toBe('M')
      expect(store.error).toBeNull()
    })

    it('borde: nombre duplicado (violación de unicidad Postgres) muestra el mensaje esperado y no crea la categoría', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.single as Mock).mockResolvedValueOnce({
        data: null,
        error: { code: '23505', message: 'duplicate key value violates unique constraint' },
      })

      const authStore = useAuthStore()
      authStore.establecerUsuario({ id: 'u1', email: 'a@a.com' } as never)

      const store = useGastosStore()
      store.establecerCategorias([categoriaBase])

      const { crearCategoria } = useCategorias()
      const exito = await crearCategoria('Comida')

      expect(exito).toBe(false)
      expect(store.error).toBe('Ya existe una categoría con ese nombre.')
      expect(store.categorias).toEqual([categoriaBase])
    })

    it('borde: sin sesión activa NO llama a Supabase y devuelve un error claro', async () => {
      const authStore = useAuthStore()
      authStore.establecerUsuario(null)

      const { crearCategoria } = useCategorias()
      const store = useGastosStore()
      const exito = await crearCategoria('Mascotas')

      expect(exito).toBe(false)
      expect(store.error).toBe('No hay una sesión activa. Vuelve a iniciar sesión.')
      expect(fromMock).not.toHaveBeenCalled()
      expect(store.categorias).toEqual([])
    })

    it('borde: error genérico de Supabase deja un mensaje en español y no crea la categoría', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.single as Mock).mockResolvedValueOnce({
        data: null,
        error: { code: '500', message: 'network error' },
      })

      const authStore = useAuthStore()
      authStore.establecerUsuario({ id: 'u1', email: 'a@a.com' } as never)

      const { crearCategoria } = useCategorias()
      const store = useGastosStore()
      const exito = await crearCategoria('Mascotas')

      expect(exito).toBe(false)
      expect(store.error).toBe('No se pudo crear la categoría.')
      expect(store.categorias).toEqual([])
    })
  })

  describe('editarCategoria', () => {
    it('camino feliz: actualiza el nombre, reemplaza la categoría en el store y recalcula abreviaturas', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      const categoriaEditada = { ...categoriaBase, nombre: 'Comida y bebida' }
      ;(builder.single as Mock).mockResolvedValueOnce({ data: categoriaEditada, error: null })

      const store = useGastosStore()
      store.establecerCategorias([categoriaBase])

      const { editarCategoria } = useCategorias()
      const exito = await editarCategoria('c1', 'Comida y bebida')

      expect(exito).toBe(true)
      expect(builder.update).toHaveBeenCalledWith({ nombre: 'Comida y bebida' })
      expect(builder.eq).toHaveBeenCalledWith('id', 'c1')
      expect(store.categorias[0].nombre).toBe('Comida y bebida')
      expect(store.categorias[0].abreviatura).toBe('C')
    })

    it('borde: renombrar a un nombre existente devuelve el error de unicidad y no aplica el cambio', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.single as Mock).mockResolvedValueOnce({
        data: null,
        error: { code: '23505', message: 'duplicate key value violates unique constraint' },
      })

      const store = useGastosStore()
      store.establecerCategorias([categoriaBase])

      const { editarCategoria } = useCategorias()
      const exito = await editarCategoria('c1', 'Transporte')

      expect(exito).toBe(false)
      expect(store.error).toBe('Ya existe una categoría con ese nombre.')
      expect(store.categorias).toEqual([categoriaBase])
    })

    it('borde: error genérico de Supabase deja mensaje en español y no toca el store', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.single as Mock).mockResolvedValueOnce({
        data: null,
        error: { message: 'boom' },
      })

      const store = useGastosStore()
      store.establecerCategorias([categoriaBase])

      const { editarCategoria } = useCategorias()
      const exito = await editarCategoria('c1', 'Otro nombre')

      expect(exito).toBe(false)
      expect(store.error).toBe('No se pudo actualizar la categoría.')
      expect(store.categorias).toEqual([categoriaBase])
    })
  })

  describe('desactivarCategoria', () => {
    it('camino feliz: marca activa=false y reemplaza la categoría en el store', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      const categoriaDesactivada = { ...categoriaBase, activa: false }
      ;(builder.single as Mock).mockResolvedValueOnce({ data: categoriaDesactivada, error: null })

      const store = useGastosStore()
      store.establecerCategorias([categoriaBase])

      const { desactivarCategoria } = useCategorias()
      const exito = await desactivarCategoria('c1')

      expect(exito).toBe(true)
      expect(builder.update).toHaveBeenCalledWith({ activa: false })
      expect(builder.eq).toHaveBeenCalledWith('id', 'c1')
      expect(store.categorias[0].activa).toBe(false)
    })

    it('borde: error de Supabase deja la categoría activa y setea el mensaje', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.single as Mock).mockResolvedValueOnce({
        data: null,
        error: { message: 'boom' },
      })

      const store = useGastosStore()
      store.establecerCategorias([categoriaBase])

      const { desactivarCategoria } = useCategorias()
      const exito = await desactivarCategoria('c1')

      expect(exito).toBe(false)
      expect(store.error).toBe('No se pudo desactivar la categoría.')
      expect(store.categorias[0].activa).toBe(true)
    })
  })
})
