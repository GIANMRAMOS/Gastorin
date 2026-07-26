import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useGastosStore } from '@/stores/gastos'
import { supabase } from '@/lib/supabaseClient'
import type { AjusteSaldoCuenta, AjusteSaldoCuentaInput } from '@/types/ajusteSaldo'

/** Mensaje genérico cuando no hay una sesión activa (no debería ocurrir tras el guard de rutas). */
const MENSAJE_SIN_SESION = 'No hay una sesión activa. Vuelve a iniciar sesión.'

/**
 * Composable de dominio de "setear saldo de cuenta" (tarjeta "Saldo por
 * cuenta" del Dashboard, migración 011): mismo precedente que
 * `useMetasAhorro`/`useDashboard` — mantiene el historial en un `ref` local
 * propio (no en `useGastosStore`, es un dominio distinto), y solo reutiliza
 * el store compartido para `cargando`/`error`. `calcularSaldoNetoPorCuenta`
 * (en `useDashboard.ts`) es quien resuelve cuál es "el último ajuste" de
 * cada cuenta a partir de la lista completa que carga este composable.
 */
export function useAjustesSaldo() {
  const store = useGastosStore()
  const authStore = useAuthStore()

  /** Historial completo de ajustes del usuario (todas las cuentas, todas las fechas). */
  const ajustes = ref<AjusteSaldoCuenta[]>([])

  /** Carga todo el historial de ajustes del usuario autenticado. Un historial vacío NO es un error: nadie ha seteado ningún saldo todavía. */
  async function cargarAjustesSaldo() {
    store.establecerCargando(true)
    store.limpiarError()
    try {
      const { data, error } = await supabase.from('ajustes_saldo_cuenta').select()
      if (error) {
        store.establecerError('No se pudieron cargar los ajustes de saldo.')
        return false
      }
      ajustes.value = (data ?? []) as AjusteSaldoCuenta[]
      return true
    } finally {
      store.establecerCargando(false)
    }
  }

  /**
   * Registra un nuevo ajuste (siempre un INSERT, nunca un upsert: se
   * conserva el historial completo, ver comentario de la migración 011).
   */
  async function guardarAjusteSaldo(input: AjusteSaldoCuentaInput) {
    store.establecerCargando(true)
    store.limpiarError()
    try {
      const usuarioId = authStore.usuario?.id
      if (!usuarioId) {
        store.establecerError(MENSAJE_SIN_SESION)
        return false
      }
      const { data, error } = await supabase
        .from('ajustes_saldo_cuenta')
        .insert({ usuario_id: usuarioId, ...input })
        .select()
        .single()
      if (error) {
        store.establecerError('No se pudo guardar el ajuste de saldo.')
        return false
      }
      ajustes.value.push(data as AjusteSaldoCuenta)
      return true
    } finally {
      store.establecerCargando(false)
    }
  }

  return {
    ajustes,
    cargarAjustesSaldo,
    guardarAjusteSaldo,
  }
}
