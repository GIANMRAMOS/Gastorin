<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import ModalIngreso from '@/components/ModalIngreso.vue'
import DialogoConfirmacion from '@/components/DialogoConfirmacion.vue'
import FiltrosIngresos from '@/components/FiltrosIngresos.vue'
import TarjetaKpi from '@/components/TarjetaKpi.vue'
import ListaGastoPorCategoria from '@/components/ListaGastoPorCategoria.vue'
import TablaMovimientos, { type FilaMovimiento } from '@/components/TablaMovimientos.vue'
import ToggleMoneda from '@/components/ToggleMoneda.vue'
import { useIngresos } from '@/composables/useIngresos'
import { useCategorias } from '@/composables/useCategorias'
import { useBancos } from '@/composables/useBancos'
import { useIngresosStore } from '@/stores/ingresos'
import { useGastosStore } from '@/stores/gastos'
import { useMoneda } from '@/composables/useMoneda'
import { formatearMes } from '@/composables/useFechas'
import type { Ingreso } from '@/types/ingreso'
import type { Moneda } from '@/types/gasto'

/**
 * "Ingresos" (rediseño "Caudal", Fase 2): mismo lenguaje visual que Egresos
 * (`HistorialView`) — header con subtítulo del mes + toggle de moneda,
 * filtros (moneda/buscador/categoría/banco/mes), 3 `TarjetaKpi` (Total del
 * mes / En dólares / Mayor ingreso), `TablaMovimientos` y un sidebar con
 * "Registrar" + "Por categoría". Reemplaza la lista-de-tarjetas agrupada por
 * día y el desglose `saldosPorBanco`/"sin banco asignado" de la Fase 1 (ver
 * "Sugerencias fuera de alcance" del micro-plan: el nuevo diseño no lo
 * contempla). Cubre además el alta, edición y eliminación de ingresos
 * (Épica 11) y, desde la migración 008 (Épica 12), la categoría propia de
 * Ingreso.
 */
const { cargarIngresos, eliminarIngreso } = useIngresos()
const { cargarCategorias } = useCategorias()
const { cargarBancos } = useBancos()
const storeIngresos = useIngresosStore()
const storeGastos = useGastosStore()
const { formatearMonto, totalesPorCategoria } = useMoneda()

const modalAbierto = ref(false)
const ingresoEnEdicion = ref<Ingreso | null>(null)
const ingresoAEliminar = ref<Ingreso | null>(null)

/** Filtros de UI de Ingresos (estado local de la vista, no del store). */
const monedaFiltro = ref<'todos' | Moneda>('todos')
const categoriaFiltro = ref('')
const bancoFiltro = ref('')
const mesFiltro = ref(mesActualISO())
const busquedaFiltro = ref('')

/** Moneda que gobierna las 3 stat cards y el sidebar "Por categoría" (independiente de los chips de la fila de filtros, que solo filtran la tabla). */
const monedaSeleccionada = ref<Moneda>('PEN')

onMounted(() => {
  cargarCategorias()
  cargarBancos()
  cargarIngresos()
})

/** Prefijo `YYYY-MM` del mes actual, en hora LOCAL (nunca `toISOString()`, ver `hoyISO` de `FormularioGasto.vue`). */
function mesActualISO(): string {
  const ahora = new Date()
  const anio = ahora.getFullYear()
  const mes = String(ahora.getMonth() + 1).padStart(2, '0')
  return `${anio}-${mes}`
}

/** Categorías de INGRESO activas (blindaje: `storeGastos.categorias` es una bolsa mixta de ambos tipos desde la migración 008). */
const categoriasIngreso = computed(() => storeGastos.categorias.filter((c) => c.tipo === 'ingreso'))

/** Nombre del banco de un ingreso (para mostrarlo en la fila de la tabla). */
function nombreBanco(bancoId: string): string {
  return storeIngresos.bancos.find((banco) => banco.id === bancoId)?.nombre ?? 'Sin banco'
}

/** Nombre de la categoría de un ingreso (para mostrarlo en la fila y en el "por categoría"). */
function nombreCategoria(categoriaId: string): string {
  return storeGastos.categorias.find((c) => c.id === categoriaId)?.nombre ?? 'Sin categoría'
}

/** Meses (`YYYY-MM`) con al menos un ingreso, más el mes actual (para que el selector siempre pueda mostrarlo aunque no tenga movimientos todavía), únicos y ordenados descendente. */
const mesesDisponibles = computed(() => {
  const meses = new Set(storeIngresos.ingresos.map((ingreso) => ingreso.fecha.slice(0, 7)))
  meses.add(mesActualISO())
  return [...meses].sort((a, b) => b.localeCompare(a))
})

