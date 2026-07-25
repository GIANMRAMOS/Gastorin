import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useGastosStore } from '@/stores/gastos'
import { supabase } from '@/lib/supabaseClient'
import type { Gasto, Moneda, Presupuesto, PresupuestoInput } from '@/types/gasto'

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
 * Primer día (`YYYY-MM-01`) del mes anterior al actual, para la Épica 17
 * ("Copiar de [mes anterior]"). Aritmética local a este composable,
 * DUPLICADA a propósito de `useDashboard.primerDiaDeMesRelativo` (ver
 * micro-plan Fase 4 "Caudal", sección "Sugerencias fuera de alcance": ambos
 * composables declaran explícitamente no compartir este helper).
 */
function primerDiaMesAnterior(): string {
  const ahora = new Date()
  const fecha = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1)
  const anio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  return `${anio}-${mes}-01`
}

/** Clave `categoria_id+moneda` para comparar presupuestos entre meses sin depender del `id` (que cambia mes a mes). */
function claveCategoriaMoneda(presupuesto: Presupuesto): string {
  return `${presupuesto.categoria_id}-${presupuesto.moneda}`
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
 * Número de semana del mes (1-4) al que pertenece un día (1-31), para el
 * desglose semanal de la Épica 16. Cada semana calendario cubre 7 días
 * (1-7 → semana 1, 8-14 → semana 2, ...); los días 29-31 (semana 5 parcial)
 * se pliegan dentro de la semana 4 (`Math.min(4, ...)`) en vez de crear una
 * quinta celda casi vacía.
 */
export function numeroSemanaDelMes(dia: number): number {
  return Math.min(4, Math.ceil(dia / 7))
}

/** Total gastado en una semana calendario (1-4) del desglose de una categoría. */
export interface DesgloseSemanal {
  semana: number
  total: number
}

/**
 * Desglosa, de forma pura, el gasto de una categoría/moneda/mes en sus 4
 * semanas calendario (Épica 16). Mismo molde que `calcularGastado`: filtra
 * por categoría, moneda y prefijo `YYYY-MM` de `fecha`, sin mezclar monedas
 * ni meses. Las 4 semanas SIEMPRE aparecen en el resultado, aunque su total
 * sea 0 (no se omiten: la celda debe mostrar 0, no un hueco).
 */
export function calcularDesgloseSemanal(
  gastos: Gasto[],
  categoriaId: string,
  moneda: Moneda,
  mesPrefijo: string,
): DesgloseSemanal[] {
  const totalesPorSemana = new Map<number, number>([
    [1, 0],
    [2, 0],
    [3, 0],
    [4, 0],
  ])

  for (const gasto of gastos) {
    if (gasto.categoria_id !== categoriaId) continue
    if (gasto.moneda !== moneda) continue
    if (gasto.fecha.slice(0, 7) !== mesPrefijo) continue

    const dia = Number(gasto.fecha.slice(8, 10))
    const semana = numeroSemanaDelMes(dia)
    totalesPorSemana.set(semana, (totalesPorSemana.get(semana) ?? 0) + (gasto.monto ?? 0))
  }

  return [1, 2, 3, 4].map((semana) => ({ semana, total: totalesPorSemana.get(semana) ?? 0 }))
}

/**
 * Devuelve los `categoria_id` de los presupuestos de `moneda` cuyo gastado
 * (`calcularGastado`) supera su `monto_limite` (Épica 15, stat "Categorías
 * excedidas"). Pura: la vista resuelve los nombres contra `store.categorias`
 * (mismo patrón que `cargarGastoPorCategoria` en `useDashboard.ts`).
 */
export function contarCategoriasExcedidas(
  presupuestos: Presupuesto[],
  gastos: Gasto[],
  moneda: Moneda,
): string[] {
  return presupuestos
    .filter((presupuesto) => presupuesto.moneda === moneda)
    .filter((presupuesto) => calcularGastado(gastos, presupuesto) > presupuesto.monto_limite)
    .map((presupuesto) => presupuesto.categoria_id)
}

/**
 * Cuenta, de forma pura, los días del mes (1..`diaActual`) sin NINGÚN gasto
 * confirmado de `moneda` (Épica 15, stat "Días sin gasto"). `diaActual` se
 * acota a los días reales del mes (`mesPrefijo`) por seguridad, aunque en la
 * práctica siempre sea "hoy".
 */
export function contarDiasSinGasto(
  gastos: Gasto[],
  moneda: Moneda,
  mesPrefijo: string,
  diaActual: number,
): { sinGasto: number; transcurridos: number } {
  const anio = Number(mesPrefijo.slice(0, 4))
  const mes = Number(mesPrefijo.slice(5, 7))
  const diasDelMes = new Date(anio, mes, 0).getDate()
  const transcurridos = Math.max(0, Math.min(diaActual, diasDelMes))

  const diasConGasto = new Set<number>()
  for (const gasto of gastos) {
    if (gasto.moneda !== moneda) continue
    if (gasto.fecha.slice(0, 7) !== mesPrefijo) continue
    diasConGasto.add(Number(gasto.fecha.slice(8, 10)))
  }

  let sinGasto = 0
  for (let dia = 1; dia <= transcurridos; dia++) {
    if (!diasConGasto.has(dia)) sinGasto++
  }

  return { sinGasto, transcurridos }
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
   * Presupuestos del mes ANTERIOR, cargados solo para habilitar/deshabilitar
   * el botón "Copiar de [mes anterior]" (Épica 17) y para clonarlos. `ref`
   * local y transitorio: NO se guarda en `useGastosStore.presupuestos` (esa
   * lista es siempre "mes actual", ver `cargarPresupuestos`).
   */
  const presupuestosMesAnterior = ref<Presupuesto[]>([])

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

  /**
   * Carga de solo-lectura de los presupuestos del mes ANTERIOR (Épica 17):
   * no toca `store.presupuestos` (que es siempre "mes actual"), solo llena
   * `presupuestosMesAnterior` para decidir si el botón "Copiar de [mes
   * anterior]" va habilitado y para poder clonarlos. Un array vacío NO es un
   * error: significa que el mes anterior tampoco tenía presupuestos.
   */
  async function cargarPresupuestosMesAnterior() {
    store.establecerCargando(true)
    store.limpiarError()
    try {
      const { data, error } = await supabase
        .from('presupuestos')
        .select()
        .eq('mes', primerDiaMesAnterior())
      if (error) {
        store.establecerError('No se pudieron cargar los presupuestos del mes anterior.')
        return false
      }
      presupuestosMesAnterior.value = (data ?? []) as Presupuesto[]
      return true
    } finally {
      store.establecerCargando(false)
    }
  }

  /**
   * Copia al mes actual los presupuestos del mes anterior (Épica 17) cuya
   * combinación categoría+moneda el mes actual TODAVÍA no tenga: nunca
   * sobrescribe uno existente, solo agrega los faltantes. Necesita que
   * `cargarPresupuestosMesAnterior()` se haya llamado antes (mismo `ref`
   * transitorio que deshabilita el botón en la vista); si no hay nada que
   * copiar, no hace ninguna llamada a Supabase.
   */
  async function copiarPresupuestosMesAnterior() {
    store.establecerCargando(true)
    store.limpiarError()
    try {
      const usuarioId = authStore.usuario?.id
      if (!usuarioId) {
        store.establecerError(MENSAJE_SIN_SESION)
        return false
      }

      const clavesMesActual = new Set(store.presupuestos.map(claveCategoriaMoneda))
      const faltantes = presupuestosMesAnterior.value.filter(
        (presupuesto) => !clavesMesActual.has(claveCategoriaMoneda(presupuesto)),
      )
      if (faltantes.length === 0) {
        return true
      }

      const { data, error } = await supabase
        .from('presupuestos')
        .insert(
          faltantes.map((presupuesto) => ({
            usuario_id: usuarioId,
            categoria_id: presupuesto.categoria_id,
            moneda: presupuesto.moneda,
            monto_limite: presupuesto.monto_limite,
            mes: primerDiaMesActual(),
          })),
        )
        .select()
      if (error) {
        store.establecerError(
          error.code === CODIGO_POSTGRES_UNICIDAD
            ? 'Alguna de esas categorías ya tiene presupuesto este mes.'
            : 'No se pudieron copiar los presupuestos del mes anterior.',
        )
        return false
      }
      for (const nuevo of (data ?? []) as Presupuesto[]) {
        store.agregarPresupuesto(nuevo)
      }
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
    presupuestosMesAnterior,
    cargarPresupuestosMesAnterior,
    copiarPresupuestosMesAnterior,
  }
}
