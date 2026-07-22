import { describe, expect, it } from 'vitest'
import { calcularAbreviaturas } from '@/composables/useCategorias'
import type { Categoria } from '@/types/gasto'

/**
 * Pruebas del helper puro que calcula `categoria.abreviatura` a partir del
 * nombre, una sola vez al cargar categorías (ver `useGastos.cargarCategorias`).
 */
function crearCategoria(nombre: string, id = nombre): Categoria {
  return {
    id,
    usuario_id: 'u1',
    nombre,
    predefinida: true,
    activa: true,
    creado_en: '',
    abreviatura: '',
  }
}

describe('calcularAbreviaturas', () => {
  it('camino feliz: primeras letras distintas → abreviatura de 1 carácter', () => {
    const categorias = [crearCategoria('Transporte'), crearCategoria('Ocio'), crearCategoria('Salud')]

    const resultado = calcularAbreviaturas(categorias)

    expect(resultado.map((c) => c.abreviatura)).toEqual(['T', 'O', 'S'])
  })

  it('borde: dos categorías comparten la primera letra → ambas usan 2 caracteres', () => {
    const categorias = [crearCategoria('Casa'), crearCategoria('Café'), crearCategoria('Ocio')]

    const resultado = calcularAbreviaturas(categorias)

    expect(resultado.find((c) => c.nombre === 'Casa')?.abreviatura).toBe('CA')
    expect(resultado.find((c) => c.nombre === 'Café')?.abreviatura).toBe('CA')
    expect(resultado.find((c) => c.nombre === 'Ocio')?.abreviatura).toBe('O')
  })

  it('borde: lista vacía devuelve una lista vacía', () => {
    expect(calcularAbreviaturas([])).toEqual([])
  })

  it('borde: una sola categoría usa 1 carácter (no hay colisión posible)', () => {
    const resultado = calcularAbreviaturas([crearCategoria('Alimentación')])

    expect(resultado[0].abreviatura).toBe('A')
  })
})