/** No hay ningún ingreso registrado (estado vacío genérico). */
const sinIngresos = computed(() => storeIngresos.ingresos.length === 0)

/**
 * Ingresos del mes seleccionado (o de TODOS si "mes" = "Todos los meses"),
 * SIN aplicar el resto de los filtros: base de las 3 stat cards, el
 * subtítulo del encabezado y el "por categoría".
 */
const ingresosDelMes = computed(() =>
  storeIngresos.ingresos.filter(
    (ingreso) => !mesFiltro.value || ingreso.fecha.slice(0, 7) === mesFiltro.value,
  ),
)

/** Ingresos del mes que además cumplen moneda/categoría/banco/búsqueda: fuente de la tabla. */
const ingresosFiltrados = computed(() => {
  const busqueda = busquedaFiltro.value.trim().toLowerCase()
  return ingresosDelMes.value.filter((ingreso) => {
    const cumpleMoneda = monedaFiltro.value === 'todos' || ingreso.moneda === monedaFiltro.value
    const cumpleCategoria = !categoriaFiltro.value || ingreso.categoria_id === categoriaFiltro.value
    const cumpleBanco = !bancoFiltro.value || ingreso.banco_id === bancoFiltro.value
    const cumpleBusqueda = !busqueda || ingreso.concepto.toLowerCase().includes(busqueda)
    return cumpleMoneda && cumpleCategoria && cumpleBanco && cumpleBusqueda
  })
})

/** Hay ingresos en total, pero el filtro activo no encuentra ninguno (estado vacío específico). */
const sinResultadosPorFiltro = computed(() => !sinIngresos.value && ingresosFiltrados.value.length === 0)

/** Filas ya enriquecidas para `TablaMovimientos`. */
const filasTabla = computed<FilaMovimiento[]>(() =>
  ingresosFiltrados.value.map((ingreso) => ({
    id: ingreso.id,
    fecha: ingreso.fecha,
    descripcion: ingreso.concepto,
    nombreCategoria: nombreCategoria(ingreso.categoria_id),
    nombreBanco: nombreBanco(ingreso.banco_id),
    monto: ingreso.importe,
    moneda: ingreso.moneda,
  })),
)

/** Total del mes en PEN (para el subtítulo del encabezado, independiente de la moneda seleccionada). */
const totalPenDelMes = computed(() =>
  ingresosDelMes.value.filter((i) => i.moneda === 'PEN').reduce((total, i) => total + i.importe, 0),
)
/** Total del mes en USD (para el subtítulo del encabezado y para la 2ª stat card "En dólares"). */
const totalUsdDelMes = computed(() =>
  ingresosDelMes.value.filter((i) => i.moneda === 'USD').reduce((total, i) => total + i.importe, 0),
)

/** "S/ X + $ Y" (omite una moneda si su total es 0; si ambas son 0, muestra "S/ 0.00"). */
const textoTotalesDelMes = computed(() => {
  const partes: string[] = []
  if (totalPenDelMes.value > 0) partes.push(formatearMonto(totalPenDelMes.value, 'PEN'))
  if (totalUsdDelMes.value > 0) partes.push(formatearMonto(totalUsdDelMes.value, 'USD'))
  return partes.length > 0 ? partes.join(' + ') : formatearMonto(0, 'PEN')
})

/** Subtítulo del encabezado: "N movimientos en {Mes} {Año} · S/ X + $ Y". */
const subtituloEncabezado = computed(() => {
  const etiquetaMes = mesFiltro.value ? formatearMes(mesFiltro.value) : 'todos los períodos'
  return `${ingresosDelMes.value.length} movimientos en ${etiquetaMes} · ${textoTotalesDelMes.value}`
})

/** Ingresos del mes en la moneda del toggle del encabezado (base de "Total del mes" y "Mayor ingreso"). */
const ingresosDelMesEnMonedaSeleccionada = computed(() =>
  ingresosDelMes.value.filter((ingreso) => ingreso.moneda === monedaSeleccionada.value),
)

/** Total del mes en la moneda seleccionada (1ª stat card). */
const totalDelMes = computed(() =>
  ingresosDelMesEnMonedaSeleccionada.value.reduce((total, i) => total + i.importe, 0),
)

