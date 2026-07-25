import { beforeEach, describe, expect, it, type Mock } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PresupuestosView from '@/views/PresupuestosView.vue'
import { useGastosStore } from '@/stores/gastos'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabaseClient'
import { crearConstructorConsulta } from '@/lib/__mocks__/supabaseClient'
import type { Categoria, Gasto, Presupuesto } from '@/types/gasto'
import type { MetaAhorro } from '@/types/metaAhorro'

const fromMock = supabase.from as unknown as Mock

const categoriaComida: Categoria = {
  id: 'c1',
  usuario_id: 'u1',
  nombre: 'Comida',
  tipo: 'gasto',
  predefinida: true,
  activa: true,
  creado_en: '',
  abreviatura: 'C',
}

const mesActual = `${new Date().toISOString().slice(0, 7)}-01`

const presupuestoBase: Presupuesto = {
  id: 'p1',
  usuario_id: 'u1',
  categoria_id: 'c1',
  mes: mesActual,
  moneda: 'PEN',
  monto_limite: 500,
  creado_en: '',
}

const metaBase: MetaAhorro = {
  usuario_id: 'u1',
  descripcion: 'Viaje 2027',
  monto: 5000,
  actualizado_en: '',
}

function gastoDe(monto: number): Gasto {
  return {
    id: 'g1',
    usuario_id: 'u1',
    categoria_id: 'c1',
    banco_id: 'b1',
    monto,
    moneda: 'PEN',
    fecha: `${mesActual.slice(0, 7)}-10`,
    descripcion: null,
    origen: 'manual',
    estado: 'confirmado',
    gmail_message_id: null,
    gmail_fragmento: null,
    creado_en: '',
    actualizado_en: '',
  }
}

/**
 * `onMounted` dispara, en este orden y sin `await` entre ellas:
 * `cargarCategorias`, `cargarGastos`, `cargarPresupuestos`, `cargarMeta` y
 * `cargarPresupuestosMesAnterior`.
 */
function prepararCargaInicial(
  categorias: Categoria[],
  gastos: Gasto[],
  presupuestos: Presupuesto[],
  meta: MetaAhorro | null = null,
  presupuestosMesAnterior: Presupuesto[] = [],
) {
  const builderCategorias = crearConstructorConsulta()
  const builderGastos = crearConstructorConsulta()
  const builderPresupuestos = crearConstructorConsulta()
  const builderMeta = crearConstructorConsulta()
  const builderPresupuestosMesAnterior = crearConstructorConsulta()
  fromMock
    .mockReturnValueOnce(builderCategorias)
    .mockReturnValueOnce(builderGastos)
    .mockReturnValueOnce(builderPresupuestos)
    .mockReturnValueOnce(builderMeta)
    .mockReturnValueOnce(builderPresupuestosMesAnterior)
  ;(builderCategorias.order as Mock).mockResolvedValueOnce({ data: categorias, error: null })
  ;(builderGastos.order as Mock).mockResolvedValueOnce({ data: gastos, error: null })
  ;(builderPresupuestos.eq as Mock).mockResolvedValueOnce({ data: presupuestos, error: null })
  ;(builderMeta.maybeSingle as Mock).mockResolvedValueOnce({ data: meta, error: null })
  ;(builderPresupuestosMesAnterior.eq as Mock).mockResolvedValueOnce({
    data: presupuestosMesAnterior,
    error: null,
  })
}

async function esperarCargaInicial(wrapper: ReturnType<typeof mount>) {
  await new Promise((r) => setTimeout(r, 0))
  await wrapper.vm.$nextTick()
}

