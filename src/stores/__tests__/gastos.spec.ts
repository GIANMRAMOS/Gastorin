import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useGastosStore } from '@/stores/gastos'
import type { Categoria, Gasto, Presupuesto } from '@/types/gasto'

const categoriaFalsa: Categoria = {
  id: 'c1',
  usuario_id: 'u1',
  nombre: 'Comida',
  predefinida: true,
  activa: true,
  creado_en: '',
  abreviatura: 'C',
}

const gastoFalso: Gasto = {
  id: 'g1',
  usuario_id: 'u1',
  categoria_id: 'c1',
  monto: 10,
  moneda: 'PEN',
  fecha: '2026-07-01',
  descripcion: null,
  origen: 'manual',
  estado: 'confirmado',
  gmail_message_id: null,
  gmail_fragmento: null,
  creado_en: '2026-07-01T00:00:00Z',
  actualizado_en: '2026-07-01T00:00:00Z',
}

const presupuestoFalso: Presupuesto = {
  id: 'p1',
  usuario_id: 'u1',
  categoria_id: 'c1',
  mes: '2026-07-01',
  moneda: 'PEN',
  monto_limite: 500,
  creado_en: '2026-07-01T00:00:00Z',
}

/**
 * Pruebas del store `gastos` en aislamiento (sin pasar por `useGastos`/Supabase).
 * `useGastos.spec.ts` ya ejercita el store indirectamente; aquí se cubren las
 * transiciones de estado propias del store.
 */
describe('store gastos', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('estado inicial: sin gastos, sin categorías, sin presupuestos, sin error, no cargando', () => {
    const store = useGastosStore()

    expect(store.gastos).toEqual([])
    expect(store.categorias).toEqual([])
    expect(store.presupuestos).toEqual([])
    expect(store.error).toBeNull()
    expect(store.cargando).toBe(false)
  })

  it('camino feliz: agregarGasto inserta el nuevo gasto al principio de la lista', () => {
    const store = useGastosStore()
    const otroGasto: Gasto = { ...gastoFalso, id: 'g0' }
    store.agregarGasto(otroGasto)
    store.agregarGasto(gastoFalso)

    expect(store.gastos).toEqual([gastoFalso, otroGasto])
  })

  it('camino feliz: actualizarGasto reemplaza el gasto existente por id', () => {
    const store = useGastosStore()
    store.agregarGasto(gastoFalso)
    const gastoModificado: Gasto = { ...gastoFalso, monto: 999, descripcion: 'editado' }

    store.actualizarGasto(gastoModificado)

    expect(store.gastos).toEqual([gastoModificado])
  })

  it('borde: actualizarGasto con un id inexistente no modifica la lista', () => {
    const store = useGastosStore()
    store.agregarGasto(gastoFalso)
    const gastoInexistente: Gasto = { ...gastoFalso, id: 'no-existe', monto: 1 }

    store.actualizarGasto(gastoInexistente)

    expect(store.gastos).toEqual([gastoFalso])
  })

  it('camino feliz: quitarGasto elimina el gasto por id', () => {
    const store = useGastosStore()
    store.agregarGasto(gastoFalso)

    store.quitarGasto('g1')

    expect(store.gastos).toEqual([])
  })

  it('borde: quitarGasto con id inexistente no lanza error ni modifica la lista', () => {
    const store = useGastosStore()
    store.agregarGasto(gastoFalso)

    store.quitarGasto('no-existe')

    expect(store.gastos).toEqual([gastoFalso])
  })

  it('camino feliz: agregarCategoria añade la nueva categoría al final de la lista', () => {
    const store = useGastosStore()
    const otraCategoria: Categoria = { ...categoriaFalsa, id: 'c2', nombre: 'Ocio', abreviatura: 'O' }
    store.establecerCategorias([categoriaFalsa])

    store.agregarCategoria(otraCategoria)

    expect(store.categorias).toEqual([categoriaFalsa, otraCategoria])
  })

  it('camino feliz: actualizarCategoria reemplaza la categoría existente por id', () => {
    const store = useGastosStore()
    store.establecerCategorias([categoriaFalsa])
    const categoriaModificada: Categoria = { ...categoriaFalsa, nombre: 'Comida y bebida' }

    store.actualizarCategoria(categoriaModificada)

    expect(store.categorias).toEqual([categoriaModificada])
  })

  it('borde: actualizarCategoria con un id inexistente no modifica la lista', () => {
    const store = useGastosStore()
    store.establecerCategorias([categoriaFalsa])
    const categoriaInexistente: Categoria = { ...categoriaFalsa, id: 'no-existe', nombre: 'Otra' }

    store.actualizarCategoria(categoriaInexistente)

    expect(store.categorias).toEqual([categoriaFalsa])
  })

  it('camino feliz: establecerPresupuestos reemplaza la lista completa', () => {
    const store = useGastosStore()

    store.establecerPresupuestos([presupuestoFalso])

    expect(store.presupuestos).toEqual([presupuestoFalso])
  })

  it('camino feliz: agregarPresupuesto añade el nuevo presupuesto al final de la lista', () => {
    const store = useGastosStore()
    const otroPresupuesto: Presupuesto = { ...presupuestoFalso, id: 'p2', categoria_id: 'c2' }
    store.establecerPresupuestos([presupuestoFalso])

    store.agregarPresupuesto(otroPresupuesto)

    expect(store.presupuestos).toEqual([presupuestoFalso, otroPresupuesto])
  })

  it('camino feliz: actualizarPresupuesto reemplaza el presupuesto existente por id', () => {
    const store = useGastosStore()
    store.establecerPresupuestos([presupuestoFalso])
    const presupuestoModificado: Presupuesto = { ...presupuestoFalso, monto_limite: 999 }

    store.actualizarPresupuesto(presupuestoModificado)

    expect(store.presupuestos).toEqual([presupuestoModificado])
  })

  it('borde: actualizarPresupuesto con un id inexistente no modifica la lista', () => {
    const store = useGastosStore()
    store.establecerPresupuestos([presupuestoFalso])
    const presupuestoInexistente: Presupuesto = { ...presupuestoFalso, id: 'no-existe', monto_limite: 1 }

    store.actualizarPresupuesto(presupuestoInexistente)

    expect(store.presupuestos).toEqual([presupuestoFalso])
  })

  it('camino feliz: quitarPresupuesto elimina el presupuesto por id', () => {
    const store = useGastosStore()
    store.establecerPresupuestos([presupuestoFalso])

    store.quitarPresupuesto('p1')

    expect(store.presupuestos).toEqual([])
  })

  it('borde: quitarPresupuesto con id inexistente no lanza error ni modifica la lista', () => {
    const store = useGastosStore()
    store.establecerPresupuestos([presupuestoFalso])

    store.quitarPresupuesto('no-existe')

    expect(store.presupuestos).toEqual([presupuestoFalso])
  })
})