/** Ingreso de mayor monto del mes en la moneda seleccionada, o `null` si no hay ninguno (3ª stat card). */
const mayorIngreso = computed<Ingreso | null>(() =>
  ingresosDelMesEnMonedaSeleccionada.value.reduce<Ingreso | null>(
    (mayor, ingreso) => (mayor === null || ingreso.importe > mayor.importe ? ingreso : mayor),
    null,
  ),
)
const montoMayorIngreso = computed(() => mayorIngreso.value?.importe ?? 0)
const subtituloMayorIngreso = computed(() => mayorIngreso.value?.concepto)

/** "Por categoría" del sidebar: totales del mes por categoría, en la moneda seleccionada, sin excluir ninguna categoría. */
const porCategoria = computed(() =>
  totalesPorCategoria(
    ingresosDelMes.value.map((ingreso) => ({
      categoria_id: ingreso.categoria_id,
      nombre: nombreCategoria(ingreso.categoria_id),
      moneda: ingreso.moneda,
      monto: ingreso.importe,
    })),
    monedaSeleccionada.value,
  ),
)

/** Abre el modal en modo alta. */
function abrirModalAlta() {
  ingresoEnEdicion.value = null
  modalAbierto.value = true
}

/** Abre el modal en modo edición con el ingreso seleccionado prellenado. */
function abrirModalEdicion(ingreso: Ingreso) {
  ingresoEnEdicion.value = ingreso
  modalAbierto.value = true
}

/** Resuelve el id emitido por `TablaMovimientos` al ingreso real antes de abrir el modal de edición. */
function abrirModalEdicionPorId(id: string) {
  const ingreso = storeIngresos.ingresos.find((i) => i.id === id)
  if (ingreso) abrirModalEdicion(ingreso)
}

/** Cierra el modal de alta/edición sin guardar. */
function cerrarModal() {
  modalAbierto.value = false
  ingresoEnEdicion.value = null
}

/** Tras guardar (alta o edición), cierra el modal; la lista ya se actualizó en el store. */
function manejarGuardado() {
  cerrarModal()
}

/** Abre el diálogo de confirmación antes de eliminar. */
function pedirConfirmacionEliminar(ingreso: Ingreso) {
  ingresoAEliminar.value = ingreso
}

/** Resuelve el id emitido por `TablaMovimientos` al ingreso real antes de pedir confirmación. */
function pedirConfirmacionEliminarPorId(id: string) {
  const ingreso = storeIngresos.ingresos.find((i) => i.id === id)
  if (ingreso) pedirConfirmacionEliminar(ingreso)
}

/** Cancela la eliminación: no se borra nada. */
function cancelarEliminacion() {
  ingresoAEliminar.value = null
}

/** Confirma la eliminación del ingreso seleccionado. */
async function confirmarEliminacion() {
  if (!ingresoAEliminar.value) return
  await eliminarIngreso(ingresoAEliminar.value.id)
  ingresoAEliminar.value = null
}
</script>

<template>
  <main class="pagina-ingresos">
    <header class="encabezado-ingresos">
      <div class="titulo-encabezado">
        <h1>Ingresos</h1>
        <p class="subtitulo-encabezado">{{ subtituloEncabezado }}</p>
      </div>
      <div class="acciones-encabezado">
        <ToggleMoneda v-model="monedaSeleccionada" mostrar-simbolo />
        <button type="button" class="boton-registrar boton-nuevo" @click="abrirModalAlta">
          + Nuevo ingreso
        </button>
      </div>
    </header>

    <p v-if="storeIngresos.error" role="alert" class="mensaje-error">{{ storeIngresos.error }}</p>

    <FiltrosIngresos
      v-if="!sinIngresos"
      v-model:moneda="monedaFiltro"
      v-model:categoria-id="categoriaFiltro"
      v-model:banco-id="bancoFiltro"
      v-model:mes="mesFiltro"
      v-model:busqueda="busquedaFiltro"
      :categorias="categoriasIngreso"
      :bancos="storeIngresos.bancos"
      :meses-disponibles="mesesDisponibles"
    />

    <div v-if="!sinIngresos" class="fila-kpis">
      <TarjetaKpi label="Total del mes" :monto="totalDelMes" :moneda="monedaSeleccionada" variante="ingreso" />
      <TarjetaKpi label="En dólares" :monto="totalUsdDelMes" moneda="USD" variante="ingreso" />
      <TarjetaKpi
        label="Mayor ingreso"
        :monto="montoMayorIngreso"
        :moneda="monedaSeleccionada"
        variante="ingreso"
        :subtitulo="subtituloMayorIngreso"
      />
    </div>

    <div v-if="!sinIngresos" class="grid-ingresos">
      <section class="columna-tabla">
        <TablaMovimientos
          v-if="ingresosFiltrados.length > 0"
          :filas="filasTabla"
          :total-sin-filtrar="ingresosDelMes.length"
          @editar="abrirModalEdicionPorId"
          @eliminar="pedirConfirmacionEliminarPorId"
        />
        <div v-else-if="sinResultadosPorFiltro" class="estado-vacio estado-vacio-filtro">
          <span class="icono-vacio-filtro" aria-hidden="true">🔍</span>
          <p class="mensaje-vacio">Sin ingresos con este filtro</p>
          <p class="sugerencia-vacio">Prueba cambiar el filtro o registra el primer ingreso del mes.</p>
        </div>
      </section>

      <aside class="columna-lateral-ingresos">
        <div class="tarjeta-lateral tarjeta-registrar">
          <h2>Registrar un ingreso</h2>
          <button type="button" class="boton-primario boton-nuevo" @click="abrirModalAlta">
            + Nuevo ingreso
          </button>
        </div>
        <div class="tarjeta-lateral">
          <h2>Por categoría</h2>
          <ListaGastoPorCategoria :items="porCategoria" :moneda="monedaSeleccionada" />
        </div>
      </aside>
    </div>

    <div v-else class="estado-vacio estado-vacio-generico">
      <p class="mensaje-vacio">Todavía no hay ingresos registrados.</p>
      <button type="button" class="boton-primario boton-nuevo" @click="abrirModalAlta">
        Nuevo ingreso
      </button>
    </div>

    <ModalIngreso
      v-if="modalAbierto"
      :ingreso="ingresoEnEdicion"
      @cerrar="cerrarModal"
      @guardado="manejarGuardado"
    />

    <DialogoConfirmacion
      v-if="ingresoAEliminar"
      mensaje="¿Seguro que quieres eliminar este ingreso? Esta acción no se puede deshacer."
      @confirmar="confirmarEliminacion"
      @cancelar="cancelarEliminacion"
    />
  </main>
