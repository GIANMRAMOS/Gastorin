/**
 * Tipo del dominio "regla de comercio" (Épica 14, HU-14.1), espejo de la
 * tabla `reglas_comercio` (ver `supabase/migrations/010_reglas_comercio.sql`).
 * Al confirmar un borrador con una categoría, se recuerda para el mismo
 * comercio y se sugiere automáticamente la próxima vez que aparezca. Desde la
 * migración `012_reglas_comercio_banco.sql`, la regla recuerda categoría **y**
 * banco.
 */

/** Fila de la tabla `reglas_comercio`. PK compuesta `(usuario_id, comercio)`. */
export interface ReglaComercio {
  usuario_id: string
  /** Nombre del comercio ya normalizado (lower + trim, ver `normalizarComercio`). */
  comercio: string
  categoria_id: string
  /** Banco recordado del comercio (migración 012). `null` en reglas creadas antes de esa migración. */
  banco_id: string | null
  actualizado_en: string
}
