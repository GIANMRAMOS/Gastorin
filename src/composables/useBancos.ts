import { useAuthStore } from '@/stores/auth'
import { useIngresosStore } from '@/stores/ingresos'
import { supabase } from '@/lib/supabaseClient'
import type { Banco } from '@/types/ingreso'

/** Mensaje genérico cuando no hay una sesión activa (no debería ocurrir tras el guard de rutas). */
const MENSAJE_SIN_SESION = 'No hay una sesión activa. Vuelve a iniciar sesión.'
/** Código de error de Postgres para violación de restricción `unique`. */
const CODIGO_POSTGRES_UNICIDAD = '23505'

/**
 * Composable que encapsula las llamadas a Supabase para el catálogo de
 * bancos (Épica 11, HU-11.1). Catálogo compartido: además de en Ingresos, lo
 * consume el dominio de Gastos (`FormularioGasto`/`FiltrosHistorial`/
 * `HistorialView`) por decisión de Architect, sin moverlo de aquí.
 */
export function useBancos() {
  const store = useIngresosStore()
  const authStore = useAuthStore()

  /**
   * Carga todos los bancos del usuario autenticado, ordenados por nombre.
   * Un array vacío NO es un error: significa que el usuario todavía no tiene bancos.
   */
  async function cargarBancos() {
    store.establecerCargando(true)
    store.limpiarError()
    try {
      const { data, error } = await supabase.from('bancos').select().order('nombre')
      if (error) {
        store.establecerError('No se pudieron cargar los bancos.')
        return false
      }
      store.establecerBancos((data ?? []) as Banco[])
      return true
    } finally {
      store.establecerCargando(false)
    }
  }

  /**
   * Crea un banco del usuario. Mapea la violación de unicidad Postgres
   * (`usuario_id`, `nombre`) a un mensaje claro en español.
   */
  async function crearBanco(nombre: string) {
    store.establecerCargando(true)
    store.limpiarError()
    try {
      const usuarioId = authStore.usuario?.id
      if (!usuarioId) {
        store.establecerError(MENSAJE_SIN_SESION)
        return false
      }
      const { data, error } = await supabase
        .from('bancos')
        .insert({ usuario_id: usuarioId, nombre })
        .select()
        .single()
      if (error) {
        store.establecerError(
          error.code === CODIGO_POSTGRES_UNICIDAD
            ? 'Ya existe un banco con ese nombre.'
            : 'No se pudo crear el banco.',
        )
        return false
      }
      store.agregarBanco(data as Banco)
      return true
    } finally {
      store.establecerCargando(false)
    }
  }

  return {
    cargarBancos,
    crearBanco,
  }
}
