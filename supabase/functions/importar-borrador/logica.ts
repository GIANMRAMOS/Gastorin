/**
 * Helpers PUROS de la Edge Function `importar-borrador`, extraídos de
 * `index.ts` para poder testearlos con Vitest sin runtime de Deno ni red
 * (ver `__tests__/logica.spec.ts`). No importan nada de Deno ni de
 * `@supabase/supabase-js`.
 */

/** Moneda soportada, espejo de `src/types/gasto.ts` (`Moneda`). */
export type MonedaPayload = 'PEN' | 'USD'

/**
 * Cuerpo esperado del POST a `importar-borrador`. `usuario_id`, si viene, se
 * IGNORA deliberadamente: el `usuario_id` real siempre es el fijo del
 * servidor (ver `resolverUsuarioId` en `index.ts`), nunca el del payload.
 */
export interface PayloadImportarBorrador {
  gmail_message_id?: unknown
  fecha?: unknown
  monto?: unknown
  moneda?: unknown
  ambiguo?: unknown
  categoria_id?: unknown
  descripcion?: unknown
  gmail_fragmento?: unknown
  usuario_id?: unknown
}

/** Resultado de validar el payload: si es inválido, incluye el motivo fijo pedido por el contrato. */
export interface ResultadoValidacion {
  valido: boolean
  motivo?: string
}

/**
 * Valida los campos obligatorios y los tipos de los opcionales del payload.
 * Requeridos: `gmail_message_id` (string no vacío) y `fecha` (string no
 * vacía, formato `YYYY-MM-DD`). `monto`/`moneda` son opcionales pero, si
 * vienen, deben ser válidos (monto > 0, moneda PEN/USD).
 */
export function validarPayload(payload: PayloadImportarBorrador): ResultadoValidacion {
  if (payload == null || typeof payload !== 'object') {
    return { valido: false, motivo: 'validación' }
  }
  if (typeof payload.gmail_message_id !== 'string' || payload.gmail_message_id.trim() === '') {
    return { valido: false, motivo: 'validación' }
  }
  if (
    typeof payload.fecha !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(payload.fecha)
  ) {
    return { valido: false, motivo: 'validación' }
  }
  if (payload.monto != null && (typeof payload.monto !== 'number' || payload.monto <= 0)) {
    return { valido: false, motivo: 'validación' }
  }
  if (payload.moneda != null && payload.moneda !== 'PEN' && payload.moneda !== 'USD') {
    return { valido: false, motivo: 'validación' }
  }
  if (payload.categoria_id != null && typeof payload.categoria_id !== 'string') {
    return { valido: false, motivo: 'validación' }
  }
  return { valido: true }
}

/**
 * Resuelve el estado del gasto a insertar: `revision_manual` si el correo se
 * marcó ambiguo o faltan `monto`/`moneda`; `borrador` en cualquier otro caso.
 */
export function resolverEstado(payload: PayloadImportarBorrador): 'borrador' | 'revision_manual' {
  const faltanDatos = payload.monto == null || payload.moneda == null
  return payload.ambiguo === true || faltanDatos ? 'revision_manual' : 'borrador'
}
