import { ref } from 'vue'
import { useGastosStore } from '@/stores/gastos'
import { supabase } from '@/lib/supabaseClient'
import type { Gasto, Moneda } from '@/types/gasto'
import type { Banco, Ingreso } from '@/types/ingreso'
import type { AjusteSaldoCuenta } from '@/types/ajusteSaldo'

/** Cantidad de meses (incluido el actual) que cubre la ventana de la tendencia mensual. */
const MESES_VENTANA_TENDENCIA = 6

/** Cantidad de días (incluido hoy) que cubre la ventana de la tendencia diaria. */
const DIAS_VENTANA_TENDENCIA_DIARIA = 30

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
 * Devuelve la fecha `YYYY-MM-DD` de hoy menos `diasAtras` días (0 = hoy).
 * Aritmética local (mismo estilo que `primerDiaDeMesRelativo`): usa
 * `getFullYear/getMonth/getDate` en vez de manipular strings, para que el
 * cruce de mes/año se resuelva solo (evita el desfase de zona horaria de
 * `toISOString()`, que convierte a UTC).
 */
function fechaDiaRelativo(diasAtras: number): string {
  const ahora = new Date()
  const fecha = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - diasAtras)
  const anio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
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
 * Devuelve el total gastado en `moneda` de los últimos `dias` (incluyendo
 * hoy), en orden cronológico ascendente (el último elemento es hoy). Los
 * días sin gasto aparecen con `total: 0` (no se descartan, para que el
 * gráfico no tenga huecos), análogo a `cargarTendenciaMensual` pero
 * agrupando por día `YYYY-MM-DD` en vez de por mes. No hace fetch nuevo: la
 * ventana de 30 días cae dentro de los 6 meses ya cargados en `filas`.
 */
export function cargarTendenciaDiaria(
  gastos: Gasto[],
  moneda: Moneda,
  dias = DIAS_VENTANA_TENDENCIA_DIARIA,
): Array<{ dia: string; total: number }> {
  const tendencia: Array<{ dia: string; total: number }> = []

  for (let diasAtras = dias - 1; diasAtras >= 0; diasAtras--) {
    const dia = fechaDiaRelativo(diasAtras)
    const total = gastos
      .filter((g) => g.moneda === moneda && g.fecha.slice(0, 10) === dia)
      .reduce((totalAcumulado, g) => totalAcumulado + (g.monto ?? 0), 0)
    tendencia.push({ dia, total })
  }

  return tendencia
}

/**
 * Calcula, de forma pura, el balance neto (ingresos − gastos) de `mes`
 * (prefijo `YYYY-MM`) por moneda (Épica 11, HU-11.4). Cada moneda se calcula
 * por separado y NUNCA se mezclan entre sí (un balance en PEN no debe sumarse
 * con uno en USD).
 */
export function cargarBalancePorMoneda(
  gastos: Gasto[],
  ingresos: Ingreso[],
  mes: string,
): Record<Moneda, { ingresos: number; gastos: number; balance: number }> {
  const mesActual = mes.slice(0, 7)
  const balancePorMoneda = {} as Record<Moneda, { ingresos: number; gastos: number; balance: number }>
  const monedas: Moneda[] = ['PEN', 'USD']

  for (const moneda of monedas) {
    const totalIngresos = ingresos
      .filter((ingreso) => ingreso.moneda === moneda && ingreso.fecha.slice(0, 7) === mesActual)
      .reduce((total, ingreso) => total + ingreso.importe, 0)
    const totalGastos = gastos
      .filter((gasto) => gasto.moneda === moneda && gasto.fecha.slice(0, 7) === mesActual)
      .reduce((total, gasto) => total + (gasto.monto ?? 0), 0)

    balancePorMoneda[moneda] = {
      ingresos: totalIngresos,
      gastos: totalGastos,
      balance: totalIngresos - totalGastos,
    }
  }

  return balancePorMoneda
}

/** Prefijos de nombre (case-insensitive) de las únicas dos cuentas que la tarjeta "Saldo por cuenta" muestra hoy. */
const PREFIJOS_CUENTA_DASHBOARD = ['bcp', 'ibk']

/** Saldo neto de una cuenta (banco) para la tarjeta "Saldo por cuenta" del Dashboard. */
export interface SaldoCuenta {
  bancoId: string
  nombreBanco: string
  /** Saldo en PEN (moneda base de la tarjeta): ingresos − gastos de ese banco. */
  saldoPen: number
  /** Saldo en USD, o `null` si el banco no tiene ningún movimiento en esa moneda (no se muestra badge). */
  saldoUsd: number | null
}

