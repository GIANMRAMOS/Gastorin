import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import TablaMovimientos, { type FilaMovimiento } from '@/components/TablaMovimientos.vue'

/**
 * Pruebas del componente presentacional puro `TablaMovimientos` (rediseño
 * "Caudal", Fase 2): reemplaza la lista-de-tarjetas agrupada por día,
 * compartido por Egresos e Ingresos. No calcula filtrado ni orden: `filas`
 * ya viene lista para pintar.
 */
const filasFalsas: FilaMovimiento[] = [
  {
    id: 'm1',
    fecha: '2026-07-10',
    descripcion: 'Almuerzo',
    nombreCategoria: 'Comida',
    nombreBanco: 'BCP',
    monto: 25.5,
    moneda: 'PEN',
  },
  {
    id: 'm2',
    fecha: '2026-07-05',
    descripcion: 'Taxi',
    nombreCategoria: 'Transporte',
    nombreBanco: 'Interbank',
    monto: 12,
    moneda: 'USD',
  },
]

function montar(filas: FilaMovimiento[] = filasFalsas, totalSinFiltrar = filas.length) {
  return mount(TablaMovimientos, { props: { filas, totalSinFiltrar } })
}

describe('TablaMovimientos', () => {
  it('camino feliz: pinta una fila por movimiento con fecha, descripción, categoría, banco y monto formateado', () => {
    const wrapper = montar()

    const filas = wrapper.findAll('tbody tr')
    expect(filas).toHaveLength(2)

    const filaAlmuerzo = filas.find((f) => f.text().includes('Almuerzo'))!
    expect(filaAlmuerzo.text()).toContain('2026-07-10')
    expect(filaAlmuerzo.text()).toContain('Comida')
    expect(filaAlmuerzo.text()).toContain('BCP')
    expect(filaAlmuerzo.text()).toContain('25.50')
    expect(filaAlmuerzo.text()).toContain('S/')
  })

  it('columnas de encabezado: Fecha, Descripción, Categoría, Banco y Monto', () => {
    const wrapper = montar()

    const encabezados = wrapper.findAll('thead th').map((th) => th.text())
    expect(encabezados).toEqual(['Fecha', 'Descripción', 'Categoría', 'Banco', 'Monto', 'Acciones'])
  })

  it('pie de tabla: "N de N movimientos" y el total por cada moneda presente en las filas mostradas', () => {
    const wrapper = montar()

    const pie = wrapper.find('tfoot')
    expect(pie.text()).toContain('2 de 2 movimientos')
    expect(pie.text()).toContain('S/')
    expect(pie.text()).toContain('25.50')
    expect(pie.text()).toContain('$')
    expect(pie.text()).toContain('12.00')
  })

  it('"N de N" refleja el total SIN filtrar cuando difiere del número de filas mostradas', () => {
    const wrapper = montar([filasFalsas[0]], 5)

    expect(wrapper.find('tfoot').text()).toContain('1 de 5 movimientos')
  })

  it('sin filas: no se renderiza el pie de totales', () => {
    const wrapper = montar([], 0)

    expect(wrapper.find('tfoot').exists()).toBe(false)
    expect(wrapper.findAll('tbody tr')).toHaveLength(0)
  })

  it('acción editar: clic en "Editar" emite editar con el id de la fila', async () => {
    const wrapper = montar()

    const filaTaxi = wrapper.findAll('tbody tr').find((f) => f.text().includes('Taxi'))!
    await filaTaxi.find('.boton-editar').trigger('click')

    expect(wrapper.emitted('editar')).toEqual([['m2']])
  })

  it('acción eliminar: clic en "×" emite eliminar con el id de la fila', async () => {
    const wrapper = montar()

    const filaTaxi = wrapper.findAll('tbody tr').find((f) => f.text().includes('Taxi'))!
    await filaTaxi.find('.boton-eliminar').trigger('click')

    expect(wrapper.emitted('eliminar')).toEqual([['m2']])
  })

  it('responsive: cada celda lleva `data-etiqueta` para el colapso a tarjetas apiladas en pantallas angostas', () => {
    const wrapper = montar()

    const primeraFila = wrapper.findAll('tbody tr')[0]
    const etiquetas = primeraFila.findAll('td').map((td) => td.attributes('data-etiqueta'))
    expect(etiquetas).toEqual(['Fecha', 'Descripción', 'Categoría', 'Banco', 'Monto', 'Acciones'])
  })
})
