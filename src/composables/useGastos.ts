import { useAuthStore } from '@/stores/auth'
import { useGastosStore } from '@/stores/gastos'
import { supabase } from '@/lib/supabaseClient'
import type { Gasto, GastoInput } from '@/types/gasto'

/** Mensaje genérico cuando no hay una sesión activa (no debería ocurrir tras el guard de rutas). */
const MENSAJE_SIN_SESION = 'No hay una sesión activa. Vuelve a iniciar sesión.'

/**
 * Composable que encapsula todas las llamadas a Supabase para gastos.
 * Ninguna vista debe llamar a Supabase directamente: siempre a través de aquí.
 * Cada función actualiza `cargando`/`error` en el store y normaliza los mensajes de error.
 * La carga y gestión de categorías vive en `useCategorias` (dominio propio).
 */
export function useGastos() {
  const store = useGastosStore()
  const authStore = useAuthStore()

  /**
   * Carga los gastos CONFIRMADOS del usuario autenticado, más recientes primero.
   * Filtra explícitamente `estado='confirmado'`: los borradores de correo
   * (`estado in ('borrador','revision_manual')`) viven en `useBandeja` y no
   * deben aparecer en el Historial.
   */
  async function cargarGastos() {
    store.establecerCargando(true)
    store.limpiarError()
    try {
      const { data, error } = await supabase
        .from('gastos')
        .select()
        .eq('estado', 'confirmado')
        .order('fecha', { ascending: false })
      if (error) {
        store.establecerError('No se pudieron cargar los gastos.')
        return false
      }
      store.establecerGastos((data ?? []) as Gasto[])
      return true
    } finally {
      store.establecerCargando(false)
    }
  }

  /** Crea un gasto manual (`origen: 'manual'`, `estado: 'confirmado'`). */
  async function crearGasto(input: GastoInput) {
    store.establecerCargando(true)
    store.limpiarError()
    try {
      const usuarioId = authStore.usuario?.id
      if (!usuarioId) {
        store.establecerError(MENSAJE_SIN_SESION)
        return false
      }
      // La policy RLS `with check (usuario_id = auth.uid())` exige enviar el
      // `usuario_id` explícito en el insert: no se autocompleta en la fila.
      const { data, error } = await supabase
        .from('gastos')
        .insert({ ...input, usuario_id: usuarioId, origen: 'manual', estado: 'confirmado' })
        .select()
        .single()
      if (error) {
        store.establecerError('No se pudo guardar el gasto.')
        return false
      }
      store.agregarGasto(data as Gasto)
      return true
    } finally {
      store.establecerCargando(false)
    }
  }

  /**
   * Edita un gasto existente. El payload es parcial: para gastos `origen='correo'`
   * la vista/formulario solo debe incluir `categoria_id`/`descripcion` (monto y
   * fecha no son editables en ese caso).
   */
  async function editarGasto(id: string, input: Partial<GastoInput>) {
    store.establecerCargando(true)
    store.limpiarError()
    try {
      const { data, error } = await supabase
        .from('gastos')
        .update(input)
        .eq('id', id)
        .select()
        .single()
      if (error) {
        store.establecerError('No se pudo actualizar el gasto.')
        return false
      }
      store.actualizarGasto(data as Gasto)
      return true
    } finally {
      store.establecerCargando(false)
    }
  }

  /** Elimina definitivamente un gasto por su id. */
  async function eliminarGasto(id: string) {
    store.establecerCargando(true)
    store.limpiarError()
    try {
      const { error } = await supabase.from('gastos').delete().eq('id', id)
      if (error) {
        store.establecerError('No se pudo eliminar el gasto.')
        return false
      }
      store.quitarGasto(id)
      return true
    } finally {
      store.establecerCargando(false)
    }
  }

  return {
    cargarGastos,
    crearGasto,
    editarGasto,
    eliminarGasto,
  }
}