/**
 * Calcula, de forma pura, el saldo neto (ingresos − gastos) por cuenta para
 * la tarjeta "Saldo por cuenta" del Dashboard. Ajuste de alcance: solo
 * incluye bancos cuyo nombre empiece con "BCP"/"IBK" (case-insensitive);
 * cualquier otro banco (u "Otros ingresos"-style de respaldo) se ignora aquí,
 * a propósito. Nota clave: "IBK" e "IBK US$" son DOS bancos reales y
 * separados en `bancos` (la ingesta los creó así para distinguir moneda),
 * NO una sola cuenta con dos monedas — cada uno produce su propia entrada
 * en el resultado, con su propio `bancoId`. `TarjetaSaldosPorCuenta` decide
 * cómo etiquetarlos ("IBK S/."/"IBK $") y en qué moneda mostrar el monto
 * principal de cada uno, pero nunca inventa ni divide una cuenta aquí.
 *
 * Usa `gastos`/`ingresos` tal como los recibe (la ventana de 6 meses ya
 * cargada por `cargarDatosDashboard`, ver `useDashboard()` abajo): para un
 * proyecto que recién empezó a registrarse en Gastorin esto cubre toda su
 * historia real; si en el futuro se necesita un saldo verdaderamente
 * histórico (>6 meses), este composable necesitaría su propio fetch sin
 * ventana, igual que `AppShellLayout` hace para la card "Proyección".
 *
 * Cada cuenta SIEMPRE aparece (aunque su saldo sea 0): a diferencia de
 * `saldosPorBanco` (que omite combinaciones en 0 para un desglose informal),
 * aquí las cuentas vienen de un catálogo conocido (bancos ya creados en
 * `bancos`), no de un descubrimiento dinámico — omitir una dejaría un hueco
 * visual confuso ("¿y mi otra cuenta?"). El USD sí se omite (`null`) si el
 * banco nunca tuvo movimiento en esa moneda NI un ajuste seteado en USD,
 * para no mostrar un badge "$ 0.00" vacío de significado.
 *
 * `ajustes` (migración 011, "setear saldo de cuenta"): si una cuenta+moneda
 * tiene al menos un ajuste, el saldo mostrado es `ajuste.saldo` MÁS los
 * ingresos/gastos de esa cuenta con fecha POSTERIOR (estrictamente, `>`) a
 * `ajuste.fecha` — nunca desde el inicio de los tiempos. Se resuelve "el
 * último ajuste" internamente vía `resolverUltimosAjustes`, así que esta
 * función acepta el historial completo tal cual lo carga `useAjustesSaldo`,
 * sin que el llamador tenga que filtrarlo primero.
 */
function resolverUltimosAjustes(ajustes: AjusteSaldoCuenta[]): Map<string, AjusteSaldoCuenta> {
  const porClave = new Map<string, AjusteSaldoCuenta>()
  for (const ajuste of ajustes) {
    const clave = `${ajuste.banco_id}|${ajuste.moneda}`
    const actual = porClave.get(clave)
    if (
      !actual ||
      ajuste.fecha > actual.fecha ||
      (ajuste.fecha === actual.fecha && ajuste.creado_en > actual.creado_en)
    ) {
      porClave.set(clave, ajuste)
    }
  }
  return porClave
}

