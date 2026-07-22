import { useGastosStore } from '@/stores/gastos'
import { supabase } from '@/lib/supabaseClient'
import type { BorradorInput, Gasto } from '@/types/gasto'

/**
 * Composable que encapsula todas las llamadas a Supabase para el dominio de
 * la bandeja de borradores (Épica 5). Sigue el precedente de `useCategorias`:
 * sub-dominio propio que reutiliza el mismo `useGastosStore`, sin mezclar su
 * lógica con `useGastos` (que solo trabaja con gastos `estado='confirmado'`).
 */
export function useBandeja() {
  const store = useGastosStore()

  /**
   * Carga los borradores pendientes de revisión del usuario autenticado
   * (`origen='correo'`, `estado in ('borrador','revision_manual')`), más
   * recientes primero. Un array vacío NO es un error: significa que la
   * bandeja está al día.
   */
  async function cargarBorradores() {
    store.establecerCargando(true)
    store.limpiarError()
    try {
      const { data, error } = await supabase
        .from('gastos')
        .select()
        .in('estado', ['borrador', 'revision_manual'])
        .order('fecha', { ascending: false })
      if (error) {
        store.establecerError('No se pudieron cargar los gastos por confirmar.')
        return false
      }
      store.establecerBorradores((data ?? []) as Gasto[])
      return true
    } finally {
      store.establecerCargando(false)
    }
  }

  /**
   * Confirma un borrador: lo pasa a `estado='confirmado'` con un UPDATE sobre
   * la misma fila (nunca un INSERT nuevo, para preservar la idempotencia de
   * HU-5.3). Si el borrador está `estado='revision_manual'`, exige que, entre
   * sus datos actuales y `datosCompletar`, `monto` y `moneda` queden
   * completos: si no, no llama a Supabase y devuelve un error claro (el check
   * `gastos_datos_completos_si_no_revision` de la base de datos es la
   * garantía final, pero se valida antes para dar feedback inmediato en la UI).
   */
  async function confirmarBorrador(id: string, datosCompletar?: BorradorInput) {
    store.establecerCargando(true)
    store.limpiarError()
    try {
      const borrador = store.borradores.find((b) => b.id === id)
      if (!borrador) {
        store.establecerError('El gasto ya no está en la bandeja.')
        return false
      }

      const montoFinal = datosCompletar?.monto ?? borrador.monto
      const monedaFinal = datosCompletar?.moneda ?? borrador.moneda
      if (borrador.estado === 'revision_manual' && (montoFinal == null || monedaFinal == null)) {
        store.establecerError('Completa el monto y la moneda antes de confirmar.')
        return false
      }

      const { data, error } = await supabase
        .from('gastos')
        .update({ ...datosCompletar, estado: 'confirmado' })
        .eq('id', id)
        .select()
        .single()
      if (error) {
        store.establecerError('No se pudo confirmar el gasto.')
        return false
      }
      store.quitarBorrador(id)
      // El gasto ya confirmado debería reflejarse en el Historial si está cargado.
      store.agregarGasto(data as Gasto)
      return true
    } finally {
      store.establecerCargando(false)
    }
  }

  /**
   * Descarta un borrador (soft-delete): lo pasa a `estado='descartado'`. La
   * fila se conserva como lápida para que el índice único parcial
   * `(usuario_id, gmail_message_id)` siga capturando reimportes del mismo
   * correo y el gasto no reaparezca en la bandeja.
   */
  async function descartarBorrador(id: string) {
    store.establecerCargando(true)
    store.limpiarError()
    try {
      const { error } = await supabase.from('gastos').update({ estado: 'descartado' }).eq('id', id)
      if (error) {
        store.establecerError('No se pudo descartar el gasto.')
        return false
      }
      store.quitarBorrador(id)
      return true
    } finally {
      store.establecerCargando(false)
    }
  }

  /**
   * Edita la categoría de un borrador antes de confirmarlo (chip tocable de
   * la tarjeta). No cambia el estado: el borrador sigue en la bandeja.
   */
  async function editarCategoriaBorrador(id: string, categoriaId: string) {
    store.establecerCargando(true)
    store.limpiarError()
    try {
      const { data, error } = await supabase
        .from('gastos')
        .update({ categoria_id: categoriaId })
        .eq('id', id)
        .select()
        .single()
      if (error) {
        store.establecerError('No se pudo actualizar la categoría del gasto.')
        return false
      }
      store.actualizarBorrador(data as Gasto)
      return true
    } finally {
      store.establecerCargando(false)
    }
  }

  return {
    cargarBorradores,
    confirmarBorrador,
    descartarBorrador,
    editarCategoriaBorrador,
  }
}
