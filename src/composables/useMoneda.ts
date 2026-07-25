import type { Moneda } from '@/types/gasto'

/** Configuración de formato por moneda soportada: locale + código ISO para `Intl.NumberFormat`. */
const CONFIGURACION_MONEDA: Record<Moneda, { locale: string; codigo: string }> = {
  PEN: { locale: 'es-PE', codigo: 'PEN' },
  USD: { locale: 'en-US', codigo: 'USD' },
}

/**
 * Nombre de banco de respaldo (migración 006); se excluye del desglose por
 * banco. Exportada (no solo privada aquí) para que `useDashboard.ts` la
 * reutilice como fuente única de verdad al excluirlo del desglose de balance
 * neto por banco (`cargarBalanceNetoPorBanco`), sin duplicar el literal.
 */
export const NOMBRE_BANCO_NO_ESPECIFICADO = 'No especificado'

/**
 * Composable puro (sin estado ni store) para formatear montos de dinero
 * según la moneda del gasto. Se usa en el formulario, la confirmación y la lista.
 */
export function useMoneda() {
  /** Formatea un monto numérico como texto de moneda (ej. `S/ 45.50`, `$45.50`). */
  function formatearMonto(monto: number, moneda: Moneda): string {
    const { locale, codigo } = CONFIGURACION_MONEDA[moneda]
    return new Intl.NumberFormat(locale, { style: 'currency', currency: codigo }).format(monto)
  }

  /**
   * Dado un conjunto ya filtrado de ítems con moneda y monto, determina la
   * moneda predominante (la de más movimientos; en empate gana PEN) y suma
   * solo los montos de esa moneda. Se usa para el totalizador de Ingresos e
   * Historial: si el filtro de moneda ya dejó un conjunto homogéneo, la
   * función lo resuelve igual, sin caso especial. Devuelve `null` si el
   * conjunto está vacío (no hay nada que totalizar).
   */
  function resumenMonedaPredominante(
    items: Array<{ moneda: Moneda; monto: number }>,
  ): { moneda: Moneda; total: number } | null {
    if (items.length === 0) return null

    const conteoPorMoneda: Record<Moneda, number> = { PEN: 0, USD: 0 }
    for (const item of items) {
      conteoPorMoneda[item.moneda] += 1
    }

    // Empate → PEN gana (se evalúa PEN primero y solo se reemplaza si USD tiene MÁS conteo).
    const monedaPredominante: Moneda = conteoPorMoneda.USD > conteoPorMoneda.PEN ? 'USD' : 'PEN'

    const total = items
      .filter((item) => item.moneda === monedaPredominante)
      .reduce((suma, item) => suma + item.monto, 0)

    return { moneda: monedaPredominante, total }
  }

  /**
   * Dado un conjunto ya filtrado de ítems con banco y moneda, agrupa los
   * montos por banco y, dentro de cada banco, por moneda (nunca se suma
   * PEN+USD entre sí). Se usa para el desglose de saldos por banco de
   * Ingresos (junto al totalizador de `resumenMonedaPredominante`).
   *
   * Excluye el banco de respaldo "No especificado" (comparación
   * case-insensitive, coherente con la migración 006 e `importar-borrador`).
   * Omite las combinaciones banco+moneda cuyo total sea 0: la clave de esa
   * moneda simplemente no aparece en `montosPorMoneda` (no se muestra $ 0.00).
   */
  function saldosPorBanco(
    items: Array<{ bancoId: string; nombreBanco: string; moneda: Moneda; monto: number }>,
  ): Array<{ bancoId: string; nombreBanco: string; montosPorMoneda: Partial<Record<Moneda, number>> }> {
    const acumuladoPorBanco = new Map<
      string,
      { nombreBanco: string; montosPorMoneda: Partial<Record<Moneda, number>> }
    >()

    for (const item of items) {
      if (item.nombreBanco.toLowerCase() === NOMBRE_BANCO_NO_ESPECIFICADO.toLowerCase()) continue

      const entradaBanco = acumuladoPorBanco.get(item.bancoId) ?? {
        nombreBanco: item.nombreBanco,
        montosPorMoneda: {},
      }
      entradaBanco.montosPorMoneda[item.moneda] = (entradaBanco.montosPorMoneda[item.moneda] ?? 0) + item.monto
      acumuladoPorBanco.set(item.bancoId, entradaBanco)
    }

    const resultado: Array<{
      bancoId: string
      nombreBanco: string
      montosPorMoneda: Partial<Record<Moneda, number>>
    }> = []

    for (const [bancoId, entradaBanco] of acumuladoPorBanco) {
      // Omite las combinaciones banco+moneda cuyo total sea 0 (clave ausente, no `0`).
      const montosPorMoneda: Partial<Record<Moneda, number>> = {}
      for (const [moneda, total] of Object.entries(entradaBanco.montosPorMoneda) as Array<[Moneda, number]>) {
        if (total !== 0) montosPorMoneda[moneda] = total
      }

      if (Object.keys(montosPorMoneda).length > 0) {
        resultado.push({ bancoId, nombreBanco: entradaBanco.nombreBanco, montosPorMoneda })
      }
    }

    return resultado
  }

  /**
   * Dado un conjunto ya filtrado de ítems con banco y moneda, suma SOLO los
   * ítems cuyo banco es el de respaldo "No especificado" (comparación
   * case-insensitive), agrupados por moneda. Es la inversa de `saldosPorBanco`:
   * mientras esa excluye "No especificado", esta suma únicamente eso. Se usa
   * para la nota "Incluye … sin banco asignado" bajo el desglose por banco.
   *
   * Omite las monedas cuyo total sea ≤ 0: la clave simplemente no aparece
   * (misma convención de "no mostrar 0" que `saldosPorBanco`).
   */
  function montoSinBancoPorMoneda(
    items: Array<{ nombreBanco: string; moneda: Moneda; monto: number }>,
  ): Partial<Record<Moneda, number>> {
    const acumuladoPorMoneda: Partial<Record<Moneda, number>> = {}

    for (const item of items) {
      if (item.nombreBanco.toLowerCase() !== NOMBRE_BANCO_NO_ESPECIFICADO.toLowerCase()) continue
      acumuladoPorMoneda[item.moneda] = (acumuladoPorMoneda[item.moneda] ?? 0) + item.monto
    }

    const resultado: Partial<Record<Moneda, number>> = {}
    for (const [moneda, total] of Object.entries(acumuladoPorMoneda) as Array<[Moneda, number]>) {
      if (total > 0) resultado[moneda] = total
    }

    return resultado
  }

  /**
   * Dado un conjunto ya filtrado de ítems con categoría y moneda, suma los
   * montos de la `moneda` pedida por `categoria_id`, ordenado de mayor a
   * menor total. Espejo de `saldosPorBanco`, pero SIN exclusiones: a
   * diferencia de banco (que tenía un valor de respaldo "No especificado"),
   * la categoría es obligatoria tanto en Gasto como en Ingreso (migración
   * `008`), así que no existe un caso "sin categoría" que excluir. Se usa
   * para alimentar `ListaGastoPorCategoria` en el sidebar "Por categoría" de
   * Egresos e Ingresos (Fase 2 "Caudal").
   */
  function totalesPorCategoria(
    items: Array<{ categoria_id: string; nombre: string; moneda: Moneda; monto: number }>,
    moneda: Moneda,
  ): Array<{ categoria_id: string; nombre: string; total: number }> {
    const acumuladoPorCategoria = new Map<string, { nombre: string; total: number }>()

    for (const item of items) {
      if (item.moneda !== moneda) continue
      const entrada = acumuladoPorCategoria.get(item.categoria_id) ?? { nombre: item.nombre, total: 0 }
      entrada.total += item.monto
      acumuladoPorCategoria.set(item.categoria_id, entrada)
    }

    return Array.from(acumuladoPorCategoria.entries())
      .map(([categoria_id, { nombre, total }]) => ({ categoria_id, nombre, total }))
      .sort((a, b) => b.total - a.total)
  }

  return {
    formatearMonto,
    resumenMonedaPredominante,
    saldosPorBanco,
    montoSinBancoPorMoneda,
    totalesPorCategoria,
  }
}
