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
    expect(encabezados).toEqual(['Fecha', 'Descripción', 'Categoría', 'Banco', 'Monto'])
  })

  it('el header sr-only "Acciones" vive en la cabecera del carril lateral, no en la tabla de datos', () => {
    const wrapper = montar()

    expect(wrapper.find('.carril-acciones-cabecera').text()).toBe('Acciones')
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

  it('acción editar: clic en "⋮" abre el menú y clic en "Editar" emite editar con el id de la fila', async () => {
    const wrapper = montar()

    // El control se mudó al carril lateral (fuera de la tabla) en escritorio,
    // así que se localiza por `.celda-acciones[data-fila-id]` a nivel del
    // wrapper completo, ya no scopeado dentro de un `tbody tr`.
    const celdaTaxi = wrapper.find('.celda-acciones[data-fila-id="m2"]')
    await celdaTaxi.find('.boton-menu-acciones').trigger('click')
    await celdaTaxi.find('.boton-editar').trigger('click')

    expect(wrapper.emitted('editar')).toEqual([['m2']])
  })

  it('accesibilidad: el botón "⋮" lleva aria-label descriptivo y expone aria-haspopup/aria-expanded', async () => {
    const wrapper = montar()

    const boton = wrapper.find('.boton-menu-acciones')
    expect(boton.attributes('aria-label')).toContain('Más acciones')
    expect(boton.attributes('aria-haspopup')).toBe('true')
    expect(boton.attributes('aria-expanded')).toBe('false')

    await boton.trigger('click')
    expect(boton.attributes('aria-expanded')).toBe('true')
  })

  it('accesibilidad: los ítems del menú llevan aria-label descriptivo (afordancia por ícono, sin texto visible)', async () => {
    const wrapper = montar()

    await wrapper.find('.boton-menu-acciones').trigger('click')

    expect(wrapper.find('.boton-editar').attributes('aria-label')).toBe('Editar movimiento')
    expect(wrapper.find('.boton-eliminar').attributes('aria-label')).toBe('Eliminar movimiento')
  })

  it('acción eliminar: clic en "⋮" abre el menú y clic en "Eliminar" emite eliminar con el id de la fila', async () => {
    const wrapper = montar()

    const celdaTaxi = wrapper.find('.celda-acciones[data-fila-id="m2"]')
    await celdaTaxi.find('.boton-menu-acciones').trigger('click')
    await celdaTaxi.find('.boton-eliminar').trigger('click')

    expect(wrapper.emitted('eliminar')).toEqual([['m2']])
  })

  it('menú de acciones: el menú no está en el DOM hasta que se hace clic en "⋮"', () => {
    const wrapper = montar()

    expect(wrapper.find('.menu-acciones-fila').exists()).toBe(false)
  })

  it('menú de acciones: abrir el menú de una fila cierra el de otra fila si ya estaba abierto', async () => {
    const wrapper = montar()

    // Localizados por `data-fila-id` a nivel wrapper: el control vive en el
    // carril lateral (fuera del `tbody tr`) en escritorio.
    const celdaAlmuerzo = wrapper.find('.celda-acciones[data-fila-id="m1"]')
    const celdaTaxi = wrapper.find('.celda-acciones[data-fila-id="m2"]')

    await celdaAlmuerzo.find('.boton-menu-acciones').trigger('click')
    expect(celdaAlmuerzo.find('.menu-acciones-fila').exists()).toBe(true)
    expect(celdaTaxi.find('.menu-acciones-fila').exists()).toBe(false)

    await celdaTaxi.find('.boton-menu-acciones').trigger('click')
    expect(celdaAlmuerzo.find('.menu-acciones-fila').exists()).toBe(false)
    expect(celdaTaxi.find('.menu-acciones-fila').exists()).toBe(true)
  })

  it('menú de acciones: clic de nuevo en "⋮" de la misma fila cierra el menú (toggle)', async () => {
    const wrapper = montar()

    const boton = wrapper.find('.boton-menu-acciones')
    await boton.trigger('click')
    expect(wrapper.find('.menu-acciones-fila').exists()).toBe(true)

    await boton.trigger('click')
    expect(wrapper.find('.menu-acciones-fila').exists()).toBe(false)
  })

  it('menú de acciones: seleccionar "Editar" cierra el menú luego de emitir el evento', async () => {
    const wrapper = montar()

    await wrapper.find('.boton-menu-acciones').trigger('click')
    await wrapper.find('.boton-editar').trigger('click')

    expect(wrapper.find('.menu-acciones-fila').exists()).toBe(false)
  })

  it('responsive: cada celda lleva `data-etiqueta` para el colapso a tarjetas apiladas en pantallas angostas', () => {
    const wrapper = montar()

    // En escritorio (default de jsdom, sin `matchMedia`) Acciones ya no es un
    // `<td>` de la tabla de datos: vive en el carril lateral.
    const primeraFila = wrapper.findAll('tbody tr')[0]
    const etiquetas = primeraFila.findAll('td').map((td) => td.attributes('data-etiqueta'))
    expect(etiquetas).toEqual(['Fecha', 'Descripción', 'Categoría', 'Banco', 'Monto'])
  })

  it('invariante estructural: el control de acciones NO es descendiente del contenedor con scroll horizontal', () => {
    const wrapper = montar()

    expect(wrapper.find('.envoltorio-datos').find('.boton-menu-acciones').exists()).toBe(false)
    expect(wrapper.find('.carril-acciones .boton-menu-acciones').exists()).toBe(true)
  })
})
