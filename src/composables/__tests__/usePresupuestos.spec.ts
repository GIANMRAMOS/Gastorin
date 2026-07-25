import { beforeEach, describe, expect, it, type Mock } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  calcularDesgloseSemanal,
  calcularGastado,
  contarCategoriasExcedidas,
  contarDiasSinGasto,
  numeroSemanaDelMes,
  usePresupuestos,
} from '@/composables/usePresupuestos'
import { useGastosStore } from '@/stores/gastos'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabaseClient'
import { crearConstructorConsulta } from '@/lib/__mocks__/supabaseClient'
import type { Gasto, Presupuesto } from '@/types/gasto'

/**
 * `supabase.from` viene del mock manual (`vi.mock('@/lib/supabaseClient')` en
 * `src/test/setup.ts`). Ver `useCategorias.spec.ts` para el patrón de mockeo.
 */
const fromMock = supabase.from as unknown as Mock

const presupuestoBase: Presupuesto = {
  id: 'p1',
  usuario_id: 'u1',
  categoria_id: 'c1',
  mes: '2026-07-01',
  moneda: 'PEN',
  monto_limite: 500,
  creado_en: '2026-07-01T00:00:00Z',
}

function gastoDe(datos: Partial<Gasto>): Gasto {
  return {
    id: 'g1',
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

describe('usePresupuestos', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('cargarPresupuestos', () => {
    it('camino feliz: filtra por el mes actual y guarda los presupuestos en el store', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.eq as Mock).mockResolvedValueOnce({ data: [presupuestoBase], error: null })

      const { cargarPresupuestos } = usePresupuestos()
      const store = useGastosStore()
      const exito = await cargarPresupuestos()

      expect(exito).toBe(true)
      expect(fromMock).toHaveBeenCalledWith('presupuestos')
      const mesEsperado = `${new Date().toISOString().slice(0, 7)}-01`
      expect(builder.eq).toHaveBeenCalledWith('mes', mesEsperado)
      expect(store.presupuestos).toEqual([presupuestoBase])
    })

    it('borde: un array vacío NO es un error', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.eq as Mock).mockResolvedValueOnce({ data: [], error: null })

      const { cargarPresupuestos } = usePresupuestos()
      const store = useGastosStore()
      const exito = await cargarPresupuestos()

      expect(exito).toBe(true)
      expect(store.presupuestos).toEqual([])
    })

    it('borde: error de Supabase deja un mensaje en español', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.eq as Mock).mockResolvedValueOnce({ data: null, error: { message: 'boom' } })

      const { cargarPresupuestos } = usePresupuestos()
      const store = useGastosStore()
      const exito = await cargarPresupuestos()

      expect(exito).toBe(false)
      expect(store.error).toBe('No se pudieron cargar los presupuestos.')
    })
  })

  describe('crearPresupuesto', () => {
    it('camino feliz: inserta con usuario_id y mes día-1 del mes actual, y agrega al store', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.single as Mock).mockResolvedValueOnce({ data: presupuestoBase, error: null })

      const authStore = useAuthStore()
      authStore.establecerUsuario({ id: 'u1', email: 'a@a.com' } as never)

      const { crearPresupuesto } = usePresupuestos()
      const store = useGastosStore()
      const exito = await crearPresupuesto({ categoria_id: 'c1', moneda: 'PEN', monto_limite: 500 })

      expect(exito).toBe(true)
      const mesEsperado = `${new Date().toISOString().slice(0, 7)}-01`
      expect(builder.insert).toHaveBeenCalledWith({
        usuario_id: 'u1',
        categoria_id: 'c1',
        moneda: 'PEN',
        monto_limite: 500,
        mes: mesEsperado,
      })
      expect(store.presupuestos).toEqual([presupuestoBase])
    })

    it('borde: violación de unicidad (23505) muestra el mensaje esperado y no agrega el presupuesto', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.single as Mock).mockResolvedValueOnce({
        data: null,
        error: { code: '23505', message: 'duplicate key value violates unique constraint' },
      })

      const authStore = useAuthStore()
      authStore.establecerUsuario({ id: 'u1', email: 'a@a.com' } as never)

      const { crearPresupuesto } = usePresupuestos()
      const store = useGastosStore()
      const exito = await crearPresupuesto({ categoria_id: 'c1', moneda: 'PEN', monto_limite: 500 })

      expect(exito).toBe(false)
      expect(store.error).toBe('Ya existe un presupuesto para esa categoría, mes y moneda.')
      expect(store.presupuestos).toEqual([])
    })

    it('borde: sin sesión activa NO llama a Supabase', async () => {
      const authStore = useAuthStore()
      authStore.establecerUsuario(null)

      const { crearPresupuesto } = usePresupuestos()
      const store = useGastosStore()
      const exito = await crearPresupuesto({ categoria_id: 'c1', moneda: 'PEN', monto_limite: 500 })

      expect(exito).toBe(false)
      expect(store.error).toBe('No hay una sesión activa. Vuelve a iniciar sesión.')
      expect(fromMock).not.toHaveBeenCalled()
    })
  })

  describe('editarPresupuesto', () => {
    it('camino feliz: actualiza monto_limite y reemplaza el presupuesto en el store', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      const presupuestoEditado = { ...presupuestoBase, monto_limite: 800 }
      ;(builder.single as Mock).mockResolvedValueOnce({ data: presupuestoEditado, error: null })

      const store = useGastosStore()
      store.establecerPresupuestos([presupuestoBase])

      const { editarPresupuesto } = usePresupuestos()
      const exito = await editarPresupuesto('p1', 800)

      expect(exito).toBe(true)
      expect(builder.update).toHaveBeenCalledWith({ monto_limite: 800 })
      expect(builder.eq).toHaveBeenCalledWith('id', 'p1')
      expect(store.presupuestos).toEqual([presupuestoEditado])
    })
  })

  describe('eliminarPresupuesto', () => {
    it('camino feliz: elimina por id y quita el presupuesto del store', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.eq as Mock).mockResolvedValueOnce({ error: null })

      const store = useGastosStore()
      store.establecerPresupuestos([presupuestoBase])

      const { eliminarPresupuesto } = usePresupuestos()
      const exito = await eliminarPresupuesto('p1')

      expect(exito).toBe(true)
      expect(builder.delete).toHaveBeenCalled()
      expect(builder.eq).toHaveBeenCalledWith('id', 'p1')
      expect(store.presupuestos).toEqual([])
    })

    it('borde: error de Supabase no toca el store', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.eq as Mock).mockResolvedValueOnce({ error: { message: 'boom' } })

      const store = useGastosStore()
      store.establecerPresupuestos([presupuestoBase])

      const { eliminarPresupuesto } = usePresupuestos()
      const exito = await eliminarPresupuesto('p1')

      expect(exito).toBe(false)
      expect(store.error).toBe('No se pudo eliminar el presupuesto.')
      expect(store.presupuestos).toEqual([presupuestoBase])
    })
  })

  describe('calcularGastado', () => {
    it('camino feliz: suma solo los gastos confirmados de la misma categoría, moneda y mes', () => {
      const gastos = [
        gastoDe({ id: 'g1', monto: 100 }),
        gastoDe({ id: 'g2', monto: 50 }),
      ]

      expect(calcularGastado(gastos, presupuestoBase)).toBe(150)
    })

    it('ignora gastos de otra categoría', () => {
      const gastos = [gastoDe({ categoria_id: 'otra' })]

      expect(calcularGastado(gastos, presupuestoBase)).toBe(0)
    })

    it('ignora gastos de otra moneda', () => {
      const gastos = [gastoDe({ moneda: 'USD' })]

      expect(calcularGastado(gastos, presupuestoBase)).toBe(0)
    })

    it('ignora gastos de otro mes', () => {
      const gastos = [gastoDe({ fecha: '2026-06-30' })]

      expect(calcularGastado(gastos, presupuestoBase)).toBe(0)
    })

    it('borde: lista vacía devuelve 0', () => {
      expect(calcularGastado([], presupuestoBase)).toBe(0)
    })
  })

  describe('numeroSemanaDelMes', () => {
    it('particiona los días del mes en 4 semanas, plegando 29-31 dentro de la semana 4', () => {
      expect(numeroSemanaDelMes(1)).toBe(1)
      expect(numeroSemanaDelMes(7)).toBe(1)
      expect(numeroSemanaDelMes(8)).toBe(2)
      expect(numeroSemanaDelMes(14)).toBe(2)
      expect(numeroSemanaDelMes(15)).toBe(3)
      expect(numeroSemanaDelMes(21)).toBe(3)
      expect(numeroSemanaDelMes(22)).toBe(4)
      expect(numeroSemanaDelMes(28)).toBe(4)
      expect(numeroSemanaDelMes(29)).toBe(4)
      expect(numeroSemanaDelMes(30)).toBe(4)
      expect(numeroSemanaDelMes(31)).toBe(4)
    })
  })

  describe('calcularDesgloseSemanal', () => {
    it('camino feliz: agrupa por semana solo los gastos de la categoría/moneda/mes exactos', () => {
      const gastos = [
        gastoDe({ id: 'g1', categoria_id: 'c1', moneda: 'PEN', fecha: '2026-07-01', monto: 100 }),
        gastoDe({ id: 'g2', categoria_id: 'c1', moneda: 'PEN', fecha: '2026-07-10', monto: 50 }),
        gastoDe({ id: 'g3', categoria_id: 'c1', moneda: 'PEN', fecha: '2026-07-30', monto: 20 }),
        // No debe colarse: otra categoría, otra moneda, otro mes.
        gastoDe({ id: 'otra-cat', categoria_id: 'otra', moneda: 'PEN', fecha: '2026-07-05', monto: 9999 }),
        gastoDe({ id: 'otra-moneda', categoria_id: 'c1', moneda: 'USD', fecha: '2026-07-05', monto: 9999 }),
        gastoDe({ id: 'otro-mes', categoria_id: 'c1', moneda: 'PEN', fecha: '2026-06-05', monto: 9999 }),
      ]

      const desglose = calcularDesgloseSemanal(gastos, 'c1', 'PEN', '2026-07')

      expect(desglose).toEqual([
        { semana: 1, total: 100 },
        { semana: 2, total: 50 },
        { semana: 3, total: 0 },
        { semana: 4, total: 20 },
      ])
    })

    it('borde: una semana sin gasto aparece con total 0, no se omite', () => {
      const desglose = calcularDesgloseSemanal([], 'c1', 'PEN', '2026-07')
      expect(desglose).toEqual([
        { semana: 1, total: 0 },
        { semana: 2, total: 0 },
        { semana: 3, total: 0 },
        { semana: 4, total: 0 },
      ])
    })
  })

  describe('contarCategoriasExcedidas', () => {
    it('devuelve solo los categoria_id de presupuestos de la moneda dada cuyo gastado supera el límite', () => {
      const presupuestoExcedido: Presupuesto = { ...presupuestoBase, id: 'p1', categoria_id: 'c1', monto_limite: 100 }
      const presupuestoNormal: Presupuesto = { ...presupuestoBase, id: 'p2', categoria_id: 'c2', monto_limite: 1000 }
      const presupuestoOtraMoneda: Presupuesto = {
        ...presupuestoBase,
        id: 'p3',
        categoria_id: 'c3',
        moneda: 'USD',
        monto_limite: 1,
      }
      const gastos = [
        gastoDe({ categoria_id: 'c1', moneda: 'PEN', monto: 500 }),
        gastoDe({ categoria_id: 'c2', moneda: 'PEN', monto: 50 }),
        gastoDe({ categoria_id: 'c3', moneda: 'USD', monto: 999 }),
      ]

      const excedidas = contarCategoriasExcedidas(
        [presupuestoExcedido, presupuestoNormal, presupuestoOtraMoneda],
        gastos,
        'PEN',
      )

      expect(excedidas).toEqual(['c1'])
    })

    it('borde: sin ninguna excedida devuelve un array vacío', () => {
      const presupuestoNormal: Presupuesto = { ...presupuestoBase, monto_limite: 1000 }
      expect(contarCategoriasExcedidas([presupuestoNormal], [gastoDe({ monto: 10 })], 'PEN')).toEqual([])
    })

    it('exactamente en el límite (gastado === limite) NO cuenta como excedida', () => {
      const presupuesto: Presupuesto = { ...presupuestoBase, monto_limite: 100 }
      expect(contarCategoriasExcedidas([presupuesto], [gastoDe({ monto: 100 })], 'PEN')).toEqual([])
    })
  })

  describe('contarDiasSinGasto', () => {
    it('camino feliz: cuenta los días 1..diaActual sin ningún gasto confirmado de esa moneda', () => {
      const gastos = [
        gastoDe({ fecha: '2026-07-01', moneda: 'PEN' }),
        gastoDe({ fecha: '2026-07-03', moneda: 'PEN' }),
        // No cuenta: otra moneda el día 2 (ese día sigue "sin gasto" en PEN).
        gastoDe({ fecha: '2026-07-02', moneda: 'USD' }),
      ]

      const resultado = contarDiasSinGasto(gastos, 'PEN', '2026-07', 5)

      // Transcurridos 1..5: día 1 y 3 tienen gasto PEN; 2, 4 y 5 no.
      expect(resultado).toEqual({ sinGasto: 3, transcurridos: 5 })
    })

    it('un día con al menos un gasto no cuenta como "sin gasto"', () => {
      const gastos = [gastoDe({ fecha: '2026-07-01', moneda: 'PEN' })]
      const resultado = contarDiasSinGasto(gastos, 'PEN', '2026-07', 1)
      expect(resultado).toEqual({ sinGasto: 0, transcurridos: 1 })
    })

    it('borde: diaActual se acota a los días reales del mes', () => {
      const resultado = contarDiasSinGasto([], 'PEN', '2026-04', 31)
      // Abril tiene 30 días.
      expect(resultado.transcurridos).toBe(30)
      expect(resultado.sinGasto).toBe(30)
    })
  })

  describe('cargarPresupuestosMesAnterior', () => {
    it('camino feliz: filtra por el mes anterior y lo guarda en `presupuestosMesAnterior` sin tocar el store', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.eq as Mock).mockResolvedValueOnce({ data: [presupuestoBase], error: null })

      const { cargarPresupuestosMesAnterior, presupuestosMesAnterior } = usePresupuestos()
      const store = useGastosStore()
      const exito = await cargarPresupuestosMesAnterior()

      expect(exito).toBe(true)
      expect(presupuestosMesAnterior.value).toEqual([presupuestoBase])
      expect(store.presupuestos).toEqual([]) // NO se escribe en el store del mes actual
    })

    it('borde: array vacío no es un error', async () => {
      const builder = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builder)
      ;(builder.eq as Mock).mockResolvedValueOnce({ data: [], error: null })

      const { cargarPresupuestosMesAnterior, presupuestosMesAnterior } = usePresupuestos()
      const exito = await cargarPresupuestosMesAnterior()

      expect(exito).toBe(true)
      expect(presupuestosMesAnterior.value).toEqual([])
    })
  })

  describe('copiarPresupuestosMesAnterior', () => {
    it('camino feliz: solo copia las categorías que el mes actual NO tiene', async () => {
      const store = useGastosStore()
      const authStore = useAuthStore()
      authStore.establecerUsuario({ id: 'u1', email: 'a@a.com' } as never)
      // Mes actual ya tiene c1; el mes anterior tiene c1 (no se debe duplicar) y c2 (faltante).
      store.establecerPresupuestos([{ ...presupuestoBase, id: 'actual-1', categoria_id: 'c1' }])

      const { cargarPresupuestosMesAnterior, copiarPresupuestosMesAnterior } = usePresupuestos()

      const builderCarga = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builderCarga)
      ;(builderCarga.eq as Mock).mockResolvedValueOnce({
        data: [
          { ...presupuestoBase, id: 'anterior-1', categoria_id: 'c1' },
          { ...presupuestoBase, id: 'anterior-2', categoria_id: 'c2', monto_limite: 300 },
        ],
        error: null,
      })
      await cargarPresupuestosMesAnterior()

      const builderCopiar = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builderCopiar)
      ;(builderCopiar.select as Mock).mockResolvedValueOnce({
        data: [{ ...presupuestoBase, id: 'nuevo-1', categoria_id: 'c2', monto_limite: 300 }],
        error: null,
      })

      const exito = await copiarPresupuestosMesAnterior()

      expect(exito).toBe(true)
      expect(builderCopiar.insert).toHaveBeenCalledWith([
        expect.objectContaining({ usuario_id: 'u1', categoria_id: 'c2', moneda: 'PEN', monto_limite: 300 }),
      ])
      expect(store.presupuestos.map((p) => p.categoria_id).sort()).toEqual(['c1', 'c2'])
    })

    it('borde: mes anterior vacío no hace ninguna llamada de escritura', async () => {
      const authStore = useAuthStore()
      authStore.establecerUsuario({ id: 'u1', email: 'a@a.com' } as never)

      const { copiarPresupuestosMesAnterior } = usePresupuestos()
      // Sin llamar a cargarPresupuestosMesAnterior antes: `presupuestosMesAnterior` queda vacío.
      const exito = await copiarPresupuestosMesAnterior()

      expect(exito).toBe(true)
      expect(fromMock).not.toHaveBeenCalled()
    })

    /**
     * QA independiente (pregunta del orquestador): "¿qué pasa si se llama dos
     * veces seguidas (doble click accidental)?". La vista NO deshabilita el
     * botón "Copiar" mientras `store.cargando` es `true` (a diferencia del
     * botón "Guardar" de `FormularioMetaAhorro`/`FormularioPresupuesto`), así
     * que dos clicks rápidos SÍ pueden disparar dos invocaciones concurrentes
     * antes de que la primera resuelva y actualice `store.presupuestos` — las
     * dos leen el mismo estado "sin c2 todavía" y ambas intentan insertar la
     * misma categoría. Este test simula esa carrera: la segunda invocación
     * choca con 23505 (como lo haría el `UNIQUE` real de Postgres) y confirma
     * que el composable no rompe ni duplica la fila en el store, solo reporta
     * el error esperado.
     */
    it('doble invocación concurrente (doble click): la segunda choca con 23505 y no duplica en el store', async () => {
      const store = useGastosStore()
      const authStore = useAuthStore()
      authStore.establecerUsuario({ id: 'u1', email: 'a@a.com' } as never)
      store.establecerPresupuestos([{ ...presupuestoBase, id: 'actual-1', categoria_id: 'c1' }])

      const { cargarPresupuestosMesAnterior, copiarPresupuestosMesAnterior } = usePresupuestos()

      const builderCarga = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builderCarga)
      ;(builderCarga.eq as Mock).mockResolvedValueOnce({
        data: [{ ...presupuestoBase, id: 'anterior-2', categoria_id: 'c2', monto_limite: 300 }],
        error: null,
      })
      await cargarPresupuestosMesAnterior()

      // Ambas invocaciones parten del mismo estado del store (c2 todavía no
      // existe este mes): las dos calculan `faltantes = ['c2']` ANTES de que
      // la primera resuelva y actualice el store (misma condición de carrera
      // que un doble click real produciría en el navegador).
      const builderPrimera = crearConstructorConsulta()
      const builderSegunda = crearConstructorConsulta()
      fromMock.mockReturnValueOnce(builderPrimera).mockReturnValueOnce(builderSegunda)
      ;(builderPrimera.select as Mock).mockResolvedValueOnce({
        data: [{ ...presupuestoBase, id: 'nuevo-1', categoria_id: 'c2', monto_limite: 300 }],
        error: null,
      })
      ;(builderSegunda.select as Mock).mockResolvedValueOnce({
        data: null,
        error: { code: '23505', message: 'duplicate key value violates unique constraint' },
      })

      const [exitoPrimera, exitoSegunda] = await Promise.all([
        copiarPresupuestosMesAnterior(),
        copiarPresupuestosMesAnterior(),
      ])

      expect(exitoPrimera).toBe(true)
      expect(exitoSegunda).toBe(false)
      expect(store.error).toBe('Alguna de esas categorías ya tiene presupuesto este mes.')
      // Ninguna duplicación: c2 aparece UNA sola vez en el store, no dos.
      expect(store.presupuestos.filter((p) => p.categoria_id === 'c2')).toHaveLength(1)
      expect(store.presupuestos.map((p) => p.categoria_id).sort()).toEqual(['c1', 'c2'])
    })
  })
})
