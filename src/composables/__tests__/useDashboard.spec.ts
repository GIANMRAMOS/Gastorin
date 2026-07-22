import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  cargarResumenPorMoneda,
  cargarGastoPorCategoria,
  cargarTendenciaMensual,
  cargarBalancePorMoneda,
  useDashboard,
} from '@/composables/useDashboard'
import { useGastosStore } from '@/stores/gastos'
import { supabase } from '@/lib/supabaseClient'
import { crearConstructorConsulta } from '@/lib/__mocks__/supabaseClient'
import type { Gasto } from '@/types/gasto'
import type { Ingreso } from '@/types/ingreso'

const fromMock = supabase.from as unknown as Mock

function ingresoDe(datos: Partial<Ingreso>): Ingreso {
  return {
    id: `i-${Math.random()}`,
    usuario_id: 'u1',
    banco_id: 'b1',
    fecha: '2026-07-10',
    moneda: 'PEN',
    importe: 100,
    concepto: 'Sueldo',
    created_at: '',
    ...datos,
  }
}

function gastoDe(datos: Partial<Gasto>): Gasto {
  return {
    id: `g-${Math.random()}`,
    usuario_id: 'u1',
    categoria_id: 'c1',
    banco_id: 'b1',
    monto: 100,
    moneda: 'PEN',
    fecha: '2026-07-10',
    descripcion: null,
    origen: 'manual',
    estado: 'confirmado',
    gmail_message_id: null,
    gmail_fragmento: null,
    creado_en: '',
    actualizado_en: '',
    ...datos,
  }
}

