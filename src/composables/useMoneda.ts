import type { Moneda } from '@/types/gasto'

/** Configuración de formato por moneda soportada: locale + código ISO para `Intl.NumberFormat`. */
const CONFIGURACION_MONEDA: Record<Moneda, { locale: string; codigo: string }> = {
  PEN: { locale: 'es-PE', codigo: 'PEN' },
  USD: { locale: 'en-US', codigo: 'USD' },
}

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

  return { formatearMonto }
}
