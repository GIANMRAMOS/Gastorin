/**
 * Tipos del dominio "meta de ahorro" (Épica 13, HU-13.1), espejo de la tabla
 * `metas_ahorro` (ver `supabase/migrations/009_metas_ahorro.sql`). Es una
 * fila ÚNICA por usuario (`usuario_id` es la propia PK de la tabla, no hay
 * lista): "Ahorro comprometido" siempre muestra como máximo una meta activa.
 *
 * Supuesto declarado: la tabla NO tiene columna `moneda` (la meta es
 * mono-moneda implícita del usuario). En esta app se asume SIEMPRE en PEN,
 * el mismo supuesto que ya usa la card "Proyección" del sidebar del App
 * Shell: no se recalcula con el toggle de moneda del encabezado de
 * `PresupuestosView`.
 */
export interface MetaAhorro {
  usuario_id: string
  descripcion: string
  monto: number
  actualizado_en: string
}

/** Payload de alta/edición de la meta de ahorro (siempre un upsert por `usuario_id`, ver `useMetasAhorro.guardarMeta`). */
export interface MetaAhorroInput {
  descripcion: string
  monto: number
}
