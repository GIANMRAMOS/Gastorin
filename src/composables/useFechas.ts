/**
 * Composable de fechas genérico (formateo/agrupación), pensado para crecer
 * con más helpers de fecha sin crear un archivo por función (ver
 * "Decisiones de ubicación" del micro-plan). Funciones puras exportadas a
 * nivel de módulo, mismo patrón que `useDashboard.ts`/`useCategorias.ts`.
 */

/**
 * Construye un `Date` a partir de una fecha `YYYY-MM-DD` (o con hora,
 * `slice(0, 10)` la recorta) usando partes locales (`new Date(anio, mes-1,
 * dia)`). NUNCA `new Date('YYYY-MM-DD')` ni `toISOString()`: ambos rompen a
 * UTC y desfasan el día en zonas horarias negativas (ver `fechaDiaRelativo`
 * en `useDashboard.ts`, mismo criterio).
 */
function fechaLocalDesde(fecha: string): Date {
  const [anio, mes, dia] = fecha.slice(0, 10).split('-').map(Number)
  return new Date(anio, mes - 1, dia)
}

/** Representa un `Date` como string `YYYY-MM-DD` local (para comparar días, no instantes). */
function comoStringLocal(fecha: Date): string {
  const anio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

/**
 * Etiqueta legible de una fecha `YYYY-MM-DD`: "Hoy" o "Ayer" si corresponde
 * (comparando strings de día local, no aritmética de milisegundos, para que
 * el cruce de mes/año se resuelva solo); en cualquier otro caso, fecha larga
 * en español (`Intl.DateTimeFormat('es-PE', ...)`), sin año si coincide con
 * el año actual, con año si no.
 */
export function etiquetaFecha(fecha: string): string {
  const fechaObjetivo = fechaLocalDesde(fecha)
  const hoy = new Date()
  const ayer = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1)

  const stringObjetivo = comoStringLocal(fechaObjetivo)
  if (stringObjetivo === comoStringLocal(hoy)) return 'Hoy'
  if (stringObjetivo === comoStringLocal(ayer)) return 'Ayer'

  const opciones: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' }
  if (fechaObjetivo.getFullYear() !== hoy.getFullYear()) {
    opciones.year = 'numeric'
  }
  return new Intl.DateTimeFormat('es-PE', opciones).format(fechaObjetivo)
}

/**
 * Formatea un prefijo de mes `YYYY-MM` como "Julio 2026" (mes capitalizado en
 * español + año), para el selector de mes tipo dropdown de Egresos/Ingresos
 * (Fase 2 "Caudal"). Mismo criterio que `DashboardView.mesFormateado`: se
 * formatea solo el mes con `Intl` (en minúscula) y se concatena el año a
 * mano, porque el formato combinado `{month:'long', year:'numeric'}` de
 * `Intl` en es-PE inserta un "de" ("julio de 2026") que no calza con el
 * rótulo deseado.
 */
export function formatearMes(mesPrefijo: string): string {
  const [anio, mes] = mesPrefijo.slice(0, 7).split('-').map(Number)
  const fecha = new Date(anio, mes - 1, 1)
  const nombreMes = new Intl.DateTimeFormat('es-PE', { month: 'long' }).format(fecha)
  return `${nombreMes.charAt(0).toUpperCase()}${nombreMes.slice(1)} ${anio}`
}

/**
 * Agrupa `items` (ya ordenados, típicamente desc) en bloques consecutivos
 * por día (`obtenerFecha(item).slice(0, 10)`), etiquetando cada grupo con
 * `etiquetaFecha`. NO reordena: si el input no está ordenado por fecha, un
 * mismo día puede aparecer en más de un grupo (se asume input ya ordenado,
 * como `store.gastos`/`store.ingresos`). Lista vacía → `[]`.
 */
export function agruparPorFecha<T>(
  items: T[],
  obtenerFecha: (item: T) => string,
): Array<{ etiqueta: string; items: T[] }> {
  const grupos: Array<{ etiqueta: string; clave: string; items: T[] }> = []

  for (const item of items) {
    const clave = obtenerFecha(item).slice(0, 10)
    const grupoActual = grupos.at(-1)
    if (grupoActual && grupoActual.clave === clave) {
      grupoActual.items.push(item)
    } else {
      grupos.push({ etiqueta: etiquetaFecha(clave), clave, items: [item] })
    }
  }

  return grupos.map(({ etiqueta, items }) => ({ etiqueta, items }))
}
