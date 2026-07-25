import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useIngresosStore } from '@/stores/ingresos'
import type { Banco, Ingreso } from '@/types/ingreso'

const bancoFalso: Banco = {
  id: 'b1',
  usuario_id: 'u1',
  nombre: 'BCP',
  created_at: '2026-07-01T00:00:00Z',
}

const ingresoFalso: Ingreso = {
  id: 'i1',
  usuario_id: 'u1',
  banco_id: 'b1',
  categoria_id: 'ci1',
  concepto: 'Sueldo',
  importe: 100,
  moneda: 'PEN',
  fecha: '2026-07-01',
  created_at: '2026-07-01T00:00:00Z',
}

/**
 * Pruebas del store `ingresos` en aislamiento (sin pasar por
 * `useIngresos`/`useBancos`/Supabase). Aquí se cubren las transiciones de
 * estado propias del store, en particular el contador de cargas en vuelo
 * (`cargasEnVuelo`) que respalda a `cargando`.
 */
describe('store ingresos', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('estado inicial: sin ingresos, sin bancos, sin error, no cargando', () => {
    const store = useIngresosStore()

    expect(store.ingresos).toEqual([])
    expect(store.bancos).toEqual([])
    expect(store.error).toBeNull()
    expect(store.cargando).toBe(false)
  })

  it('camino feliz: agregarIngreso inserta el nuevo ingreso al principio de la lista', () => {
    const store = useIngresosStore()
    const otroIngreso: Ingreso = { ...ingresoFalso, id: 'i0' }
    store.agregarIngreso(otroIngreso)
    store.agregarIngreso(ingresoFalso)

    expect(store.ingresos).toEqual([ingresoFalso, otroIngreso])
  })

  it('camino feliz: actualizarIngreso reemplaza el ingreso existente por id', () => {
    const store = useIngresosStore()
    store.agregarIngreso(ingresoFalso)
    const ingresoModificado: Ingreso = { ...ingresoFalso, importe: 999, concepto: 'editado' }

    store.actualizarIngreso(ingresoModificado)

    expect(store.ingresos).toEqual([ingresoModificado])
  })

  it('borde: actualizarIngreso con un id inexistente no modifica la lista', () => {
    const store = useIngresosStore()
    store.agregarIngreso(ingresoFalso)
    const ingresoInexistente: Ingreso = { ...ingresoFalso, id: 'no-existe', importe: 1 }

    store.actualizarIngreso(ingresoInexistente)

    expect(store.ingresos).toEqual([ingresoFalso])
  })

  it('camino feliz: quitarIngreso elimina el ingreso por id', () => {
    const store = useIngresosStore()
    store.agregarIngreso(ingresoFalso)

    store.quitarIngreso('i1')

    expect(store.ingresos).toEqual([])
  })

  it('borde: quitarIngreso con id inexistente no lanza error ni modifica la lista', () => {
    const store = useIngresosStore()
    store.agregarIngreso(ingresoFalso)

    store.quitarIngreso('no-existe')

    expect(store.ingresos).toEqual([ingresoFalso])
  })

  it('camino feliz: agregarBanco añade el nuevo banco al final de la lista', () => {
    const store = useIngresosStore()
    const otroBanco: Banco = { ...bancoFalso, id: 'b2', nombre: 'Interbank' }
    store.establecerBancos([bancoFalso])

    store.agregarBanco(otroBanco)

    expect(store.bancos).toEqual([bancoFalso, otroBanco])
  })

  it('riesgo: dos cargas concurrentes comparten el store; `cargando` sigue true mientras una siga en vuelo', () => {
    // `IngresosView.onMounted` dispara `cargarIngresos` y `cargarBancos` sobre
    // el MISMO `useIngresosStore`, sin `await` entre ellas. Cada una hace
    // `establecerCargando(true)` al entrar y `establecerCargando(false)` en su
    // propio `finally`. Con un booleano plano, la primera en terminar apagaba
    // `cargando` aunque la otra siguiera en vuelo. Aquí se simulan las dos
    // entradas y se libera solo una: `cargando` debe seguir en `true`.
    const store = useIngresosStore()

    store.establecerCargando(true) // entra cargarIngresos
    store.establecerCargando(true) // entra cargarBancos (concurrente)
    expect(store.cargando).toBe(true)

    store.establecerCargando(false) // termina cargarBancos; cargarIngresos sigue en vuelo
    expect(store.cargando).toBe(true)

    store.establecerCargando(false) // termina cargarIngresos
    expect(store.cargando).toBe(false)
  })

  it('borde: establecerCargando(false) de más no baja el contador por debajo de 0', () => {
    const store = useIngresosStore()

    store.establecerCargando(false)
    expect(store.cargando).toBe(false)

    // Una nueva carga real sí debe volver a marcar `cargando`, no quedar
    // atrapada por un contador negativo.
    store.establecerCargando(true)
    expect(store.cargando).toBe(true)
  })

  it('riesgo: con dos fallos concurrentes, establecerError conserva el mensaje del PRIMERO', () => {
    const store = useIngresosStore()

    store.establecerError('No se pudieron cargar los ingresos.')
    store.establecerError('No se pudieron cargar los bancos.')

    expect(store.error).toBe('No se pudieron cargar los ingresos.')
  })

  it('camino feliz: limpiarError despeja el error para que un intento nuevo pueda reportar el suyo', () => {
    const store = useIngresosStore()
    store.establecerError('No se pudieron cargar los ingresos.')

    store.limpiarError()
    store.establecerError('No se pudieron cargar los bancos.')

    expect(store.error).toBe('No se pudieron cargar los bancos.')
  })
})
