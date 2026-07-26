import { useAuthStore } from '@/stores/auth'
import { useIngresosStore } from '@/stores/ingresos'
import { supabase } from '@/lib/supabaseClient'
import type { Ingreso, IngresoInput } from '@/types/ingreso'

/** Mensaje genérico cuando no hay una sesión activa (no debería ocurrir tras el guard de rutas). */
const MENSAJE_SIN_SESION = 'No hay una sesión activa. Vuelve a iniciar sesión.'

/**
 * Composable que encapsula las llamadas a Supabase para ingresos (Épica 11).
 * Ninguna vista debe llamar a Supabase directamente: siempre a través de aquí.
 * Cubre alta, listado, edición y eliminación (HU 11.1–11.4).
 */
export function useIngresos() {
  const store = useIngresosStore()
  const authStore = useAuthStore()

  /** Carga los ingresos del usuario autenticado, más recientes primero. */
  async function cargarIngresos() {
    store.establecerCargando(true)
    store.limpiarError()
    try {
      const { data, error } = await supabase
        .from('ingresos')
        .select()
        .order('created_at', { ascending: false })
      if (error) {
        store.establecerError('No se pudieron cargar los ingresos.')
        return false
      }
      store.establecerIngresos((data ?? []) as Ingreso[])
      return true
    } finally {
      store.establecerCargando(false)
    }
  }

  /** Crea un ingreso manual. */
  async function crearIngreso(input: IngresoInput) {
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
        .from('ingresos')
        .insert({ ...input, usuario_id: usuarioId })
        .select()
        .single()
      if (error) {
        store.establecerError('No se pudo guardar el ingreso.')
        return false
      }
      store.agregarIngreso(data as Ingreso)
      return true
    } finally {
      store.establecerCargando(false)
    }
  }

  /** Edita un ingreso existente. Todos los campos de `IngresoInput` son siempre editables. */
  async function editarIngreso(id: string, input: Partial<IngresoInput>) {
    store.establecerCargando(true)
    store.limpiarError()
    try {
      const { data, error } = await supabase
        .from('ingresos')
        .update(input)
        .eq('id', id)
        .select()
        .single()
      if (error) {
        store.establecerError('No se pudo actualizar el ingreso.')
        return false
      }
      store.actualizarIngreso(data as Ingreso)
      return true
    } finally {
      store.establecerCargando(false)
    }
  }

  /** Elimina definitivamente un ingreso por su id. */
  async function eliminarIngreso(id: string) {
    store.establecerCargando(true)
    store.limpiarError()
    try {
      const { error } = await supabase.from('ingresos').delete().eq('id', id)
      if (error) {
        store.establecerError('No se pudo eliminar el ingreso.')
        return false
      }
      store.quitarIngreso(id)
      return true
    } finally {
      store.establecerCargando(false)
    }
  }

  return {
    cargarIngresos,
    crearIngreso,
    editarIngreso,
    eliminarIngreso,
  }
}