export function calcularSaldoNetoPorCuenta(
  bancos: Banco[],
  gastos: Gasto[],
  ingresos: Ingreso[],
  ajustes: AjusteSaldoCuenta[] = [],
): SaldoCuenta[] {
  const ultimosAjustes = resolverUltimosAjustes(ajustes)

  const cuentas = bancos
    .filter((banco) =>
      PREFIJOS_CUENTA_DASHBOARD.some((prefijo) => banco.nombre.toLowerCase().startsWith(prefijo)),
    )
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }))

  return cuentas.map((banco) => {
    const gastosBanco = gastos.filter((gasto) => gasto.banco_id === banco.id)
    const ingresosBanco = ingresos.filter((ingreso) => ingreso.banco_id === banco.id)
    const tieneMovimientoUsd =
      gastosBanco.some((gasto) => gasto.moneda === 'USD') ||
      ingresosBanco.some((ingreso) => ingreso.moneda === 'USD') ||
      ultimosAjustes.has(`${banco.id}|USD`)

    function saldoEnMoneda(moneda: Moneda): number {
      const ajuste = ultimosAjustes.get(`${banco.id}|${moneda}`)
      const totalIngresos = ingresosBanco
        .filter((ingreso) => ingreso.moneda === moneda && (!ajuste || ingreso.fecha > ajuste.fecha))
        .reduce((total, ingreso) => total + ingreso.importe, 0)
      const totalGastos = gastosBanco
        .filter((gasto) => gasto.moneda === moneda && (!ajuste || gasto.fecha > ajuste.fecha))
        .reduce((total, gasto) => total + (gasto.monto ?? 0), 0)
      return (ajuste?.saldo ?? 0) + totalIngresos - totalGastos
    }

    return {
      bancoId: banco.id,
      nombreBanco: banco.nombre,
      saldoPen: saldoEnMoneda('PEN'),
      saldoUsd: tieneMovimientoUsd ? saldoEnMoneda('USD') : null,
    }
  })
}

/**
 * Movimiento (gasto o ingreso) unificado para el widget "Últimos
 * movimientos"/feed del Dashboard. Es el tipo de retorno de
 * `combinarUltimosMovimientos` y `combinarMovimientosDelMes`: no amerita tocar
 * `types/`, ya que solo se usa para esta agregación. `categoriaId`/`bancoId`
 * (extensión aditiva, Fase 0 "Caudal") permiten que el feed resuelva
 * "categoría · banco" contra los stores; un ingreso NUNCA tiene categoría
 * (la tabla `ingresos` no tiene `categoria_id`), por eso `categoriaId` es
 * `string | null` y no `string`.
 *
 * `creadoEn` (HU-18.1): timestamp real de registro (`gastos.creado_en` /
 * `ingresos.created_at`, nombres distintos entre tablas). Se usa como
 * desempate en `compararMovimientosDesc` para que, dentro de un mismo día,
 * el feed muestre primero lo registrado más recientemente — no basta con
 * ordenar la query por esta columna porque el feed se re-agrupa por `fecha`
 * en memoria (ver micro-plan).
 */
export interface MovimientoUnificado {
  tipo: 'gasto' | 'ingreso'
  fecha: string
  monto: number
  descripcion: string
  moneda: Moneda
  id: string
  categoriaId: string | null
  bancoId: string
  creadoEn: string
}

/** Mapea un `Gasto` a `MovimientoUnificado` (reutilizado por ambas funciones de combinación). */
function movimientoDesdeGasto(gasto: Gasto): MovimientoUnificado {
  return {
    tipo: 'gasto',
    fecha: gasto.fecha,
    monto: gasto.monto ?? 0,
    descripcion: gasto.descripcion ?? '',
    moneda: gasto.moneda ?? 'PEN',
    id: gasto.id,
    categoriaId: gasto.categoria_id,
    bancoId: gasto.banco_id,
    creadoEn: gasto.creado_en,
  }
}

/** Mapea un `Ingreso` a `MovimientoUnificado` (reutilizado por ambas funciones de combinación). */
function movimientoDesdeIngreso(ingreso: Ingreso): MovimientoUnificado {
  return {
    tipo: 'ingreso',
    fecha: ingreso.fecha,
    monto: ingreso.importe,
    descripcion: ingreso.concepto,
    moneda: ingreso.moneda,
    id: ingreso.id,
    categoriaId: null,
    bancoId: ingreso.banco_id,
    creadoEn: ingreso.created_at,
  }
}

/**
 * Orden del feed: `fecha` desc como criterio primario (del que depende el
 * agrupado por día de `agruparPorFecha`); dentro del mismo día, `creadoEn`
 * desc (HU-18.1: lo registrado más recientemente aparece primero); y como
 * último desempate determinista, `id` desc, para el caso borde de
 * `creadoEn` igual o ausente.
 */
function compararMovimientosDesc(a: MovimientoUnificado, b: MovimientoUnificado): number {
  if (a.fecha !== b.fecha) return b.fecha.localeCompare(a.fecha)
  if (a.creadoEn !== b.creadoEn) return b.creadoEn.localeCompare(a.creadoEn)
  return b.id.localeCompare(a.id)
}

