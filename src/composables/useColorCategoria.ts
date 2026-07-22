/**
 * Helper compartido para derivar el color de una categoría a partir de su
 * nombre (decisión de arquitectura: el color NO se persiste en la tabla
 * `categorias`, es puramente presentacional). Centraliza la lógica que antes
 * estaba duplicada en `HistorialView.vue` y `FormularioGasto.vue`.
 *
 * - Predefinidas (Alimentación/Transporte/Hogar/Ocio/Salud): mapa curado fijo.
 * - Personalizadas (cualquier otro nombre): color elegido por hash estable del
 *   nombre normalizado (sin acentos, minúsculas) sobre una paleta ampliada, de
 *   forma que el mismo nombre siempre resuelva al mismo color en toda la app.
 */

/** Mapa curado de color por nombre de categoría predefinida (minúsculas, sin acentos). */
const COLOR_POR_CATEGORIA_PREDEFINIDA: Record<string, string> = {
  alimentacion: 'var(--color-categoria-alimentacion)',
  transporte: 'var(--color-categoria-transporte)',
  hogar: 'var(--color-categoria-hogar)',
  ocio: 'var(--color-categoria-ocio)',
  salud: 'var(--color-categoria-salud)',
}

/** Paleta ampliada para categorías personalizadas, elegida por hash del nombre. */
const PALETA_CATEGORIA_PERSONALIZADA = [
  'var(--color-categoria-personalizada-1)',
  'var(--color-categoria-personalizada-2)',
  'var(--color-categoria-personalizada-3)',
  'var(--color-categoria-personalizada-4)',
  'var(--color-categoria-personalizada-5)',
]

/** Color de respaldo cuando no hay ningún nombre que resolver. */
const COLOR_CATEGORIA_OTROS = 'var(--color-categoria-otros)'

/** Quita acentos y pasa a minúsculas para comparar/hashear nombres de forma estable. */
function normalizarNombre(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/** Hash simple y estable (djb2) de una cadena, usado para elegir color de la paleta. */
function hashEstable(texto: string): number {
  let hash = 5381
  for (let i = 0; i < texto.length; i++) {
    hash = (hash * 33) ^ texto.charCodeAt(i)
  }
  return Math.abs(hash)
}

/**
 * Devuelve el color (variable CSS) asociado a una categoría según su nombre.
 * Mismo nombre → mismo color siempre, en todas las pantallas.
 */
export function useColorCategoria() {
  function colorCategoria(nombre: string | null | undefined): string {
    if (!nombre) return COLOR_CATEGORIA_OTROS
    const nombreNormalizado = normalizarNombre(nombre)
    const colorPredefinido = COLOR_POR_CATEGORIA_PREDEFINIDA[nombreNormalizado]
    if (colorPredefinido) return colorPredefinido
    const indice = hashEstable(nombreNormalizado) % PALETA_CATEGORIA_PERSONALIZADA.length
    return PALETA_CATEGORIA_PERSONALIZADA[indice]
  }

  return { colorCategoria }
}
