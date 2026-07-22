/**
 * Tipos compartidos del dominio "ingreso" (Épica 11), espejo de las tablas
 * `bancos` e `ingresos` (ver migraciones `005` y `006`).
 */
import type { Moneda } from './gasto'

/**
 * Fila de la tabla `bancos`: catálogo de bancos/billeteras del usuario.
 * Catálogo compartido: además de en Ingresos, se consume desde el dominio de
 * Gastos (el gasto ahora exige `banco_id`, ver `types/gasto.ts`).
 */
export interface Banco {
  id: string
  usuario_id: string
  nombre: string
  created_at: string
}

/** Fila de la tabla `ingresos`. */
export interface Ingreso {
  id: string
  usuario_id: string
  banco_id: string
  fecha: string
  moneda: Moneda
  importe: number
  concepto: string
  created_at: string
}

/** Payload de alta de un ingreso (subconjunto editable por el usuario). */
export interface IngresoInput {
  banco_id: string
  fecha: string
  moneda: Moneda
  importe: number
  concepto: string
}