</template>

<style scoped>
.pagina-ingresos {
  max-width: 1080px;
  margin: 0 auto;
  padding: var(--espacio-6) var(--espacio-4);
}

.encabezado-ingresos {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--espacio-4);
  margin-bottom: var(--espacio-6);
  flex-wrap: wrap;
}

.titulo-encabezado h1 {
  margin: 0;
  font-weight: 600;
  font-size: 21px;
  letter-spacing: -0.02em;
}

.subtitulo-encabezado {
  margin: var(--espacio-1) 0 0;
  font-weight: 400;
  font-size: 12.5px;
  color: rgba(0, 0, 0, 0.5);
}

.acciones-encabezado {
  display: flex;
  align-items: center;
  gap: var(--espacio-3);
  flex-shrink: 0;
}

.boton-registrar {
  min-height: 40px;
  padding: 0 var(--espacio-4);
  background: #1a1a18;
  color: #fff;
  border: none;
  border-radius: 9px;
  font-weight: 600;
  font-size: var(--tamano-pequeno);
  cursor: pointer;
  font-family: var(--fuente-base);
  margin-top: 0;
}
.boton-registrar:hover {
  background: var(--color-primario-hover);
}

.fila-kpis {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-bottom: var(--espacio-4);
}

.grid-ingresos {
  display: grid;
  grid-template-columns: 1.55fr 1fr;
  gap: 16px;
  align-items: start;
}

.columna-tabla {
  background: var(--color-fondo);
  border: 1px solid var(--color-borde-tarjeta);
  border-radius: var(--radio-tarjeta);
  padding: var(--espacio-4);
  min-width: 0;
}

.columna-lateral-ingresos {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.tarjeta-lateral {
  background: var(--color-fondo);
  border: 1px solid var(--color-borde-tarjeta);
  border-radius: var(--radio-tarjeta);
  padding: var(--espacio-4);
}

.tarjeta-lateral h2 {
  margin: 0 0 var(--espacio-4);
  font-size: 1rem;
}

.tarjeta-registrar .boton-nuevo {
  width: 100%;
}

.estado-vacio {
  text-align: center;
  padding: var(--espacio-8) 0;
}

.mensaje-vacio {
  color: var(--color-texto-secundario);
  margin: 0 0 var(--espacio-3);
}

.estado-vacio-filtro .icono-vacio-filtro {
  display: block;
  font-size: 32px;
  margin-bottom: var(--espacio-2);
}

.sugerencia-vacio {
  color: var(--color-texto-terciario);
  font-size: var(--tamano-pequeno);
  margin: 0;
}

@media (max-width: 900px) {
  .fila-kpis {
    grid-template-columns: 1fr;
  }

  .grid-ingresos {
    grid-template-columns: 1fr;
  }
}
</style>
