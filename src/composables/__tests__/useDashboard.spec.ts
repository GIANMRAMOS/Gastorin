import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  cargarResumenPorMoneda,
  cargarGastoPorCategoria,
  cargarTendenciaMensual,
  cargarTendenciaDiaria,
  cargarBalancePorMoneda,
  calcularSaldoNetoPorCuenta,
  combinarUltimosMovimientos,
  combinarMovimientosDelMes,
  proyeccionCierreMes,
  useDashboard,
} from '@/composables/useDashboard'
import { useGastosStore } from '@/stores/gastos'
import { supabase } from '@/lib/supabaseClient'
import { crearConstructorConsulta } from '@/lib/__mocks__/supabaseClient'
import type { Gasto } from '@/types/gasto'
import type { Banco, Ingreso } from '@/types/ingreso'
import type { AjusteSaldoCuenta } from '@/types/ajusteSaldo'

function bancoDe(datos: Partial<Banco>): Banco {
  return {
    id: `b-${Math.random()}`,
    usuario_id: 'u1',
    nombre: 'BCP Debito',
    created_at: '',
    ...datos,
  }
}

const fromMock = supabase.from as unknown as Mock

function ingresoDe(datos: Partial<Ingreso>): Ingreso {
  return {
    id: `i-${Math.random()}`,
    usuario_id: 'u1',
    banco_id: 'b1',
    categoria_id: 'ci1',
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

  describe('cargarTendenciaDiaria (Cambio 2 — tendencia diaria del dashboard)', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 6, 15)) // 15 jul 2026
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('camino feliz: devuelve exactamente 30 entradas en orden ascendente, la última es hoy, sumando por día en la moneda dada', () => {
      const gastos = [
        gastoDe({ moneda: 'PEN', fecha: '2026-07-15', monto: 100 }), // hoy
        gastoDe({ moneda: 'PEN', fecha: '2026-07-15', monto: 50 }), // hoy, se suma
        gastoDe({ moneda: 'PEN', fecha: '2026-06-16', monto: 20 }), // primer día de la ventana (30 días atrás)
      ]

      const tendencia = cargarTendenciaDiaria(gastos, 'PEN')

      expect(tendencia).toHaveLength(30)
      expect(tendencia[0].dia).toBe('2026-06-16')
      expect(tendencia.at(-1)?.dia).toBe('2026-07-15')
      expect(tendencia[0].total).toBe(20)
      expect(tendencia.at(-1)?.total).toBe(150)
    })

    it('borde: un día intermedio sin gasto aparece con total 0, no se salta ni deja hueco', () => {
      const gastos = [
        gastoDe({ moneda: 'PEN', fecha: '2026-06-16', monto: 20 }),
        gastoDe({ moneda: 'PEN', fecha: '2026-07-15', monto: 100 }),
      ]

      const tendencia = cargarTendenciaDiaria(gastos, 'PEN')
      const diaIntermedio = tendencia.find((t) => t.dia === '2026-07-01')

      expect(diaIntermedio).toEqual({ dia: '2026-07-01', total: 0 })
    })

    it('borde: ignora gastos de otra moneda', () => {
      const gastos = [gastoDe({ moneda: 'USD', fecha: '2026-07-15', monto: 9999 })]

      const tendencia = cargarTendenciaDiaria(gastos, 'PEN')

      expect(tendencia.every((t) => t.total === 0)).toBe(true)
    })

    it('borde: un gasto fuera de la ventana (31+ días atrás) no entra; uno de hoy sí', () => {
      const gastos = [
        gastoDe({ moneda: 'PEN', fecha: '2026-06-10', monto: 9999 }), // 35 días atrás, fuera de ventana
        gastoDe({ moneda: 'PEN', fecha: '2026-07-15', monto: 100 }), // hoy
      ]

      const tendencia = cargarTendenciaDiaria(gastos, 'PEN')

      expect(tendencia.some((t) => t.dia === '2026-06-10')).toBe(false)
      expect(tendencia.at(-1)?.total).toBe(100)
    })

    it('borde: el parámetro `dias` cambia el tamaño de la ventana', () => {
      const tendencia = cargarTendenciaDiaria([], 'PEN', 7)

      expect(tendencia).toHaveLength(7)
      expect(tendencia.at(-1)?.dia).toBe('2026-07-15')
    })

    it('borde: sin gastos, devuelve 30 entradas todas con total 0', () => {
      const tendencia = cargarTendenciaDiaria([], 'PEN')

      expect(tendencia).toHaveLength(30)
      expect(tendencia.every((t) => t.total === 0)).toBe(true)
    })

    it('cruce de mes/año: con hoy = 2026-01-05, la ventana incluye días de diciembre 2025 con el YYYY-MM-DD correcto', () => {
      vi.setSystemTime(new Date(2026, 0, 5)) // 5 ene 2026

      const gastos = [gastoDe({ moneda: 'PEN', fecha: '2025-12-20', monto: 30 })]
      const tendencia = cargarTendenciaDiaria(gastos, 'PEN')

      expect(tendencia).toHaveLength(30)
      expect(tendencia[0].dia).toBe('2025-12-07')
      expect(tendencia.at(-1)?.dia).toBe('2026-01-05')
      const diaConGasto = tendencia.find((t) => t.dia === '2025-12-20')
      expect(diaConGasto?.total).toBe(30)
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

  describe('calcularSaldoNetoPorCuenta (Dashboard, ajuste de alcance: solo BCP e IBK)', () => {
    it('camino feliz: saldo = ingresos - gastos por banco, en PEN', () => {
      const bancos = [bancoDe({ id: 'b1', nombre: 'BCP' }), bancoDe({ id: 'b2', nombre: 'IBK' })]
      const gastos = [
        gastoDe({ banco_id: 'b1', moneda: 'PEN', monto: 200 }),
        gastoDe({ banco_id: 'b2', moneda: 'PEN', monto: 50 }),
      ]
      const ingresos = [
        ingresoDe({ banco_id: 'b1', moneda: 'PEN', importe: 500 }),
        ingresoDe({ banco_id: 'b2', moneda: 'PEN', importe: 100 }),
      ]

      const saldos = calcularSaldoNetoPorCuenta(bancos, gastos, ingresos)

      expect(saldos).toEqual([
        { bancoId: 'b1', nombreBanco: 'BCP', saldoPen: 300, saldoUsd: null },
        { bancoId: 'b2', nombreBanco: 'IBK', saldoPen: 50, saldoUsd: null },
      ])
    })

    it('borde clave: solo se ofrecen cuentas cuyo nombre empiece con "BCP"/"IBK" (case-insensitive); cualquier otro banco se ignora', () => {
      const bancos = [
        bancoDe({ id: 'b1', nombre: 'bcp ahorros' }),
        bancoDe({ id: 'b2', nombre: 'IBK' }),
        bancoDe({ id: 'b3', nombre: 'No especificado' }),
        bancoDe({ id: 'b4', nombre: 'Interbank Otro' }),
      ]

      const saldos = calcularSaldoNetoPorCuenta(bancos, [], [])

      expect(saldos.map((s) => s.bancoId)).toEqual(['b1', 'b2'])
    })

    it('cada cuenta SIEMPRE aparece aunque su saldo sea 0 (a diferencia de saldosPorBanco)', () => {
      const bancos = [bancoDe({ id: 'b1', nombre: 'BCP' })]

      const saldos = calcularSaldoNetoPorCuenta(bancos, [], [])

      expect(saldos).toEqual([{ bancoId: 'b1', nombreBanco: 'BCP', saldoPen: 0, saldoUsd: null }])
    })

    it('"nombreBanco" es el nombre real del banco tal cual (ya no hay etiqueta de despliegue: bancos.nombre está consolidado a "BCP"/"IBK" en la BD)', () => {
      const bancos = [bancoDe({ id: 'b1', nombre: 'BCP' }), bancoDe({ id: 'b2', nombre: 'IBK' })]

      const saldos = calcularSaldoNetoPorCuenta(bancos, [], [])

      expect(saldos.find((s) => s.bancoId === 'b1')?.nombreBanco).toBe('BCP')
      expect(saldos.find((s) => s.bancoId === 'b2')?.nombreBanco).toBe('IBK')
    })

    it('saldoUsd es `null` si el banco nunca tuvo movimiento en USD (no se muestra badge vacío)', () => {
      const bancos = [bancoDe({ id: 'b1', nombre: 'BCP Debito' })]
      const gastos = [gastoDe({ banco_id: 'b1', moneda: 'PEN', monto: 50 })]

      const saldos = calcularSaldoNetoPorCuenta(bancos, gastos, [])

      expect(saldos[0].saldoUsd).toBeNull()
    })

    it('saldoUsd se calcula por separado (nunca se mezcla con PEN) cuando el banco sí tuvo movimiento en USD', () => {
      const bancos = [bancoDe({ id: 'b1', nombre: 'BCP Debito' })]
      const gastos = [gastoDe({ banco_id: 'b1', moneda: 'USD', monto: 10 })]
      const ingresos = [
        ingresoDe({ banco_id: 'b1', moneda: 'PEN', importe: 1000 }),
        ingresoDe({ banco_id: 'b1', moneda: 'USD', importe: 30 }),
      ]

      const saldos = calcularSaldoNetoPorCuenta(bancos, gastos, ingresos)

      expect(saldos[0].saldoPen).toBe(1000)
      expect(saldos[0].saldoUsd).toBe(20)
    })

    it('sin bancos BCP/IBK creados, devuelve un array vacío (no inventa cuentas)', () => {
      const saldos = calcularSaldoNetoPorCuenta([bancoDe({ id: 'b1', nombre: 'Otro banco' })], [], [])

      expect(saldos).toEqual([])
    })

    describe('con ajustes de saldo (migración 011, "setear saldo de cuenta")', () => {
      function ajusteDe(datos: Partial<AjusteSaldoCuenta>): AjusteSaldoCuenta {
        return {
          id: `aj-${Math.random()}`,
          usuario_id: 'u1',
          banco_id: 'b1',
          moneda: 'PEN',
          saldo: 1000,
          fecha: '2026-07-01',
          creado_en: '2026-07-01T10:00:00Z',
          ...datos,
        }
      }

      it('camino feliz: saldo = ajuste.saldo + ingresos - gastos POSTERIORES a la fecha del ajuste', () => {
        const bancos = [bancoDe({ id: 'b1', nombre: 'BCP' })]
        const gastos = [gastoDe({ banco_id: 'b1', moneda: 'PEN', monto: 100, fecha: '2026-07-10' })]
        const ingresos = [ingresoDe({ banco_id: 'b1', moneda: 'PEN', importe: 200, fecha: '2026-07-15' })]
        const ajustes = [ajusteDe({ saldo: 1000, fecha: '2026-07-01' })]

        const saldos = calcularSaldoNetoPorCuenta(bancos, gastos, ingresos, ajustes)

        expect(saldos[0].saldoPen).toBe(1100) // 1000 + 200 - 100
      })

      it('borde clave: movimientos ANTERIORES o en la MISMA fecha del ajuste NO se restan/suman (ya están reflejados en el saldo seteado)', () => {
        const bancos = [bancoDe({ id: 'b1', nombre: 'BCP' })]
        const gastos = [gastoDe({ banco_id: 'b1', moneda: 'PEN', monto: 9999, fecha: '2026-07-01' })]
        const ingresos = [ingresoDe({ banco_id: 'b1', moneda: 'PEN', importe: 9999, fecha: '2026-06-15' })]
        const ajustes = [ajusteDe({ saldo: 1000, fecha: '2026-07-01' })]

        const saldos = calcularSaldoNetoPorCuenta(bancos, gastos, ingresos, ajustes)

        expect(saldos[0].saldoPen).toBe(1000)
      })

      it('"el último ajuste" gobierna: con dos ajustes de la misma cuenta, se usa el de fecha más reciente, no el primero', () => {
        const bancos = [bancoDe({ id: 'b1', nombre: 'BCP' })]
        const gastos = [gastoDe({ banco_id: 'b1', moneda: 'PEN', monto: 100, fecha: '2026-07-20' })]
        const ajustes = [
          ajusteDe({ id: 'viejo', saldo: 1000, fecha: '2026-07-01' }),
          ajusteDe({ id: 'nuevo', saldo: 5000, fecha: '2026-07-15' }),
        ]

        const saldos = calcularSaldoNetoPorCuenta(bancos, [], [], ajustes)
        const saldosConGasto = calcularSaldoNetoPorCuenta(bancos, gastos, [], ajustes)

        expect(saldos[0].saldoPen).toBe(5000) // el ajuste "nuevo", no "viejo"
        expect(saldosConGasto[0].saldoPen).toBe(4900) // 5000 - 100 (después del 15, no del 1)
      })

      it('sin ningún ajuste para una cuenta, se comporta como antes (suma desde el historial completo)', () => {
        const bancos = [bancoDe({ id: 'b1', nombre: 'BCP' })]
        const ingresos = [ingresoDe({ banco_id: 'b1', moneda: 'PEN', importe: 500, fecha: '2020-01-01' })]

        const saldos = calcularSaldoNetoPorCuenta(bancos, [], ingresos, [])

        expect(saldos[0].saldoPen).toBe(500)
      })

      it('borde: un ajuste en USD hace que saldoUsd deje de ser `null` aunque no haya movimientos en esa moneda', () => {
        const bancos = [bancoDe({ id: 'b1', nombre: 'BCP' })]
        const ajustes = [ajusteDe({ moneda: 'USD', saldo: 200, fecha: '2026-07-01' })]

        const saldos = calcularSaldoNetoPorCuenta(bancos, [], [], ajustes)

        expect(saldos[0].saldoUsd).toBe(200)
      })

      it('los ajustes de PEN y USD de la misma cuenta se resuelven de forma independiente, nunca se mezclan', () => {
        const bancos = [bancoDe({ id: 'b1', nombre: 'BCP' })]
        const ajustes = [
          ajusteDe({ moneda: 'PEN', saldo: 1000, fecha: '2026-07-01' }),
          ajusteDe({ moneda: 'USD', saldo: 50, fecha: '2026-07-01' }),
        ]

        const saldos = calcularSaldoNetoPorCuenta(bancos, [], [], ajustes)

        expect(saldos[0].saldoPen).toBe(1000)
        expect(saldos[0].saldoUsd).toBe(50)
      })
    })
  })

  describe('combinarUltimosMovimientos', () => {
    it('camino feliz: mezcla gastos e ingresos por fecha desc, sin importar el array de origen', () => {
      const gastos = [gastoDe({ id: 'g1', fecha: '2026-07-18' })]
      const ingresos = [ingresoDe({ id: 'i1', fecha: '2026-07-20' }), ingresoDe({ id: 'i2', fecha: '2026-07-15' })]

      const movimientos = combinarUltimosMovimientos(gastos, ingresos)

      expect(movimientos.map((m) => m.id)).toEqual(['i1', 'g1', 'i2'])
    })

    it('borde: empate de fecha entre gasto e ingreso -> ambos presentes, orden determinista por id', () => {
      const gastos = [gastoDe({ id: 'g-empate', fecha: '2026-07-20' })]
      const ingresos = [ingresoDe({ id: 'i-empate', fecha: '2026-07-20' })]

      const movimientos = combinarUltimosMovimientos(gastos, ingresos)

      expect(movimientos).toHaveLength(2)
      // Desempate determinista: mayor id (localeCompare) primero.
      expect(movimientos.map((m) => m.id)).toEqual(['i-empate', 'g-empate'])

      // Reproducible: mismo input, mismo resultado.
      expect(combinarUltimosMovimientos(gastos, ingresos).map((m) => m.id)).toEqual(['i-empate', 'g-empate'])
    })

    it('límite: con más de 5 movimientos en total, devuelve exactamente los 5 más recientes', () => {
      const gastos = [
        gastoDe({ id: 'g1', fecha: '2026-07-01' }),
        gastoDe({ id: 'g2', fecha: '2026-07-02' }),
        gastoDe({ id: 'g3', fecha: '2026-07-03' }),
      ]
      const ingresos = [
        ingresoDe({ id: 'i1', fecha: '2026-07-04' }),
        ingresoDe({ id: 'i2', fecha: '2026-07-05' }),
        ingresoDe({ id: 'i3', fecha: '2026-07-06' }),
      ]

      const movimientos = combinarUltimosMovimientos(gastos, ingresos)

      expect(movimientos).toHaveLength(5)
      expect(movimientos.map((m) => m.id)).toEqual(['i3', 'i2', 'i1', 'g3', 'g2'])
    })

    it('menos de 5 movimientos en total: devuelve todos', () => {
      const gastos = [gastoDe({ id: 'g1', fecha: '2026-07-01' })]
      const ingresos = [ingresoDe({ id: 'i1', fecha: '2026-07-02' })]

      const movimientos = combinarUltimosMovimientos(gastos, ingresos)

      expect(movimientos).toHaveLength(2)
    })

    it('borde: solo gastos (ingresos vacío) -> solo gastos ordenados', () => {
      const gastos = [gastoDe({ id: 'g1', fecha: '2026-07-01' }), gastoDe({ id: 'g2', fecha: '2026-07-05' })]

      const movimientos = combinarUltimosMovimientos(gastos, [])

      expect(movimientos.map((m) => m.id)).toEqual(['g2', 'g1'])
      expect(movimientos.every((m) => m.tipo === 'gasto')).toBe(true)
    })

    it('borde: solo ingresos (gastos vacío) -> solo ingresos', () => {
      const ingresos = [ingresoDe({ id: 'i1', fecha: '2026-07-01' })]

      const movimientos = combinarUltimosMovimientos([], ingresos)

      expect(movimientos.map((m) => m.id)).toEqual(['i1'])
      expect(movimientos.every((m) => m.tipo === 'ingreso')).toBe(true)
    })

    it('borde: ambos arrays vacíos -> []', () => {
      expect(combinarUltimosMovimientos([], [])).toEqual([])
    })

    it('mapeo de campos: tipo, descripcion, monto y moneda correctos para gasto e ingreso', () => {
      const gasto = gastoDe({ id: 'g1', fecha: '2026-07-10', descripcion: 'Taxi', monto: 25, moneda: 'USD' })
      const ingreso = ingresoDe({ id: 'i1', fecha: '2026-07-01', concepto: 'Sueldo', importe: 1500, moneda: 'PEN' })

      const [movimientoGasto, movimientoIngreso] = combinarUltimosMovimientos([gasto], [ingreso])

      expect(movimientoGasto).toEqual({
        tipo: 'gasto',
        fecha: '2026-07-10',
        monto: 25,
        descripcion: 'Taxi',
        moneda: 'USD',
        id: 'g1',
        categoriaId: 'c1',
        bancoId: 'b1',
      })
      expect(movimientoIngreso).toEqual({
        tipo: 'ingreso',
        fecha: '2026-07-01',
        monto: 1500,
        descripcion: 'Sueldo',
        moneda: 'PEN',
        id: 'i1',
        categoriaId: null,
        bancoId: 'b1',
      })
    })

    it('MovimientoUnificado extendido: un gasto trae categoriaId/bancoId reales; un ingreso trae categoriaId=null y su bancoId', () => {
      const gasto = gastoDe({ id: 'g1', categoria_id: 'cat-comida', banco_id: 'banco-bcp' })
      const ingreso = ingresoDe({ id: 'i1', banco_id: 'banco-bbva' })

      const movimientos = combinarUltimosMovimientos([gasto], [ingreso])
      const movimientoGasto = movimientos.find((m) => m.tipo === 'gasto')!
      const movimientoIngreso = movimientos.find((m) => m.tipo === 'ingreso')!

      expect(movimientoGasto.categoriaId).toBe('cat-comida')
      expect(movimientoGasto.bancoId).toBe('banco-bcp')
      expect(movimientoIngreso.categoriaId).toBeNull()
      expect(movimientoIngreso.bancoId).toBe('banco-bbva')
    })
  })

  describe('combinarMovimientosDelMes (Fase 0 "Caudal" — feed unificado de Inicio)', () => {
    it('camino feliz: mezcla gastos+ingresos del mes/moneda, orden desc por fecha, sin tope de 5', () => {
      const gastos = [
        gastoDe({ id: 'g1', fecha: '2026-07-01', moneda: 'PEN' }),
        gastoDe({ id: 'g2', fecha: '2026-07-02', moneda: 'PEN' }),
        gastoDe({ id: 'g3', fecha: '2026-07-03', moneda: 'PEN' }),
      ]
      const ingresos = [
        ingresoDe({ id: 'i1', fecha: '2026-07-04', moneda: 'PEN' }),
        ingresoDe({ id: 'i2', fecha: '2026-07-05', moneda: 'PEN' }),
        ingresoDe({ id: 'i3', fecha: '2026-07-06', moneda: 'PEN' }),
      ]

      const movimientos = combinarMovimientosDelMes(gastos, ingresos, '2026-07-01', 'PEN', 'todos')

      expect(movimientos).toHaveLength(6)
      expect(movimientos.map((m) => m.id)).toEqual(['i3', 'i2', 'i1', 'g3', 'g2', 'g1'])
    })

    it('filtro por tipo: "ingresos" solo devuelve ingresos', () => {
      const gastos = [gastoDe({ id: 'g1', fecha: '2026-07-01', moneda: 'PEN' })]
      const ingresos = [ingresoDe({ id: 'i1', fecha: '2026-07-02', moneda: 'PEN' })]

      const movimientos = combinarMovimientosDelMes(gastos, ingresos, '2026-07-01', 'PEN', 'ingresos')

      expect(movimientos.map((m) => m.id)).toEqual(['i1'])
    })

    it('filtro por tipo: "egresos" solo devuelve gastos', () => {
      const gastos = [gastoDe({ id: 'g1', fecha: '2026-07-01', moneda: 'PEN' })]
      const ingresos = [ingresoDe({ id: 'i1', fecha: '2026-07-02', moneda: 'PEN' })]

      const movimientos = combinarMovimientosDelMes(gastos, ingresos, '2026-07-01', 'PEN', 'egresos')

      expect(movimientos.map((m) => m.id)).toEqual(['g1'])
    })

    it('filtro por tipo: "todos" devuelve ambos', () => {
      const gastos = [gastoDe({ id: 'g1', fecha: '2026-07-01', moneda: 'PEN' })]
      const ingresos = [ingresoDe({ id: 'i1', fecha: '2026-07-02', moneda: 'PEN' })]

      const movimientos = combinarMovimientosDelMes(gastos, ingresos, '2026-07-01', 'PEN', 'todos')

      expect(movimientos.map((m) => m.id).sort()).toEqual(['g1', 'i1'])
    })

    it('filtro de moneda: excluye movimientos de otra moneda', () => {
      const gastos = [
        gastoDe({ id: 'g-pen', fecha: '2026-07-01', moneda: 'PEN' }),
        gastoDe({ id: 'g-usd', fecha: '2026-07-01', moneda: 'USD' }),
      ]
      const ingresos = [
        ingresoDe({ id: 'i-pen', fecha: '2026-07-01', moneda: 'PEN' }),
        ingresoDe({ id: 'i-usd', fecha: '2026-07-01', moneda: 'USD' }),
      ]

      const movimientos = combinarMovimientosDelMes(gastos, ingresos, '2026-07-01', 'PEN', 'todos')

      expect(movimientos.map((m) => m.id).sort()).toEqual(['g-pen', 'i-pen'])
    })

    it('filtro de mes: excluye movimientos de otro mes', () => {
      const gastos = [
        gastoDe({ id: 'g-jul', fecha: '2026-07-15', moneda: 'PEN' }),
        gastoDe({ id: 'g-jun', fecha: '2026-06-15', moneda: 'PEN' }),
      ]
      const ingresos = [
        ingresoDe({ id: 'i-jul', fecha: '2026-07-15', moneda: 'PEN' }),
        ingresoDe({ id: 'i-jun', fecha: '2026-06-15', moneda: 'PEN' }),
      ]

      const movimientos = combinarMovimientosDelMes(gastos, ingresos, '2026-07-01', 'PEN', 'todos')

      expect(movimientos.map((m) => m.id).sort()).toEqual(['g-jul', 'i-jul'])
    })

    it('borde: sin datos devuelve []', () => {
      expect(combinarMovimientosDelMes([], [], '2026-07-01', 'PEN', 'todos')).toEqual([])
    })

    it('límite: más de 5 movimientos en el mes devuelve TODOS (sin tope de 5, a diferencia de combinarUltimosMovimientos)', () => {
      const gastos = Array.from({ length: 4 }, (_, i) =>
        gastoDe({ id: `g${i}`, fecha: `2026-07-0${i + 1}`, moneda: 'PEN' }),
      )
      const ingresos = Array.from({ length: 4 }, (_, i) =>
        ingresoDe({ id: `i${i}`, fecha: `2026-07-1${i + 1}`, moneda: 'PEN' }),
      )

      const movimientos = combinarMovimientosDelMes(gastos, ingresos, '2026-07-01', 'PEN', 'todos')

      expect(movimientos).toHaveLength(8)
    })
  })

  describe('proyeccionCierreMes (Fase 0 "Caudal" — resumen de presupuesto)', () => {
    it('camino feliz: gastado 300, día 10, mes de 30 días -> proyecta 900', () => {
      expect(proyeccionCierreMes(300, 10, 30)).toBe(900)
    })

    it('borde: diaActual = 0 -> 0 (sin división por cero)', () => {
      expect(proyeccionCierreMes(300, 0, 30)).toBe(0)
    })

    it('borde: diaActual negativo -> 0 (dato inválido, mismo guard)', () => {
      expect(proyeccionCierreMes(300, -1, 30)).toBe(0)
    })

    it('borde: mes sin gasto (gastado 0) -> proyección 0', () => {
      expect(proyeccionCierreMes(0, 10, 30)).toBe(0)
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
