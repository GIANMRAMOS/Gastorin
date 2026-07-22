import { useAuthStore } from '@/stores/auth'
import { useGastosStore } from '@/stores/gastos'
import { supabase } from '@/lib/supabaseClient'
import type { Gasto, Presupuesto, PresupuestoInput } from '@/types/gasto'

/** Mensaje genérico cuando no hay una sesión activa (no debería ocurrir tras el guard de rutas). */
const MENSAJE_SIN_SESION = 'No hay una sesión activa. Vuelve a iniciar sesión.'
/** Código de error de Postgres para violación de restricción `unique`. */
const CODIGO_POSTGRES_UNICIDAD = '23505'

/** Devuelve el primer día del mes actual en formato `YYYY-MM-01` (convención de la columna `mes`). */
function primerDiaMesActual(): string {
  const ahora = new Date()
  const anio = ahora.getFullYear()
  const mes = String(ahora.getMonth() + 1).padStart(2, '0')
  return `${anio}-${mes}-01`
}

/**
 * Suma, de forma pura, los gastos ya confirmados (`storeGastos.gastos` solo
 * contiene `estado='confirmado'`, ver `useGastos.cargarGastos`) que
 * corresponden a un presupuesto: misma categoría, misma moneda y mismo mes
 * (comparando el prefijo `YYYY-MM` de `fecha` contra el de `presupuesto.mes`).
 * No consulta Supabase: reutiliza datos ya cargados en el store.
 */
export function calcularGastado(gastos: Gasto[], presupuesto: Presupuesto): number {
  const mesPresupuesto = presupuesto.mes.slice(0, 7)
  return gastos
    .filter(
      (gasto) =>
        gasto.categoria_id === presupuesto.categoria_id &&
        gasto.moneda === presupuesto.moneda &&
        gasto.fecha.slice(0, 7) === mesPresupuesto,
    )
    .reduce((total, gasto) => total + (gasto.monto ?? 0), 0)
}

/**
 * Composable que encapsula todas las llamadas a Supabase para el dominio de
 * presupuestos (Épica 6). Sigue el precedente de `useCategorias`/`useBandeja`:
 * sub-dominio propio que reutiliza el mismo `useGastosStore`.
 */
export function usePresupuestos() {
  const store = useGastosStore()
  const authStore = useAuthStore()

  /**
   * Carga los presupuestos del mes actual del usuario autenticado. Un array
   * vacío NO es un error: significa que el usuario todavía no tiene
   * presupuestos definidos para este mes.
   */
  async function cargarPresupuestos() {
    store.establecerCargando(true)
    store.limpiarError()
    try {
      const { data, error } = await supabase
        .from('presupuestos')
        .select()
        .eq('mes', primerDiaMesActual())
      if (error) {
        store.establecerError('No se pudieron cargar los presupuestos.')
        return false
      }
      store.establecerPresupuestos((data ?? []) as Presupuesto[])
      return true
    } finally {
      store.establecerCargando(false)
    }
  }

  /**
   * Crea un presupuesto para el mes actual. Mapea la violación de unicidad
   * Postgres (`usuario_id`, `categoria_id`, `mes`, `moneda`) a un mensaje
   * claro en español.
   */
  async function crearPresupuesto(input: PresupuestoInput) {
    store.establecerCargando(true)
    store.limpiarError()
    try {
      const usuarioId = authStore.usuario?.id
      if (!usuarioId) {
        store.establecerError(MENSAJE_SIN_SESION)
        return false
      }
      const { data, error } = await supabase
        .from('presupuestos')
        .insert({
          usuario_id: usuarioId,
          categoria_id: input.categoria_id,
          moneda: input.moneda,
          monto_limite: input.monto_limite,
          mes: primerDiaMesActual(),
        })
        .select()
        .single()
      if (error) {
        store.establecerError(
          error.code === CODIGO_POSTGRES_UNICIDAD
            ? 'Ya existe un presupuesto para esa categoría, mes y moneda.'
            : 'No se pudo crear el presupuesto.',
        )
        return false
      }
      store.agregarPresupuesto(data as Presupuesto)
      return true
    } finally {
      store.establecerCargando(false)
    }
  }

  /** Edita el monto límite de un presupuesto (único campo editable: categoría/moneda/mes son la clave UNIQUE). */
  async function editarPresupuesto(id: string, montoLimite: number) {
    store.establecerCargando(true)
    store.limpiarError()
    try {
      const { data, error } = await supabase
        .from('presupuestos')
        .update({ monto_limite: montoLimite })
        .eq('id', id)
        .select()
        .single()
      if (error) {
        store.establecerError('No se pudo actualizar el presupuesto.')
        return false
      }
      store.actualizarPresupuesto(data as Presupuesto)
      return true
    } finally {
      store.establecerCargando(false)
    }
  }

  /** Elimina un presupuesto por su id. */
  async function eliminarPresupuesto(id: string) {
    store.establecerCargando(true)
    store.limpiarError()
    try {
      const { error } = await supabase.from('presupuestos').delete().eq('id', id)
      if (error) {
        store.establecerError('No se pudo eliminar el presupuesto.')
        return false
      }
      store.quitarPresupuesto(id)
      return true
    } finally {
      store.establecerCargando(false)
    }
  }

  return {
    cargarPresupuestos,
    crearPresupuesto,
    editarPresupuesto,
    eliminarPresupuesto,
  }
}
