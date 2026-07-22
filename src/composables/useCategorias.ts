import { useAuthStore } from '@/stores/auth'
import { useGastosStore } from '@/stores/gastos'
import { supabase } from '@/lib/supabaseClient'
import type { Categoria } from '@/types/gasto'

/** Mensaje genérico cuando no hay una sesión activa (no debería ocurrir tras el guard de rutas). */
const MENSAJE_SIN_SESION = 'No hay una sesión activa. Vuelve a iniciar sesión.'
/** Código de error de Postgres para violación de restricción `unique`. */
const CODIGO_POSTGRES_UNICIDAD = '23505'

/** Quita acentos de una letra para agrupar categorías por su inicial "normalizada" (ej. "Á" y "A"). */
function normalizarLetra(letra: string): string {
  return letra
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
}

/**
 * Calcula la abreviatura (1 o 2 caracteres) de cada categoría a partir de su
 * nombre, agrupando por primera letra normalizada (sin acentos). Si dos o más
 * categorías comparten la primera letra, todas ellas usan 2 caracteres (las
 * primeras 2 letras del nombre); el resto usa solo 1 (su inicial).
 *
 * Límite conocido: si además de la primera letra comparten la segunda
 * (ej. "Casa" / "Café"), esta función solo garantiza 2 caracteres, no
 * desambiguación total entre ellas.
 */
export function calcularAbreviaturas(categorias: Categoria[]): Categoria[] {
  const conteoPorLetra = new Map<string, number>()
  for (const categoria of categorias) {
    const letra = normalizarLetra(categoria.nombre.charAt(0))
    conteoPorLetra.set(letra, (conteoPorLetra.get(letra) ?? 0) + 1)
  }

  return categorias.map((categoria) => {
    const letra = normalizarLetra(categoria.nombre.charAt(0))
    const hayColision = (conteoPorLetra.get(letra) ?? 0) >= 2
    const cantidadCaracteres = hayColision ? 2 : 1
    const abreviatura = categoria.nombre.slice(0, cantidadCaracteres).toUpperCase()
    return { ...categoria, abreviatura }
  })
}

/**
 * Composable que encapsula todas las llamadas a Supabase para el dominio de
 * categorías (CRUD completo). Ninguna vista debe llamar a Supabase
 * directamente: siempre a través de aquí. Cada función actualiza
 * `cargando`/`error` en el store y normaliza los mensajes de error.
 */
export function useCategorias() {
  const store = useGastosStore()
  const authStore = useAuthStore()

  /**
   * Carga TODAS las categorías del usuario autenticado (activas e inactivas).
   * No filtra por `activa`: tras un soft-delete, el historial sigue
   * necesitando resolver nombre/color de gastos ya registrados con una
   * categoría desactivada, incluso después de recargar la página. Los
   * selectores de ALTA de gasto son responsables de filtrar a `activa`.
   * Un array vacío NO es un error: significa que el usuario todavía no tiene
   * categorías.
   */
  async function cargarCategorias() {
    store.establecerCargando(true)
    store.limpiarError()
    try {
      const { data, error } = await supabase.from('categorias').select().order('nombre')
      if (error) {
        store.establecerError('No se pudieron cargar las categorías.')
        return false
      }
      store.establecerCategorias(calcularAbreviaturas((data ?? []) as Categoria[]))
      return true
    } finally {
      store.establecerCargando(false)
    }
  }

  /**
   * Crea una categoría personalizada (`predefinida: false`, `activa: true`).
   * Mapea la violación de unicidad Postgres (`usuario_id`, `nombre`) a un
   * mensaje claro en español.
   */
  async function crearCategoria(nombre: string) {
    store.establecerCargando(true)
    store.limpiarError()
    try {
      const usuarioId = authStore.usuario?.id
      if (!usuarioId) {
        store.establecerError(MENSAJE_SIN_SESION)
        return false
      }
      const { data, error } = await supabase
        .from('categorias')
        .insert({ usuario_id: usuarioId, nombre, predefinida: false, activa: true })
        .select()
        .single()
      if (error) {
        store.establecerError(
          error.code === CODIGO_POSTGRES_UNICIDAD
            ? 'Ya existe una categoría con ese nombre.'
            : 'No se pudo crear la categoría.',
        )
        return false
      }
      store.agregarCategoria(data as Categoria)
      // Al añadir una categoría, las colisiones de inicial pueden cambiar:
      // se recalculan las abreviaturas de toda la lista.
      store.establecerCategorias(calcularAbreviaturas(store.categorias))
      return true
    } finally {
      store.establecerCargando(false)
    }
  }

  /**
   * Edita el nombre de una categoría (solo personalizadas: la vista es
   * responsable de no permitir editar el nombre de una predefinida).
   */
  async function editarCategoria(id: string, nombre: string) {
    store.establecerCargando(true)
    store.limpiarError()
    try {
      const { data, error } = await supabase
        .from('categorias')
        .update({ nombre })
        .eq('id', id)
        .select()
        .single()
      if (error) {
        store.establecerError(
          error.code === CODIGO_POSTGRES_UNICIDAD
            ? 'Ya existe una categoría con ese nombre.'
            : 'No se pudo actualizar la categoría.',
        )
        return false
      }
      store.actualizarCategoria(data as Categoria)
      // El nuevo nombre puede introducir o resolver colisiones de inicial.
      store.establecerCategorias(calcularAbreviaturas(store.categorias))
      return true
    } finally {
      store.establecerCargando(false)
    }
  }

  /** Desactiva (soft-delete) una categoría: deja de ofrecerse en el alta de gastos. */
  async function desactivarCategoria(id: string) {
    store.establecerCargando(true)
    store.limpiarError()
    try {
      const { data, error } = await supabase
        .from('categorias')
        .update({ activa: false })
        .eq('id', id)
        .select()
        .single()
      if (error) {
        store.establecerError('No se pudo desactivar la categoría.')
        return false
      }
      store.actualizarCategoria(data as Categoria)
      return true
    } finally {
      store.establecerCargando(false)
    }
  }

  return {
    cargarCategorias,
    crearCategoria,
    editarCategoria,
    desactivarCategoria,
  }
}
