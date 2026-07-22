import { beforeEach, describe, expect, it, type Mock } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { cargarResumenPorMoneda, useDashboard } from '@/composables/useDashboard'
import { useGastosStore } from '@/stores/gastos'
import { supabase } from '@/lib/supabaseClient'
import { crearConstructorConsulta } from '@/lib/__mocks__/supabaseClient'
import type { Gasto } from '@/types/gasto'

/**
 * Suite de riesgo (QA independiente), no del dev-builder. Cubre el riesgo
 * transversal explícito del micro-plan: `useDashboard` NO debe depender de ni
 * contaminar `store.gastos` (usado por Historial), y su fetch de 6 meses debe
 * filtrar SIEMPRE por `estado='confirmado'` para no colar borradores,
 * revisión manual ni descartados en las agregaciones del dashboard.
 */
const fromMock = supabase.from as unknown as Mock

function gastoDe(datos: Partial<Gasto>): Gasto {
  return {
    id: `g-${Math.random()}`,
    usuario_id: 'u1',
    categoria_id: 'c1',
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

describe('useDashboard — validación de riesgo (QA independiente)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('independencia de store.gastos (Historial)', () => {
    it('cargarDatosDashboard ignora por completo lo que haya en store.gastos: carga sus propias filas', async () => {
      const store = useGastosStore()
      // Simula que Historial ya visitó la app y dejó datos "viejos"/distintos en el store compartido.
      store.establecerGastos([gastoDe({ id: 'del-historial', monto: 9999999 })])

      const filaDashboard = gastoDe({ id: 'g-dashboard', monto: 55 })
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.order as Mock).mockResolvedValueOnce({ data: [filaDashboard], error: null })

      const { filas, cargarDatosDashboard } = useDashboard()
      await cargarDatosDashboard()

      // Las filas del dashboard son las que devolvió SU fetch, no las de store.gastos.
      expect(filas.value).toEqual([filaDashboard])
      expect(filas.value).not.toContainEqual(expect.objectContaining({ id: 'del-historial' }))
      // El store.gastos de Historial permanece intacto: el dashboard no lo tocó.
      expect(store.gastos).toEqual([gastoDe({ id: 'del-historial', monto: 9999999 })])
    })

    it('cargarDatosDashboard NUNCA escribe en store.gastos (solo usa el store para cargando/error)', async () => {
      const store = useGastosStore()
      store.establecerGastos([])

      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.order as Mock).mockResolvedValueOnce({ data: [gastoDe({ id: 'x' })], error: null })

      const { cargarDatosDashboard } = useDashboard()
      await cargarDatosDashboard()

      // Si el composable hubiera reusado/escrito store.gastos (acoplamiento indebido a Historial),
      // esta lista dejaría de estar vacía.
      expect(store.gastos).toEqual([])
    })
  })

  describe('filtro estado=confirmado en el fetch de 6 meses', () => {
    it('el query real enviado a Supabase filtra por estado=confirmado (no borrador/revision_manual/descartado)', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.order as Mock).mockResolvedValueOnce({ data: [], error: null })

      const { cargarDatosDashboard } = useDashboard()
      await cargarDatosDashboard()

      // Garantía estructural: el composable pide explícitamente 'confirmado' a
      // Supabase (RLS/estado no se filtra client-side después, así que si esta
      // llamada faltara o pidiera otro valor, borradores/revisión/descartados
      // se colarían en el dashboard).
      expect(builder.eq).toHaveBeenCalledWith('estado', 'confirmado')
      expect(builder.eq).not.toHaveBeenCalledWith('estado', 'borrador')
      expect(builder.eq).not.toHaveBeenCalledWith('estado', 'revision_manual')
      expect(builder.eq).not.toHaveBeenCalledWith('estado', 'descartado')
    })

    it('riesgo real: las funciones puras de agregación NO vuelven a filtrar por estado — confían ciegamente en el fetch de cargarDatosDashboard', () => {
      // Si `cargarDatosDashboard` dejara de filtrar por 'confirmado' (regresión
      // futura), un borrador colaría su monto en el resumen del dashboard sin
      // que ninguna otra capa lo detecte: `cargarResumenPorMoneda` (y las otras
      // dos agregadoras) no miran el campo `estado` en absoluto.
      const gastosConBorradorColado = [
        gastoDe({ estado: 'confirmado', moneda: 'PEN', fecha: '2026-07-05', monto: 100 }),
        gastoDe({ estado: 'borrador', moneda: 'PEN', fecha: '2026-07-06', monto: 500 }),
      ]

      const resumen = cargarResumenPorMoneda(gastosConBorradorColado, '2026-07-01')

      // Demuestra el riesgo: el borrador SÍ se suma (500+100=600) porque la
      // función pura no filtra por estado. La única barrera real es el
      // `.eq('estado','confirmado')` del fetch, verificado en el test anterior.
      expect(resumen.PEN.total).toBe(600)
    })
  })
})