/**
 * Mezcla `gastos` + `ingresos` en una sola lista de `MovimientoUnificado`,
 * ordenada por fecha descendente (más reciente primero) y recortada a
 * `limite`. A diferencia de `agruparPorFecha` (que asume input ya
 * ordenado), esta función SÍ ordena: mezcla dos fuentes ordenadas por
 * separado (`filas`/`filasIngresos`), igual que `cargarBalancePorMoneda` ya
 * mezcla ambas fuentes para el balance neto. El desempate en fecha igual usa
 * `id` (orden determinista y reproducible en los tests).
 */
export function combinarUltimosMovimientos(
  gastos: Gasto[],
  ingresos: Ingreso[],
  limite = 5,
): MovimientoUnificado[] {
  const movimientosGastos = gastos.map(movimientoDesdeGasto)
  const movimientosIngresos = ingresos.map(movimientoDesdeIngreso)

  return [...movimientosGastos, ...movimientosIngresos]
    .sort(compararMovimientosDesc)
    .slice(0, limite)
}

/**
 * Filtro de tipo de movimiento del feed de "Inicio" (chips Todos/Ingresos/
 * Egresos, ver `ChipsFiltroTipo.vue`). Alias exportado para no repetir el
 * literal union en cada consumidor (`FeedMovimientos.vue`, `DashboardView.vue`).
 */
export type TipoFiltroMovimiento = 'todos' | 'ingresos' | 'egresos'

/**
 * Variante de `combinarUltimosMovimientos` para el feed unificado de la
 * pantalla "Inicio" (Fase 0 "Caudal"): filtra por `mes` (prefijo `YYYY-MM`),
 * por `moneda` y por `tipo` (`'todos'|'ingresos'|'egresos'`), ordena desc por
 * fecha y NO recorta a un tope (el feed muestra todos los movimientos del mes
 * que calcen con el filtro de chips activo).
 */
export function combinarMovimientosDelMes(
  gastos: Gasto[],
  ingresos: Ingreso[],
  mes: string,
  moneda: Moneda,
  tipo: TipoFiltroMovimiento,
): MovimientoUnificado[] {
  const mesPrefijo = mes.slice(0, 7)

  const movimientosGastos =
    tipo === 'ingresos'
      ? []
      : gastos
          .filter((gasto) => (gasto.moneda ?? 'PEN') === moneda && gasto.fecha.slice(0, 7) === mesPrefijo)
          .map(movimientoDesdeGasto)

  const movimientosIngresos =
    tipo === 'egresos'
      ? []
      : ingresos
          .filter((ingreso) => ingreso.moneda === moneda && ingreso.fecha.slice(0, 7) === mesPrefijo)
          .map(movimientoDesdeIngreso)

  return [...movimientosGastos, ...movimientosIngresos].sort(compararMovimientosDesc)
}

/**
 * Proyecta el gasto de cierre de mes a partir de lo gastado hasta hoy,
 * extrapolando linealmente (`gastadoDelMes / diaActual * diasDelMes`). Guarda
 * contra división por cero: si `diaActual <= 0` (dato inválido) devuelve 0 en
 * vez de `Infinity`/`NaN`.
 */
export function proyeccionCierreMes(gastadoDelMes: number, diaActual: number, diasDelMes: number): number {
  if (diaActual <= 0) return 0
  return (gastadoDelMes / diaActual) * diasDelMes
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
  /** Ingresos de la misma ventana de 6 meses, fuente del balance por moneda (HU-11.4). */
  const filasIngresos = ref<Ingreso[]>([])

  /**
   * Fetch de los gastos confirmados e ingresos desde el primer día del mes
   * hace `MESES_VENTANA_TENDENCIA - 1` meses hasta hoy. Un array vacío NO es
   * un error: significa que el usuario no tiene datos en la ventana.
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
        .order('creado_en', { ascending: false })
      if (error) {
        store.establecerError('No se pudieron cargar los datos del dashboard.')
        return false
      }
      filas.value = (data ?? []) as Gasto[]

      const { data: dataIngresos, error: errorIngresos } = await supabase
        .from('ingresos')
        .select()
        .gte('fecha', primerDiaDeMesRelativo(MESES_VENTANA_TENDENCIA - 1))
        .order('created_at', { ascending: false })
      if (errorIngresos) {
        store.establecerError('No se pudieron cargar los datos del dashboard.')
        return false
      }
      filasIngresos.value = (dataIngresos ?? []) as Ingreso[]
      return true
    } finally {
      store.establecerCargando(false)
    }
  }

  return {
    filas,
    filasIngresos,
    cargarDatosDashboard,
  }
}
