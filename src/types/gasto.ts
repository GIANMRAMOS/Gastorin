/**
 * Tipos compartidos del dominio "gasto", espejo de las tablas `gastos` y
 * `categorias` (ver `supabase/migrations/001_init_gastorin.sql`).
 */

/** Moneda soportada por un gasto o presupuesto. */
export type Moneda = 'PEN' | 'USD'

/** Origen del gasto: alta manual del usuario o detectado desde un correo. */
export type OrigenGasto = 'manual' | 'correo'

/**
 * Estado del gasto dentro de su ciclo de vida. `descartado` es un soft-delete
 * (ver migración `002_estado_gasto_descartado.sql`): preserva la fila para que
 * el índice único parcial `(usuario_id, gmail_message_id)` siga capturando
 * reimportes del mismo correo y no reaparezca en la bandeja.
 */
export type EstadoGasto = 'confirmado' | 'borrador' | 'revision_manual' | 'descartado'

/** Fila de la tabla `categorias`. */
export interface Categoria {
  id: string
  usuario_id: string
  nombre: string
  predefinida: boolean
  activa: boolean
  creado_en: string
  /**
   * Campo DERIVADO (no proviene de la tabla): calculado por
   * `useGastos.cargarCategorias` al cargar las categorías, para mostrar en el
   * círculo de la fila del historial (1 o 2 caracteres, sin colisión con
   * otras categorías que compartan la primera letra).
   */
  abreviatura: string
}

/**
 * Fila de la tabla `gastos`. `monto`/`moneda` son nullables (ver migración
 * `003_bandeja_borradores.sql`): solo pueden ser `null` mientras
 * `estado === 'revision_manual'` (borrador de correo con datos ambiguos o
 * incompletos); el check de base de datos lo garantiza.
 */
export interface Gasto {
  id: string
  usuario_id: string
  categoria_id: string
  /**
   * Banco/billetera de origen del gasto (migración `006`, obligatorio: ya
   * viene con backfill en producción). Catálogo compartido con el dominio
   * de Ingresos, ver `types/ingreso.ts` y `stores/ingresos.ts`.
   */
  banco_id: string
  monto: number | null
  moneda: Moneda | null
  fecha: string
  descripcion: string | null
  origen: OrigenGasto
  estado: EstadoGasto
  gmail_message_id: string | null
  gmail_fragmento: string | null
  creado_en: string
  actualizado_en: string
}

/** Payload de alta/edición de un gasto manual (subconjunto editable por el usuario). */
export interface GastoInput {
  monto: number
  moneda: Moneda
  categoria_id: string
  banco_id: string
  fecha: string
  descripcion: string | null
}

/**
 * Payload para confirmar un borrador de la bandeja (`useBandeja.confirmarBorrador`).
 * Todos los campos son opcionales porque un borrador `estado='borrador'` normal
 * ya trae `monto`/`moneda`/`categoria_id` completos desde el correo; solo un
 * borrador `estado='revision_manual'` necesita completarlos antes de confirmar.
 */
export interface BorradorInput {
  monto?: number
  moneda?: Moneda
  categoria_id?: string
  descripcion?: string | null
}

/**
 * Fila de la tabla `presupuestos` (Épica 6). `mes` sigue la convención de
 * guardarse como el día 1 del mes (ej. `2026-07-01`); junto con `categoria_id`
 * y `moneda` forman la clave `unique` de la tabla.
 */
export interface Presupuesto {
  id: string
  usuario_id: string
  categoria_id: string
  mes: string
  moneda: Moneda
  monto_limite: number
  creado_en: string
}

/** Payload de alta de un presupuesto mensual (subconjunto editable por el usuario). */
export interface PresupuestoInput {
  categoria_id: string
  moneda: Moneda
  monto_limite: number
}
