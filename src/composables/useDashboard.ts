import { ref } from 'vue'
import { useGastosStore } from '@/stores/gastos'
import { supabase } from '@/lib/supabaseClient'
import type { Gasto, Moneda } from '@/types/gasto'

/** Cantidad de meses (incluido el actual) que cubre la ventana de la tendencia mensual. */
const MESES_VENTANA_TENDENCIA = 6

/**
 * Devuelve el primer día (`YYYY-MM-01`) del mes actual menos `mesesAtras`
 * meses (0 = mes actual). Aritmética local a este composable: el Dashboard
 * necesita una ventana de varios meses, distinto del uso puntual de
 * `primerDiaMesActual()` en `usePresupuestos.ts` (ver "Sugerencias fuera de
 * alcance" del micro-plan: no se extrae un helper compartido en este build).
 */
function primerDiaDeMesRelativo(mesesAtras: number): string {
  const ahora = new Date()
  const fecha = new Date(ahora.getFullYear(), ahora.getMonth() - mesesAtras, 1)
  const anio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  return `${anio}-${mes}-01`
}

/** Devuelve el prefijo `YYYY-MM` del mes actual menos `mesesAtras` meses (0 = mes actual). */
function prefijoMesRelativo(mesesAtras: number): string {
  return primerDiaDeMesRelativo(mesesAtras).slice(0, 7)
}

/**
 * Suma, de forma pura, el total gastado por moneda en `mes` (prefijo
 * `YYYY-MM`) y calcula la variación porcentual contra el mes anterior.
 * Si el mes anterior no tiene gasto (0 o inexistente) no hay base para
 * calcular una variación con sentido: `variacionPct` queda en `null` (sin flecha).
 */
export function cargarResumenPorMoneda(
  gastos: Gasto[],
  mes: string,
): Record<Moneda, { total: number; variacionPct: number | null }> {
  const mesActual = mes.slice(0, 7)
  const fechaMesAnterior = new Date(Number(mesActual.slice(0, 4)), Number(mesActual.slice(5, 7)) - 2, 1)
  const mesAnterior = `${fechaMesAnterior.getFullYear()}-${String(fechaMesAnterior.getMonth() + 1).padStart(2, '0')}`

  const resumen = {} as Record<Moneda, { total: number; variacionPct: number | null }>
  const monedas: Moneda[] = ['PEN', 'USD']

  for (const moneda of monedas) {
    const totalActual = gastos
      .filter((g) => g.moneda === moneda && g.fecha.slice(0, 7) === mesActual)
      .reduce((total, g) => total + (g.monto ?? 0), 0)
    const totalAnterior = gastos
      .filter((g) => g.moneda === moneda && g.fecha.slice(0, 7) === mesAnterior)
      .reduce((total, g) => total + (g.monto ?? 0), 0)

    const variacionPct = totalAnterior > 0 ? ((totalActual - totalAnterior) / totalAnterior) * 100 : null

    resumen[moneda] = { total: totalActual, variacionPct }
  }

  return resumen
}

/**
 * Agrupa el gasto de `mes` en la `moneda` dada por categoría, ordenado de
 * mayor a menor total. Pura: no consulta Supabase ni resuelve nombres (eso
 * lo hace la vista contra `store.categorias`).
 */
export function cargarGastoPorCategoria(
  gastos: Gasto[],
  mes: string,
  moneda: Moneda,
): Array<{ categoria_id: string; total: number }> {
  const mesActual = mes.slice(0, 7)
  const totalesPorCategoria = new Map<string, number>()

  for (const gasto of gastos) {
    if (gasto.moneda !== moneda || gasto.fecha.slice(0, 7) !== mesActual) continue
    const totalPrevio = totalesPorCategoria.get(gasto.categoria_id) ?? 0
    totalesPorCategoria.set(gasto.categoria_id, totalPrevio + (gasto.monto ?? 0))
  }

  return Array.from(totalesPorCategoria.entries())
    .map(([categoria_id, total]) => ({ categoria_id, total }))
    .sort((a, b) => b.total - a.total)
}

/**
 * Devuelve el total gastado en `moneda` de los últimos `meses` (incluyendo el
 * actual), en orden cronológico ascendente. Los meses sin gasto aparecen con
 * `total: 0` (no se descartan, para que el gráfico no tenga huecos).
 */
export function cargarTendenciaMensual(
  gastos: Gasto[],
  moneda: Moneda,
  meses = MESES_VENTANA_TENDENCIA,
): Array<{ mes: string; total: number }> {
  const tendencia: Array<{ mes: string; total: number }> = []

  for (let mesesAtras = meses - 1; mesesAtras >= 0; mesesAtras--) {
    const mesPrefijo = prefijoMesRelativo(mesesAtras)
    const total = gastos
      .filter((g) => g.moneda === moneda && g.fecha.slice(0, 7) === mesPrefijo)
      .reduce((totalAcumulado, g) => totalAcumulado + (g.monto ?? 0), 0)
    tendencia.push({ mes: mesPrefijo, total })
  }

  return tendencia
}

/**
 * Composable de dominio del Dashboard (Épica 7). A diferencia de
 * `usePresupuestos` (que reutiliza `store.gastos` ya cargado por
 * `useGastos.cargarGastos`), el Dashboard consulta `gastos` directamente y
 * mantiene sus filas en un `ref` local: necesita una ventana de hasta 6 meses
 * para la tendencia, y no puede depender de que Historial se haya visitado
 * antes (acoplarse a `store.gastos` sería frágil). Tampoco escribe en el
 * store la lista de gastos: sus resultados son agregados de solo-lectura y
 * escribirla rompería el Historial. Solo usa el store para `cargando`/`error`.
 */
export function useDashboard() {
  const store = useGastosStore()

  /** Filas crudas de la ventana de 6 meses, fuente de las tres agregaciones. */
  const filas = ref<Gasto[]>([])

  /**
   * Fetch único de los gastos confirmados desde el primer día del mes hace
   * `MESES_VENTANA_TENDENCIA - 1` meses hasta hoy. Un array vacío NO es un
   * error: significa que el usuario no tiene gastos confirmados en la ventana.
   */
  async function cargarDatosDashboard() {
    store.establecerCargando(true)
    store.limpiarError()
    try {
      const { data, error } = await supabase
        .from('gastos')
        .select()
        .eq('estado', 'confirmado')
        .gte('fecha', primerDiaDeMesRelativo(MESES_VENTANA_TENDENCIA - 1))
        .order('fecha', { ascending: false })
      if (error) {
        store.establecerError('No se pudieron cargar los datos del dashboard.')
        return false
      }
      filas.value = (data ?? []) as Gasto[]
      return true
    } finally {
      store.establecerCargando(false)
    }
  }

  return {
    filas,
    cargarDatosDashboard,
  }
}