describe('PresupuestosView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const authStore = useAuthStore()
    authStore.establecerUsuario({ id: 'u1', email: 'a@a.com' } as never)
  })

  it('onMounted dispara las 5 cargas (categorías, gastos, presupuestos, meta, presupuestos del mes anterior)', async () => {
    prepararCargaInicial([categoriaComida], [], [presupuestoBase])

    mount(PresupuestosView)
    await new Promise((r) => setTimeout(r, 0))

    expect(fromMock).toHaveBeenCalledWith('categorias')
    expect(fromMock).toHaveBeenCalledWith('gastos')
    expect(fromMock).toHaveBeenCalledWith('presupuestos')
    expect(fromMock).toHaveBeenCalledWith('metas_ahorro')
  })

  it('con presupuestos y meta configurada: muestra el hero, las 4 stat cards y una fila por categoría', async () => {
    prepararCargaInicial([categoriaComida], [gastoDe(100), gastoDe(50)], [presupuestoBase], metaBase)

    const wrapper = mount(PresupuestosView)
    await esperarCargaInicial(wrapper)

    expect(wrapper.findComponent({ name: 'HeroPresupuesto' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'HeroPresupuesto' }).props('gastado')).toBe(150)
    expect(wrapper.findAllComponents({ name: 'TarjetaStatPresupuesto' })).toHaveLength(2)
    expect(wrapper.findAllComponents({ name: 'FilaCategoriaPresupuesto' })).toHaveLength(1)
    // Sin meta configurada habría un EstadoVacioCta dentro de la stat de ahorro (ver test dedicado);
    // con meta ya configurada, ningún estado vacío debería aparecer en la página.
    expect(wrapper.findComponent({ name: 'EstadoVacioCta' }).exists()).toBe(false)
  })

  it('sin presupuestos en la moneda activa: muestra EstadoVacioCta en vez del hero/grid/filas', async () => {
    prepararCargaInicial([categoriaComida], [], [])

    const wrapper = mount(PresupuestosView)
    await esperarCargaInicial(wrapper)

    expect(wrapper.findComponent({ name: 'HeroPresupuesto' }).exists()).toBe(false)
    const cta = wrapper.findComponent({ name: 'EstadoVacioCta' })
    expect(cta.exists()).toBe(true)
    expect(cta.props('etiquetaBoton')).toBe('Configura tu primer presupuesto')
  })

  it('el botón "+ Nuevo presupuesto" abre ModalPresupuesto en modo alta', async () => {
    prepararCargaInicial([categoriaComida], [], [])

    const wrapper = mount(PresupuestosView)
    await esperarCargaInicial(wrapper)

    await wrapper.find('.boton-nuevo').trigger('click')

    const modal = wrapper.findComponent({ name: 'ModalPresupuesto' })
    expect(modal.exists()).toBe(true)
    expect(modal.props('presupuesto')).toBeNull()
  })

  it('emitir "editar" desde una fila abre ModalPresupuesto con el presupuesto de esa categoría', async () => {
    prepararCargaInicial([categoriaComida], [], [presupuestoBase])

    const wrapper = mount(PresupuestosView)
    await esperarCargaInicial(wrapper)

    await wrapper.findComponent({ name: 'FilaCategoriaPresupuesto' }).vm.$emit('editar', 'c1')
    await wrapper.vm.$nextTick()

    const modal = wrapper.findComponent({ name: 'ModalPresupuesto' })
    expect(modal.exists()).toBe(true)
    expect(modal.props('presupuesto')).toEqual(presupuestoBase)
  })

  it('pedir-eliminar desde el modal abre DialogoConfirmacion; confirmar llama a eliminarPresupuesto', async () => {
    prepararCargaInicial([categoriaComida], [], [presupuestoBase])

    const wrapper = mount(PresupuestosView)
    await esperarCargaInicial(wrapper)

    await wrapper.findComponent({ name: 'FilaCategoriaPresupuesto' }).vm.$emit('editar', 'c1')
    await wrapper.vm.$nextTick()
    await wrapper.findComponent({ name: 'ModalPresupuesto' }).vm.$emit('pedir-eliminar')
    await wrapper.vm.$nextTick()

    expect(wrapper.findComponent({ name: 'DialogoConfirmacion' }).exists()).toBe(true)

    const builderEliminar = crearConstructorConsulta()
    fromMock.mockReturnValueOnce(builderEliminar)
    ;(builderEliminar.eq as Mock).mockResolvedValueOnce({ error: null })

    await wrapper.find('.dialogo-acciones .boton-primario').trigger('click')
    await new Promise((r) => setTimeout(r, 0))
    await wrapper.vm.$nextTick()

    const store = useGastosStore()
    expect(store.presupuestos).toEqual([])
  })

  it('sin meta de ahorro: la stat de "Ahorro comprometido" muestra EstadoVacioCta', async () => {
    prepararCargaInicial([categoriaComida], [], [presupuestoBase], null)

    const wrapper = mount(PresupuestosView)
    await esperarCargaInicial(wrapper)

    const ctas = wrapper.findAllComponents({ name: 'EstadoVacioCta' })
    const ctaMeta = ctas.find((cta) => cta.props('etiquetaBoton') === 'Configura tu meta de ahorro')
    expect(ctaMeta).toBeTruthy()
  })

  it('con meta de ahorro configurada: la tarjeta muestra el monto y es clickable para editar', async () => {
    prepararCargaInicial([categoriaComida], [], [presupuestoBase], metaBase)

    const wrapper = mount(PresupuestosView)
    await esperarCargaInicial(wrapper)

    expect(wrapper.find('.tarjeta-meta-clickable').exists()).toBe(true)
    const tarjetas = wrapper.findAllComponents({ name: 'TarjetaKpi' })
    const tarjetaMeta = tarjetas.find((t) => t.props('label') === 'Ahorro comprometido')
    expect(tarjetaMeta?.props('monto')).toBe(5000)

    await wrapper.find('.tarjeta-meta-clickable').trigger('click')
    expect(wrapper.findComponent({ name: 'ModalMetaAhorro' }).exists()).toBe(true)
  })

  it('"Ahorro comprometido" ignora el toggle de moneda del encabezado: sigue en PEN al cambiar a USD', async () => {
    // Presupuestos en AMBAS monedas para que el grid siga visible tras
    // cambiar el toggle (si solo hubiera PEN, el cambio a USD caería al
    // estado vacío general y no probaría nada sobre la tarjeta de meta).
    const presupuestoUsd: Presupuesto = { ...presupuestoBase, id: 'p2', moneda: 'USD', categoria_id: 'c1' }
    prepararCargaInicial([categoriaComida], [], [presupuestoBase, presupuestoUsd], metaBase)

    const wrapper = mount(PresupuestosView)
    await esperarCargaInicial(wrapper)

    const tarjetaMetaAntes = wrapper
      .findAllComponents({ name: 'TarjetaKpi' })
      .find((t) => t.props('label') === 'Ahorro comprometido')
    expect(tarjetaMetaAntes?.props('moneda')).toBe('PEN')

    await wrapper.findComponent({ name: 'ToggleMoneda' }).vm.$emit('update:modelValue', 'USD')
    await wrapper.vm.$nextTick()

    // El hero SÍ cambia de moneda (respeta el toggle, regla dura del brief)...
    expect(wrapper.findComponent({ name: 'HeroPresupuesto' }).props('moneda')).toBe('USD')
    // ...pero "Ahorro comprometido" se queda fija en PEN pese al toggle.
    const tarjetaMetaDespues = wrapper
      .findAllComponents({ name: 'TarjetaKpi' })
      .find((t) => t.props('label') === 'Ahorro comprometido')
    expect(tarjetaMetaDespues?.props('moneda')).toBe('PEN')
  })

  it('mes anterior sin presupuestos: el botón "Copiar" queda deshabilitado', async () => {
    prepararCargaInicial([categoriaComida], [], [presupuestoBase], null, [])

    const wrapper = mount(PresupuestosView)
    await esperarCargaInicial(wrapper)

    const boton = wrapper.find('.boton-copiar-mes-anterior')
    expect((boton.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('mes anterior CON presupuestos: el botón "Copiar" está habilitado', async () => {
    const presupuestoMesAnterior: Presupuesto = { ...presupuestoBase, id: 'anterior-1', categoria_id: 'c2' }
    prepararCargaInicial([categoriaComida], [], [presupuestoBase], null, [presupuestoMesAnterior])

    const wrapper = mount(PresupuestosView)
    await esperarCargaInicial(wrapper)

    const boton = wrapper.find('.boton-copiar-mes-anterior')
    expect((boton.element as HTMLButtonElement).disabled).toBe(false)
  })

  it('regresión (QA independiente): con store.cargando=true, el botón "Copiar" se deshabilita aunque haya presupuestos del mes anterior (evita el doble click accidental)', async () => {
    const presupuestoMesAnterior: Presupuesto = { ...presupuestoBase, id: 'anterior-1', categoria_id: 'c2' }
    prepararCargaInicial([categoriaComida], [], [presupuestoBase], null, [presupuestoMesAnterior])

    const wrapper = mount(PresupuestosView)
    await esperarCargaInicial(wrapper)

    const store = useGastosStore()
    store.establecerCargando(true)
    await wrapper.vm.$nextTick()

    const boton = wrapper.find('.boton-copiar-mes-anterior')
    expect((boton.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('muestra store.error en un p[role=alert]', async () => {
    const builderCategorias = crearConstructorConsulta()
    const builderGastos = crearConstructorConsulta()
    const builderPresupuestos = crearConstructorConsulta()
    fromMock
      .mockReturnValueOnce(builderCategorias)
      .mockReturnValueOnce(builderGastos)
      .mockReturnValueOnce(builderPresupuestos)
    ;(builderCategorias.order as Mock).mockResolvedValueOnce({ data: [], error: null })
    ;(builderGastos.order as Mock).mockResolvedValueOnce({ data: [], error: null })
    ;(builderPresupuestos.eq as Mock).mockResolvedValueOnce({ data: null, error: { message: 'boom' } })

    const builderMeta = crearConstructorConsulta()
    const builderPresupuestosMesAnterior = crearConstructorConsulta()
    fromMock.mockReturnValueOnce(builderMeta).mockReturnValueOnce(builderPresupuestosMesAnterior)
    ;(builderMeta.maybeSingle as Mock).mockResolvedValueOnce({ data: null, error: null })
    ;(builderPresupuestosMesAnterior.eq as Mock).mockResolvedValueOnce({ data: [], error: null })

    const wrapper = mount(PresupuestosView)
    await esperarCargaInicial(wrapper)

    expect(wrapper.find('[role="alert"]').text()).toBe('No se pudieron cargar los presupuestos.')
  })
})
