import { describe, expect, it } from 'vitest'
import { useColorCategoria } from '@/composables/useColorCategoria'

/**
 * `useColorCategoria` deriva el color de una categoría a partir de su
 * nombre (decisión de arquitectura: NO se persiste `color` en la tabla).
 * Estas pruebas verifican que la derivación sea determinística (mismo
 * nombre -> mismo color, siempre, entre distintas instancias/renders) y que
 * cubra los casos de predefinidas, personalizadas y variantes de
 * mayúsculas/acentos/espacios.
 */
describe('useColorCategoria', () => {
  it('camino feliz: cada categoría predefinida resuelve a su color curado', () => {
    const { colorCategoria } = useColorCategoria()

    expect(colorCategoria('Alimentación')).toBe('var(--color-categoria-alimentacion)')
    expect(colorCategoria('Transporte')).toBe('var(--color-categoria-transporte)')
    expect(colorCategoria('Hogar')).toBe('var(--color-categoria-hogar)')
    expect(colorCategoria('Ocio')).toBe('var(--color-categoria-ocio)')
    expect(colorCategoria('Salud')).toBe('var(--color-categoria-salud)')
  })

  it('determinismo: la misma categoría personalizada resuelve siempre al mismo color entre distintas instancias del composable (simula "distintos renders")', () => {
    // Cada llamada a useColorCategoria() simula una nueva instancia (otro
    // componente/render); no debe haber estado aleatorio ni memoria interna.
    const colores = Array.from({ length: 5 }, () => useColorCategoria().colorCategoria('Mascotas'))

    expect(new Set(colores).size).toBe(1)
  })

  it('determinismo: no cambia entre múltiples llamadas consecutivas de la MISMA instancia', () => {
    const { colorCategoria } = useColorCategoria()

    const primero = colorCategoria('Suscripciones')
    const segundo = colorCategoria('Suscripciones')
    const tercero = colorCategoria('Suscripciones')

    expect(primero).toBe(segundo)
    expect(segundo).toBe(tercero)
  })

  it('normaliza mayúsculas, espacios y acentos: variantes del mismo nombre resuelven al mismo color', () => {
    const { colorCategoria } = useColorCategoria()

    const base = colorCategoria('Alimentación')
    expect(colorCategoria('alimentación')).toBe(base)
    expect(colorCategoria('ALIMENTACION')).toBe(base)
    expect(colorCategoria('  Alimentación  ')).toBe(base)
  })

  it('dos nombres personalizados distintos pueden (pero no necesariamente deben) resolver a colores distintos, y cada uno es estable con su propio valor', () => {
    const { colorCategoria } = useColorCategoria()

    const colorMascotas = colorCategoria('Mascotas')
    const colorGimnasio = colorCategoria('Gimnasio')

    // No se afirma que sean distintos (podrían colisionar en la paleta), pero
    // cada nombre debe mantener su propio color estable de forma consistente.
    expect(colorCategoria('Mascotas')).toBe(colorMascotas)
    expect(colorCategoria('Gimnasio')).toBe(colorGimnasio)
  })

  it('borde: nombre vacío, null o undefined cae al color de respaldo "Otros"', () => {
    const { colorCategoria } = useColorCategoria()

    expect(colorCategoria(null)).toBe('var(--color-categoria-otros)')
    expect(colorCategoria(undefined)).toBe('var(--color-categoria-otros)')
    expect(colorCategoria('')).toBe('var(--color-categoria-otros)')
  })
})
