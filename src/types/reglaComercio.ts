/**
 * Tipo del dominio "regla de comercio" (Épica 14, HU-14.1), espejo de la
 * tabla `reglas_comercio` (ver `supabase/migrations/010_reglas_comercio.sql`).
 * Al confirmar un borrador con una categoría, se recuerda para el mismo
 * comercio y se sugiere automáticamente la próxima vez que aparezca.
 */

/** Fila de la tabla `reglas_comercio`. PK compuesta `(usuario_id, comercio)`. */
export interface ReglaComercio {
  usuario_id: string
  /** Nombre del comercio ya normalizado (lower + trim, ver `normalizarComercio`). */
  comercio: string
  categoria_id: string
  actualizado_en: string
}
