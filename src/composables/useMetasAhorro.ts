import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useGastosStore } from '@/stores/gastos'
import { supabase } from '@/lib/supabaseClient'
import type { MetaAhorro, MetaAhorroInput } from '@/types/metaAhorro'

/** Mensaje genérico cuando no hay una sesión activa (no debería ocurrir tras el guard de rutas). */
const MENSAJE_SIN_SESION = 'No hay una sesión activa. Vuelve a iniciar sesión.'

/**
 * Composable de dominio de la meta de ahorro (Épica 13, HU-13.1): una sola
 * fila por usuario en `metas_ahorro` (PK `usuario_id`, migración 009). Mismo
 * precedente que `useDashboard`: mantiene el dato en un `ref` local propio
 * (NO se añade a `useGastosStore`, es un dominio distinto) y solo reutiliza
 * el store compartido para `cargando`/`error`.
 */
export function useMetasAhorro() {
  const store = useGastosStore()
  const authStore = useAuthStore()

  /** Meta de ahorro del usuario, o `null` si todavía no la configuró (estado vacío del CTA, no un error). */
  const meta = ref<MetaAhorro | null>(null)

  /**
   * Carga la meta de ahorro del usuario autenticado. Al ser una fila única
   * (PK `usuario_id`, RLS ya la acota al propio usuario), `maybeSingle()` es
   * la forma correcta: su ausencia (`null`) NO es un error.
   */
  async function cargarMeta() {
    store.establecerCargando(true)
    store.limpiarError()
    try {
      const { data, error } = await supabase.from('metas_ahorro').select().maybeSingle()
      if (error) {
        store.establecerError('No se pudo cargar la meta de ahorro.')
        return false
      }
      meta.value = (data ?? null) as MetaAhorro | null
      return true
    } finally {
      store.establecerCargando(false)
    }
  }

  /**
   * Crea o actualiza la meta de ahorro del usuario (upsert por `usuario_id`,
   * la PK de la tabla: nunca puede haber más de una fila por usuario). Se usa
   * tanto para el alta desde el CTA "Configura tu meta de ahorro" como para
   * editar la meta ya configurada.
   */
  async function guardarMeta(input: MetaAhorroInput) {
    store.establecerCargando(true)
    store.limpiarError()
    try {
      const usuarioId = authStore.usuario?.id
      if (!usuarioId) {
        store.establecerError(MENSAJE_SIN_SESION)
        return false
      }
      const { data, error } = await supabase
        .from('metas_ahorro')
        .upsert(
          { usuario_id: usuarioId, descripcion: input.descripcion, monto: input.monto },
          { onConflict: 'usuario_id' },
        )
        .select()
        .single()
      if (error) {
        store.establecerError('No se pudo guardar la meta de ahorro.')
        return false
      }
      meta.value = data as MetaAhorro
      return true
    } finally {
      store.establecerCargando(false)
    }
  }

  return {
    meta,
    cargarMeta,
    guardarMeta,
  }
}
