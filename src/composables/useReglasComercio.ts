import { useAuthStore } from '@/stores/auth'
import { useGastosStore } from '@/stores/gastos'
import { supabase } from '@/lib/supabaseClient'
import type { ReglaComercio } from '@/types/reglaComercio'

/**
 * Composable que encapsula las llamadas a Supabase para el dominio de
 * "reglas de comercio" (Épica 14, HU-14.1, extendido en la migración 012 con
 * banco): recuerda con qué categoría y banco se confirmó por última vez un
 * comercio, para sugerirlos la próxima vez.
 * Sub-dominio del mismo `useGastosStore`, mismo precedente que
 * `useBandeja`/`useCategorias`. No tiene lista propia en el store: la
 * sugerencia es transitoria por selección y vive en estado local del panel
 * que la consume (`PanelDetalleBorrador`).
 *
 * A diferencia del resto de composables del proyecto, NINGUNA acción de aquí
 * escribe en `store.error`: toda la Épica 14 es una comodidad (sugerir/
 * recordar una categoría), nunca algo crítico, y el gasto que la dispara
 * (`confirmarBorrador`) ya se confirmó con éxito antes de llegar aquí. Un
 * fallo silencioso simplemente degrada a "sin sugerencia"/"no se guardó la
 * regla", sin disparar el banner de error global de la Bandeja (que
 * confundiría al usuario haciéndole pensar que su gasto no se confirmó).
 */
export function useReglasComercio() {
  const store = useGastosStore()
  const authStore = useAuthStore()

  /**
   * Normaliza el nombre de un comercio (trim + minúsculas) para que "Primax
   * Surco" y "PRIMAX SURCO " cuenten como la misma regla, igual que la
   * migración 010.
   */
  function normalizarComercio(nombre: string): string {
    return nombre.trim().toLowerCase()
  }

  /**
   * Escapa los caracteres especiales de LIKE/ILIKE (`%` = cualquier
   * secuencia, `_` = cualquier carácter, y el propio escape `\`) para que un
   * comercio con alguno de esos caracteres literales en su nombre (ej. una
   * promoción "Farmacia 100%_Salud") se compare como texto exacto en
   * `contarCargosComercio`, no como un patrón con comodines (QA independiente,
   * Fase 3 "Caudal").
   */
  function escaparPatronLike(texto: string): string {
    return texto.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
  }

  /**
   * Busca si el usuario ya tiene una regla guardada para este comercio.
   * `null` significa "sin regla todavía": es el caso normal la primera vez
   * que aparece un comercio, NO es un error.
   */
  async function buscarReglaPorComercio(comercio: string): Promise<ReglaComercio | null> {
    store.establecerCargando(true)
    try {
      const { data, error } = await supabase
        .from('reglas_comercio')
        .select()
        .eq('comercio', normalizarComercio(comercio))
        .maybeSingle()
      // Un error aquí (ej. de red) degrada a "sin sugerencia", igual que "sin
      // regla todavía": no hay nada crítico que avisar al usuario.
      if (error) return null
      return (data as ReglaComercio | null) ?? null
    } finally {
      store.establecerCargando(false)
    }
  }

  /**
   * Cuenta cuántos cargos ya confirmados (provenientes de correo) existen
   * para este comercio, para el banner "Categoría sugerida por N cargos
   * anteriores" de HU-14.1. Es una comodidad puramente informativa: si el
   * count falla por cualquier motivo, NO se marca como error del store ni
   * bloquea la selección del borrador, simplemente se devuelve `0`.
   */
  async function contarCargosComercio(comercio: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('gastos')
        .select('*', { count: 'exact', head: true })
        .eq('estado', 'confirmado')
        .eq('origen', 'correo')
        .ilike('descripcion', escaparPatronLike(normalizarComercio(comercio)))
      if (error) return 0
      return count ?? 0
    } catch {
      return 0
    }
  }

  /**
   * Guarda (crea o actualiza) la regla de categoría y banco para un comercio:
   * la próxima vez que aparezca el mismo comercio, se sugieren estos valores.
   * `onConflict` sobre la PK compuesta `(usuario_id, comercio)` de la
   * migración 010. El upsert siempre refleja la última confirmación: si se
   * confirmara sin banco elegido, la regla quedaría con `banco_id = null` (en
   * la práctica no ocurre, un borrador siempre trae `banco_id` no nulo, ver
   * `types/gasto.ts`).
   */
  async function guardarRegla(
    comercio: string,
    categoriaId: string,
    bancoId?: string | null,
  ): Promise<boolean> {
    store.establecerCargando(true)
    try {
      const usuarioId = authStore.usuario?.id
      // Sin sesión no hay `usuario_id` con qué guardar la regla: se ignora en
      // silencio (comodidad, no bloquea nada; ver comentario de la clase).
      if (!usuarioId) return false

      const { error } = await supabase
        .from('reglas_comercio')
        .upsert(
          {
            usuario_id: usuarioId,
            comercio: normalizarComercio(comercio),
            categoria_id: categoriaId,
            // `|| null` (no `?? null`), deliberado: convierte también `''` a
            // `null` para no mandarle a Postgres un uuid vacío (22P02).
            banco_id: bancoId || null,
          },
          { onConflict: 'usuario_id,comercio' },
        )
      return !error
    } finally {
      store.establecerCargando(false)
    }
  }

  return {
    normalizarComercio,
    buscarReglaPorComercio,
    contarCargosComercio,
    guardarRegla,
  }
}
