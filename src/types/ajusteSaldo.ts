import type { Moneda } from './gasto'

/**
 * Fila de la tabla `ajustes_saldo_cuenta` (migración 011): fija el saldo real
 * de una cuenta (banco+moneda) a partir de una fecha. Es historial, no una
 * sola fila por cuenta: el ajuste vigente es el de `fecha` más reciente
 * (desempate por `creado_en`) para ese `banco_id`+`moneda`.
 */
export interface AjusteSaldoCuenta {
  id: string
  usuario_id: string
  banco_id: string
  moneda: Moneda
  saldo: number
  fecha: string
  creado_en: string
}

/** Datos necesarios para crear un nuevo ajuste de saldo. */
export interface AjusteSaldoCuentaInput {
  banco_id: string
  moneda: Moneda
  saldo: number
  fecha: string
}
