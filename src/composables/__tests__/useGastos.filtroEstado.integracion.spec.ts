import { beforeEach, describe, expect, it, type Mock } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useGastos } from '@/composables/useGastos'
import { useBandeja } from '@/composables/useBandeja'
import { useGastosStore } from '@/stores/gastos'
import { supabase } from '@/lib/supabaseClient'
import type { Gasto } from '@/types/gasto'

/**
 * Prueba de integración INDEPENDIENTE (no escrita por dev-builder) del
 * ajuste colateral de la Épica 5 sobre `useGastos`: el Historial debe filtrar
 * `estado='confirmado'` y por tanto excluir 'borrador'/'revision_manual'/
 * 'descartado'. A diferencia de un test que solo verifica que se llamó
 * `eq('estado', 'confirmado')` con los argumentos correctos (confiando en
 * que Supabase filtra bien), este mock SIMULA el filtrado real de Postgres
 * sobre un dataset mixto, para detectar el caso en que el código ignorase el
 * resultado del `.eq(...)` y mostrara igual todos los estados.
 */
const fromMock = supabase.from as unknown as Mock

const datasetMixto: Gasto[] = [
  {
    id: 'confirmado-1',
    usuario_id: 'u1',
    categoria_id: 'c1',
    banco_id: 'b1',
    monto: 10,
    moneda: 'PEN',
    fecha: '2026-07-01',
    descripcion: 'Confirmado manual',
    origen: 'manual',
    estado: 'confirmado',
    gmail_message_id: null,
    gmail_fragmento: null,
    creado_en: '',
    actualizado_en: '',
  },
  {
    id: 'confirmado-correo-1',
    usuario_id: 'u1',
    categoria_id: 'c1',
    banco_id: 'b1',
    monto: 20,
    moneda: 'PEN',
    fecha: '2026-07-02',
    descripcion: 'Confirmado desde correo',
    origen: 'correo',
    estado: 'confirmado',
    gmail_message_id: 'msg-confirmado',
    gmail_fragmento: null,
    creado_en: '',
    actualizado_en: '',
  },
  {
    id: 'borrador-1',
    usuario_id: 'u1',
    categoria_id: 'c1',
    banco_id: 'b1',
    monto: 30,
    moneda: 'PEN',
    fecha: '2026-07-03',
    descripcion: 'Pendiente de confirmar',
    origen: 'correo',
    estado: 'borrador',
    gmail_message_id: 'msg-borrador',
    gmail_fragmento: null,
    creado_en: '',
    actualizado_en: '',
  },
  {
    id: 'revision-1',
    usuario_id: 'u1',
    categoria_id: 'c1',
    banco_id: 'b1',
    monto: null,
    moneda: null,
    fecha: '2026-07-04',
    descripcion: 'Requiere revisión',
    origen: 'correo',
    estado: 'revision_manual',
    gmail_message_id: 'msg-revision',
    gmail_fragmento: null,
    creado_en: '',
    actualizado_en: '',
  },
  {
    id: 'descartado-1',
    usuario_id: 'u1',
    categoria_id: 'c1',
    banco_id: 'b1',
    monto: 40,
    moneda: 'PEN',
    fecha: '2026-07-05',
    descripcion: 'Descartado',
    origen: 'correo',
    estado: 'descartado',
    gmail_message_id: 'msg-descartado',
    gmail_fragmento: null,
    creado_en: '',
    actualizado_en: '',
  },
]

/**
 * Builder que simula el comportamiento real de PostgREST: `.eq('estado', v)`
 * de verdad filtra el dataset en memoria; `.in('estado', [...])` de verdad
 * filtra por pertenencia; `.order(...)` de verdad ordena. Si `useGastos` o
 * `useBandeja` dejaran de aplicar el filtro (o lo aplicaran mal), este mock
 * lo reflejaría en el resultado, a diferencia de un mock que solo devuelve
 * un fixture fijo sin importar los argumentos.
 */
function crearBuilderFiltradoReal(datosIniciales: Gasto[]) {
  let filas = [...datosIniciales]
  const builder = {
    select: () => builder,
    eq: (campo: string, valor: unknown) => {
      filas = filas.filter((f) => (f as unknown as Record<string, unknown>)[campo] === valor)
      return builder
    },
    in: (campo: string, valores: unknown[]) => {
      filas = filas.filter((f) => valores.includes((f as unknown as Record<string, unknown>)[campo]))
      return builder
    },
    order: (campo: string, opciones: { ascending: boolean }) => {
      const ordenadas = [...filas].sort((a, b) => {
        const va = (a as unknown as Record<string, string>)[campo]
        const vb = (b as unknown as Record<string, string>)[campo]
        return opciones.ascending ? va.localeCompare(vb) : vb.localeCompare(va)
      })
      return Promise.resolve({ data: ordenadas, error: null })
    },
  }
  return builder
}

describe('Filtro de estado del Historial vs. la Bandeja (integración con dataset mixto)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('useGastos.cargarGastos SOLO trae estado=confirmado: excluye borrador, revision_manual y descartado', async () => {
    fromMock.mockReturnValueOnce(crearBuilderFiltradoReal(datasetMixto))

    const { cargarGastos } = useGastos()
    const store = useGastosStore()
    const exito = await cargarGastos()

    expect(exito).toBe(true)
    const idsCargados = store.gastos.map((g) => g.id).sort()
    expect(idsCargados).toEqual(['confirmado-1', 'confirmado-correo-1'])
    expect(store.gastos.every((g) => g.estado === 'confirmado')).toBe(true)
    // Ningún borrador, revisión manual ni descartado se filtra al Historial.
    expect(store.gastos.find((g) => g.estado === 'borrador')).toBeUndefined()
    expect(store.gastos.find((g) => g.estado === 'revision_manual')).toBeUndefined()
    expect(store.gastos.find((g) => (g as Gasto).estado === 'descartado')).toBeUndefined()
  })

  it('useBandeja.cargarBorradores SOLO trae borrador/revision_manual: excluye confirmados y descartados', async () => {
    fromMock.mockReturnValueOnce(crearBuilderFiltradoReal(datasetMixto))

    const { cargarBorradores } = useBandeja()
    const store = useGastosStore()
    const exito = await cargarBorradores()

    expect(exito).toBe(true)
    const idsCargados = store.borradores.map((b) => b.id).sort()
    expect(idsCargados).toEqual(['borrador-1', 'revision-1'])
    expect(store.borradores.find((b) => b.estado === 'confirmado')).toBeUndefined()
    expect(store.borradores.find((b) => (b as Gasto).estado === 'descartado')).toBeUndefined()
  })
})