describe('useDashboard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('cargarResumenPorMoneda (HU-7.1)', () => {
    it('camino feliz: separa totales PEN/USD del mes y calcula variación al alza y a la baja', () => {
      const gastos = [
        // PEN: este mes 150, mes anterior 100 -> sube 50%.
        gastoDe({ moneda: 'PEN', fecha: '2026-07-05', monto: 100 }),
        gastoDe({ moneda: 'PEN', fecha: '2026-07-20', monto: 50 }),
        gastoDe({ moneda: 'PEN', fecha: '2026-06-15', monto: 100 }),
        // USD: este mes 40, mes anterior 100 -> baja 60%.
        gastoDe({ moneda: 'USD', fecha: '2026-07-05', monto: 40 }),
        gastoDe({ moneda: 'USD', fecha: '2026-06-15', monto: 100 }),
      ]

      const resumen = cargarResumenPorMoneda(gastos, '2026-07-01')

      expect(resumen.PEN.total).toBe(150)
      expect(resumen.PEN.variacionPct).toBeCloseTo(50, 5)
      expect(resumen.USD.total).toBe(40)
      expect(resumen.USD.variacionPct).toBeCloseTo(-60, 5)
    })

    it('borde: moneda sin gastos este mes -> total 0 y variacionPct null, sin NaN/error', () => {
      const gastos = [gastoDe({ moneda: 'PEN', fecha: '2026-07-05', monto: 100 })]

      const resumen = cargarResumenPorMoneda(gastos, '2026-07-01')

      expect(resumen.USD.total).toBe(0)
      expect(resumen.USD.variacionPct).toBeNull()
      expect(Number.isNaN(resumen.USD.variacionPct)).toBe(false)
    })

    it('borde: sin gasto el mes anterior -> variacionPct null (no división por cero)', () => {
      const gastos = [gastoDe({ moneda: 'PEN', fecha: '2026-07-05', monto: 100 })]

      const resumen = cargarResumenPorMoneda(gastos, '2026-07-01')

      expect(resumen.PEN.total).toBe(100)
      expect(resumen.PEN.variacionPct).toBeNull()
    })

    it('borde: mes anterior explícitamente en 0 (gasto de $0) tampoco calcula variación (evita división por cero)', () => {
      const gastos = [
        gastoDe({ moneda: 'PEN', fecha: '2026-07-05', monto: 100 }),
        gastoDe({ moneda: 'PEN', fecha: '2026-06-15', monto: 0 }),
      ]

      const resumen = cargarResumenPorMoneda(gastos, '2026-07-01')

      expect(resumen.PEN.variacionPct).toBeNull()
    })

    it('el cálculo del mes anterior respeta el cambio de año (enero -> diciembre del año previo)', () => {
      const gastos = [
        gastoDe({ moneda: 'PEN', fecha: '2026-01-05', monto: 200 }),
        gastoDe({ moneda: 'PEN', fecha: '2025-12-20', monto: 100 }),
      ]

      const resumen = cargarResumenPorMoneda(gastos, '2026-01-01')

      expect(resumen.PEN.total).toBe(200)
      expect(resumen.PEN.variacionPct).toBeCloseTo(100, 5)
    })
  })

  describe('cargarGastoPorCategoria (HU-7.2)', () => {
    it('camino feliz: agrupa por categoria_id, filtra por moneda+mes y ordena de mayor a menor', () => {
      const gastos = [
        gastoDe({ categoria_id: 'comida', moneda: 'PEN', fecha: '2026-07-05', monto: 50 }),
        gastoDe({ categoria_id: 'comida', moneda: 'PEN', fecha: '2026-07-10', monto: 30 }),
        gastoDe({ categoria_id: 'transporte', moneda: 'PEN', fecha: '2026-07-12', monto: 200 }),
        gastoDe({ categoria_id: 'ocio', moneda: 'PEN', fecha: '2026-07-15', monto: 10 }),
        // Ruido: otra moneda y otro mes, no deben colarse.
        gastoDe({ categoria_id: 'transporte', moneda: 'USD', fecha: '2026-07-12', monto: 9999 }),
        gastoDe({ categoria_id: 'comida', moneda: 'PEN', fecha: '2026-06-01', monto: 9999 }),
      ]

      const resultado = cargarGastoPorCategoria(gastos, '2026-07-01', 'PEN')

      expect(resultado).toEqual([
        { categoria_id: 'transporte', total: 200 },
        { categoria_id: 'comida', total: 80 },
        { categoria_id: 'ocio', total: 10 },
      ])
    })

    it('borde: sin gastos en la moneda seleccionada devuelve []', () => {
      const gastos = [gastoDe({ moneda: 'USD', fecha: '2026-07-05', monto: 50 })]

      expect(cargarGastoPorCategoria(gastos, '2026-07-01', 'PEN')).toEqual([])
    })
  })

  describe('cargarTendenciaMensual (HU-7.3)', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 6, 15)) // 15 jul 2026 (mes actual = 2026-07)
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('camino feliz: devuelve exactamente 6 meses en orden ascendente, mes actual último', () => {
      const gastos = [
        gastoDe({ moneda: 'PEN', fecha: '2026-07-05', monto: 100 }), // mes actual
        gastoDe({ moneda: 'PEN', fecha: '2026-02-10', monto: 50 }), // primer mes de la ventana
      ]

      const tendencia = cargarTendenciaMensual(gastos, 'PEN')

      expect(tendencia).toHaveLength(6)
      expect(tendencia.map((t) => t.mes)).toEqual([
        '2026-02',
        '2026-03',
        '2026-04',
        '2026-05',
        '2026-06',
        '2026-07',
      ])
      expect(tendencia[0].total).toBe(50)
      expect(tendencia[5].total).toBe(100)
    })

    it('borde: un mes intermedio sin gastos aparece con total 0, no se salta ni deja hueco', () => {
      const gastos = [
        gastoDe({ moneda: 'PEN', fecha: '2026-02-10', monto: 50 }),
        // Nada en marzo, abril, mayo, junio.
        gastoDe({ moneda: 'PEN', fecha: '2026-07-05', monto: 100 }),
      ]

      const tendencia = cargarTendenciaMensual(gastos, 'PEN')

      expect(tendencia).toHaveLength(6)
      const porMes = Object.fromEntries(tendencia.map((t) => [t.mes, t.total]))
      expect(porMes['2026-03']).toBe(0)
      expect(porMes['2026-04']).toBe(0)
      expect(porMes['2026-05']).toBe(0)
      expect(porMes['2026-06']).toBe(0)
    })

    it('ignora gastos de otra moneda y fuera de la ventana de 6 meses', () => {
      const gastos = [
        gastoDe({ moneda: 'USD', fecha: '2026-07-05', monto: 9999 }),
        gastoDe({ moneda: 'PEN', fecha: '2026-01-01', monto: 9999 }), // fuera de ventana (7 meses atrás)
      ]

      const tendencia = cargarTendenciaMensual(gastos, 'PEN')

      expect(tendencia.every((t) => t.total === 0)).toBe(true)
    })
  })

  describe('cargarBalancePorMoneda (HU-11.4)', () => {
    it('camino feliz: separa PEN/USD del mes y resta ingresos - gastos; ingresos > gastos da positivo', () => {
      const gastos = [
        gastoDe({ moneda: 'PEN', fecha: '2026-07-05', monto: 100 }),
        gastoDe({ moneda: 'USD', fecha: '2026-07-05', monto: 10 }),
      ]
      const ingresos = [
        ingresoDe({ moneda: 'PEN', fecha: '2026-07-10', importe: 500 }),
        ingresoDe({ moneda: 'USD', fecha: '2026-07-10', importe: 20 }),
      ]

      const balance = cargarBalancePorMoneda(gastos, ingresos, '2026-07-01')

      expect(balance.PEN).toEqual({ ingresos: 500, gastos: 100, balance: 400 })
      expect(balance.USD).toEqual({ ingresos: 20, gastos: 10, balance: 10 })
    })

    it('borde clave — nunca mezcla monedas: un ingreso grande en USD no contamina el balance de PEN', () => {
      const gastos = [gastoDe({ moneda: 'PEN', fecha: '2026-07-05', monto: 50 })]
      const ingresos = [
        ingresoDe({ moneda: 'PEN', fecha: '2026-07-05', importe: 30 }),
        ingresoDe({ moneda: 'USD', fecha: '2026-07-05', importe: 99999 }),
      ]

      const balance = cargarBalancePorMoneda(gastos, ingresos, '2026-07-01')

      expect(balance.PEN.ingresos).toBe(30)
      expect(balance.PEN.balance).toBe(-20)
      expect(balance.USD.gastos).toBe(0)
      expect(balance.USD.balance).toBe(99999)
    })

    it('borde: gastos > ingresos devuelve un balance negativo', () => {
      const gastos = [gastoDe({ moneda: 'PEN', fecha: '2026-07-05', monto: 400 })]
      const ingresos = [ingresoDe({ moneda: 'PEN', fecha: '2026-07-05', importe: 100 })]

      const balance = cargarBalancePorMoneda(gastos, ingresos, '2026-07-01')

      expect(balance.PEN.balance).toBe(-300)
    })

    it('borde: mes sin datos en ninguna moneda da balance 0 en ambas, sin error', () => {
      const balance = cargarBalancePorMoneda([], [], '2026-07-01')

      expect(balance.PEN).toEqual({ ingresos: 0, gastos: 0, balance: 0 })
      expect(balance.USD).toEqual({ ingresos: 0, gastos: 0, balance: 0 })
    })

    it('ignora gastos/ingresos de otros meses', () => {
      const gastos = [gastoDe({ moneda: 'PEN', fecha: '2026-06-05', monto: 999 })]
      const ingresos = [ingresoDe({ moneda: 'PEN', fecha: '2026-08-01', importe: 999 })]

      const balance = cargarBalancePorMoneda(gastos, ingresos, '2026-07-01')

      expect(balance.PEN).toEqual({ ingresos: 0, gastos: 0, balance: 0 })
    })
  })

  describe('cargarDatosDashboard', () => {
    it('camino feliz: llena filas, filtra estado=confirmado y fecha>=inicio de ventana, y devuelve true', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 6, 15))

      const filaCruda = gastoDe({ id: 'g1' })
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.order as Mock).mockResolvedValueOnce({ data: [filaCruda], error: null })

      const { filas, cargarDatosDashboard } = useDashboard()
      const exito = await cargarDatosDashboard()

      expect(exito).toBe(true)
      expect(fromMock).toHaveBeenCalledWith('gastos')
      expect(builder.eq).toHaveBeenCalledWith('estado', 'confirmado')
      expect(builder.gte).toHaveBeenCalledWith('fecha', '2026-02-01') // 5 meses atrás de julio = febrero
      expect(filas.value).toEqual([filaCruda])

      vi.useRealTimers()
    })

    it('borde: array vacío NO es un error', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.order as Mock).mockResolvedValueOnce({ data: [], error: null })

      const { filas, cargarDatosDashboard } = useDashboard()
      const store = useGastosStore()
      const exito = await cargarDatosDashboard()

      expect(exito).toBe(true)
      expect(store.error).toBeNull()
      expect(filas.value).toEqual([])
    })

    it('borde: error de Supabase deja mensaje en español y devuelve false', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.order as Mock).mockResolvedValueOnce({ data: null, error: { message: 'boom' } })

      const { cargarDatosDashboard } = useDashboard()
      const store = useGastosStore()
      const exito = await cargarDatosDashboard()

      expect(exito).toBe(false)
      expect(store.error).toBe('No se pudieron cargar los datos del dashboard.')
    })
  })
})
