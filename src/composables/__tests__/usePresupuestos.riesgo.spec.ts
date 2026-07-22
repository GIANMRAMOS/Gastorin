import { beforeEach, describe, expect, it, type Mock } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { calcularGastado, usePresupuestos } from '@/composables/usePresupuestos'
import { useGastosStore } from '@/stores/gastos'
import { supabase } from '@/lib/supabaseClient'
import { crearConstructorConsulta } from '@/lib/__mocks__/supabaseClient'
import type { Gasto, Presupuesto } from '@/types/gasto'

/**
 * Suite de validación INDEPENDIENTE (QA), no del dev-builder. Se enfoca en
 * los puntos de mayor riesgo de la Épica 6: precisión de `calcularGastado`
 * con datos mezclados, y la garantía estructural de que `editarPresupuesto`
 * es incapaz de tocar categoría/moneda (clave UNIQUE).
 */
const fromMock = supabase.from as unknown as Mock

describe('usePresupuestos — validación de riesgo (QA independiente)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('calcularGastado — precisión con dataset mezclado y realista', () => {
    const presupuestoComidaPEN: Presupuesto = {
      id: 'pres-1',
      usuario_id: 'u1',
      categoria_id: 'comida',
      mes: '2026-07-01',
      moneda: 'PEN',
      monto_limite: 1000,
      creado_en: '',
    }

    function gasto(datos: Partial<Gasto>): Gasto {
      return {
        id: `g-${Math.random()}`,
        usuario_id: 'u1',
        categoria_id: 'comida',
        banco_id: 'b1',
        monto: 0,
        moneda: 'PEN',
        fecha: '2026-07-15',
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

    it('suma SOLO los gastos que coinciden exactamente en categoría+moneda+mes, entre un mar de "casi coincidencias"', () => {
      const gastosMezclados: Gasto[] = [
        // Coinciden exactamente: deben sumar.
        gasto({ id: 'ok-1', categoria_id: 'comida', moneda: 'PEN', fecha: '2026-07-01', monto: 100 }),
        gasto({ id: 'ok-2', categoria_id: 'comida', moneda: 'PEN', fecha: '2026-07-31', monto: 50 }),
        // Misma categoría, pero MES distinto (junio y agosto): NO deben sumar.
        gasto({ id: 'mal-mes-1', categoria_id: 'comida', moneda: 'PEN', fecha: '2026-06-30', monto: 9999 }),
        gasto({ id: 'mal-mes-2', categoria_id: 'comida', moneda: 'PEN', fecha: '2026-08-01', monto: 9999 }),
        // Mismo mes y categoría, pero MONEDA distinta: NO debe sumar.
        gasto({ id: 'mal-moneda', categoria_id: 'comida', moneda: 'USD', fecha: '2026-07-10', monto: 9999 }),
        // Mismo mes y moneda, pero CATEGORÍA distinta: NO debe sumar.
        gasto({ id: 'mal-categoria', categoria_id: 'transporte', moneda: 'PEN', fecha: '2026-07-10', monto: 9999 }),
        // Ninguna coincidencia en absoluto: NO debe sumar.
        gasto({ id: 'nada', categoria_id: 'ocio', moneda: 'USD', fecha: '2026-05-01', monto: 9999 }),
        // Gasto de otra categoría en OTRO presupuesto (transporte, USD) que
        // por casualidad cae en el mismo mes: tampoco debe colarse.
        gasto({ id: 'otro-presupuesto', categoria_id: 'transporte', moneda: 'USD', fecha: '2026-07-20', monto: 300 }),
      ]

      const total = calcularGastado(gastosMezclados, presupuestoComidaPEN)

      // Si el filtro estuviera incompleto (p.ej. solo categoría, o solo
      // categoría+mes), el total sería 9999+ en vez de 150.
      expect(total).toBe(150)
    })

    it('un gasto de la categoría correcta pero de un mes distinto (mismo año, mes+1) NO se suma', () => {
      const gastos = [gasto({ categoria_id: 'comida', moneda: 'PEN', fecha: '2026-08-01', monto: 500 })]
      expect(calcularGastado(gastos, presupuestoComidaPEN)).toBe(0)
    })

    it('un gasto de la categoría y mes correctos pero de moneda distinta NO se suma', () => {
      const gastos = [gasto({ categoria_id: 'comida', moneda: 'USD', fecha: '2026-07-05', monto: 500 })]
      expect(calcularGastado(gastos, presupuestoComidaPEN)).toBe(0)
    })

    it('varios presupuestos distintos sobre el mismo dataset obtienen cada uno su propio total (sin fuga cruzada)', () => {
      const presupuestoTransporteUSD: Presupuesto = {
        ...presupuestoComidaPEN,
        id: 'pres-2',
        categoria_id: 'transporte',
        moneda: 'USD',
      }
      const dataset = [
        gasto({ categoria_id: 'comida', moneda: 'PEN', fecha: '2026-07-01', monto: 100 }),
        gasto({ categoria_id: 'transporte', moneda: 'USD', fecha: '2026-07-15', monto: 40 }),
        gasto({ categoria_id: 'transporte', moneda: 'PEN', fecha: '2026-07-15', monto: 9999 }),
      ]

      expect(calcularGastado(dataset, presupuestoComidaPEN)).toBe(100)
      expect(calcularGastado(dataset, presupuestoTransporteUSD)).toBe(40)
    })
  })

  describe('editarPresupuesto — garantía estructural de que solo monto_limite es editable (HU-6.3)', () => {
    it('el payload de UPDATE enviado a Supabase NUNCA incluye categoria_id/moneda/mes, aunque el store tenga esos valores', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      const presupuestoOriginal: Presupuesto = {
        id: 'p1',
        usuario_id: 'u1',
        categoria_id: 'comida',
        mes: '2026-07-01',
        moneda: 'PEN',
        monto_limite: 500,
        creado_en: '',
      }
      ;(builder.single as Mock).mockResolvedValueOnce({
        data: { ...presupuestoOriginal, monto_limite: 900 },
        error: null,
      })

      const store = useGastosStore()
      store.establecerPresupuestos([presupuestoOriginal])

      const { editarPresupuesto } = usePresupuestos()
      // La firma de editarPresupuesto(id, montoLimite) hace IMPOSIBLE, a
      // nivel de tipos, intentar colar categoria_id/moneda: esta prueba
      // confirma que el payload real enviado a Supabase respeta esa garantía
      // (no se "cuela" nada del objeto original vía spread accidental).
      const exito = await editarPresupuesto('p1', 900)

      expect(exito).toBe(true)
      expect(builder.update).toHaveBeenCalledTimes(1)
      const payloadEnviado = (builder.update as Mock).mock.calls[0][0]
      expect(payloadEnviado).toEqual({ monto_limite: 900 })
      expect(payloadEnviado).not.toHaveProperty('categoria_id')
      expect(payloadEnviado).not.toHaveProperty('moneda')
      expect(payloadEnviado).not.toHaveProperty('mes')

      // El presupuesto en el store queda con la categoría/moneda ORIGINALES
      // (vienen del `data` devuelto por Supabase, no del cliente).
      expect(store.presupuestos[0].categoria_id).toBe('comida')
      expect(store.presupuestos[0].moneda).toBe('PEN')
      expect(store.presupuestos[0].monto_limite).toBe(900)
    })
  })

  describe('crearPresupuesto — el error 23505 no deja pasar un duplicado silencioso ni rompe sin manejo', () => {
    it('ante 23505, no se agrega el presupuesto al store y el mensaje de error queda seteado (no hay excepción no capturada)', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.single as Mock).mockResolvedValueOnce({
        data: null,
        error: { code: '23505', message: 'duplicate key value violates unique constraint' },
      })

      const { useAuthStore } = await import('@/stores/auth')
      const authStore = useAuthStore()
      authStore.establecerUsuario({ id: 'u1', email: 'a@a.com' } as never)

      const store = useGastosStore()
      store.establecerPresupuestos([]) // estado limpio: nada debe aparecer tras el intento

      const { crearPresupuesto } = usePresupuestos()

      let excepcion: unknown = null
      let exito = false
      try {
        exito = await crearPresupuesto({ categoria_id: 'comida', moneda: 'PEN', monto_limite: 500 })
      } catch (err) {
        excepcion = err
      }

      expect(excepcion).toBeNull() // el error 23505 se maneja, no se propaga como excepción
      expect(exito).toBe(false)
      expect(store.presupuestos).toHaveLength(0) // ningún duplicado colado
      expect(store.error).toBe('Ya existe un presupuesto para esa categoría, mes y moneda.')
    })

    it('ante un error de Postgres DISTINTO a 23505, tampoco se agrega el presupuesto ni se rompe sin manejo', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.single as Mock).mockResolvedValueOnce({
        data: null,
        error: { code: '23503', message: 'foreign key violation' },
      })

      const { useAuthStore } = await import('@/stores/auth')
      const authStore = useAuthStore()
      authStore.establecerUsuario({ id: 'u1', email: 'a@a.com' } as never)

      const store = useGastosStore()
      const { crearPresupuesto } = usePresupuestos()

      const exito = await crearPresupuesto({ categoria_id: 'comida', moneda: 'PEN', monto_limite: 500 })

      expect(exito).toBe(false)
      expect(store.presupuestos).toHaveLength(0)
      expect(store.error).toBe('No se pudo crear el presupuesto.')
    })
  })
})
