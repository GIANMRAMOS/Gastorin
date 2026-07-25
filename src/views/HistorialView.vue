<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import ModalGasto from '@/components/ModalGasto.vue'
import DialogoConfirmacion from '@/components/DialogoConfirmacion.vue'
import FiltrosHistorial from '@/components/FiltrosHistorial.vue'
import TarjetaKpi from '@/components/TarjetaKpi.vue'
import ListaGastoPorCategoria from '@/components/ListaGastoPorCategoria.vue'
import TablaMovimientos, { type FilaMovimiento } from '@/components/TablaMovimientos.vue'
import ToggleMoneda from '@/components/ToggleMoneda.vue'
import { useGastos } from '@/composables/useGastos'
import { useCategorias } from '@/composables/useCategorias'
import { useBancos } from '@/composables/useBancos'
import { useGastosStore } from '@/stores/gastos'
import { useIngresosStore } from '@/stores/ingresos'
import { useMoneda } from '@/composables/useMoneda'
import { formatearMes } from '@/composables/useFechas'
import type { Gasto, Moneda } from '@/types/gasto'

/**
 * "Egresos" (rediseño "Caudal", Fase 2; ruta y nombre de archivo siguen
 * siendo `historial`/`HistorialView`, el label del nav ya es "Egresos"):
 * header con subtítulo del mes + toggle de moneda, filtros (moneda/buscador/
 * categoría/banco/mes), 3 `TarjetaKpi` (Total del mes / Ticket promedio /
 * Mayor gasto), `TablaMovimientos` y un sidebar con "Registrar" + "Por
 * categoría". Reemplaza la lista-de-tarjetas agrupada por día de la Fase 1.
 * Cubre además el alta, edición y eliminación de gastos (Épica 2).
 */
const { cargarGastos, eliminarGasto } = useGastos()
const { cargarCategorias } = useCategorias()
const { cargarBancos } = useBancos()
const storeGastos = useGastosStore()
const storeIngresos = useIngresosStore()
const { formatearMonto, totalesPorCategoria } = useMoneda()

const modalAbierto = ref(false)
const gastoEnEdicion = ref<Gasto | null>(null)
const gastoAEliminar = ref<Gasto | null>(null)

/** Filtros de UI de Egresos (estado local de la vista, no del store). */
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
  cargarGastos()
})

/** Prefijo `YYYY-MM` del mes actual, en hora LOCAL (nunca `toISOString()`, ver `hoyISO` de `FormularioGasto.vue`). */
function mesActualISO(): string {
  const ahora = new Date()
  const anio = ahora.getFullYear()
  const mes = String(ahora.getMonth() + 1).padStart(2, '0')
  return `${anio}-${mes}`
}

/** Categorías de GASTO activas (blindaje: `storeGastos.categorias` es una bolsa mixta de ambos tipos desde la migración 008). */
const categoriasGasto = computed(() => storeGastos.categorias.filter((c) => c.tipo === 'gasto'))

/** Nombre del banco de un gasto (para mostrarlo en la fila de la tabla). */
function nombreBanco(bancoId: string): string {
  return storeIngresos.bancos.find((banco) => banco.id === bancoId)?.nombre ?? 'Sin banco'
}

/** Nombre de la categoría de un gasto (para mostrarlo en la fila y en el "por categoría"). */
function nombreCategoria(categoriaId: string): string {
  return storeGastos.categorias.find((c) => c.id === categoriaId)?.nombre ?? 'Sin categoría'
}

/** Meses (`YYYY-MM`) con al menos un gasto, más el mes actual (para que el selector siempre pueda mostrarlo aunque no tenga movimientos todavía), únicos y ordenados descendente. */
const mesesDisponibles = computed(() => {
  const meses = new Set(storeGastos.gastos.map((gasto) => gasto.fecha.slice(0, 7)))
  meses.add(mesActualISO())
  return [...meses].sort((a, b) => b.localeCompare(a))
})

/** No hay ningún gasto registrado (estado vacío genérico). */
const sinGastos = computed(() => storeGastos.gastos.length === 0)

/**
 * Gastos del mes seleccionado (o de TODOS si "mes" = "Todos los meses"),
 * SIN aplicar el resto de los filtros: base de las 3 stat cards, el
 * subtítulo del encabezado y el "por categoría" (mismo criterio que las
 * KPI de `DashboardView`: no se ven afectadas por los chips/selects que solo
 * filtran la tabla de abajo).
 */
const gastosDelMes = computed(() =>
  storeGastos.gastos.filter((gasto) => !mesFiltro.value || gasto.fecha.slice(0, 7) === mesFiltro.value),
)

/** Gastos del mes que además cumplen moneda/categoría/banco/búsqueda: fuente de la tabla. */
const gastosFiltrados = computed(() => {
  const busqueda = busquedaFiltro.value.trim().toLowerCase()
  return gastosDelMes.value.filter((gasto) => {
    const cumpleMoneda = monedaFiltro.value === 'todos' || gasto.moneda === monedaFiltro.value
    const cumpleCategoria = !categoriaFiltro.value || gasto.categoria_id === categoriaFiltro.value
    const cumpleBanco = !bancoFiltro.value || gasto.banco_id === bancoFiltro.value
    const cumpleBusqueda = !busqueda || (gasto.descripcion ?? '').toLowerCase().includes(busqueda)
    return cumpleMoneda && cumpleCategoria && cumpleBanco && cumpleBusqueda
  })
})

/** Hay gastos en total, pero el filtro activo no encuentra ninguno (estado vacío específico). */
const sinResultadosPorFiltro = computed(() => !sinGastos.value && gastosFiltrados.value.length === 0)

/** Filas ya enriquecidas para `TablaMovimientos`. Los gastos confirmados nunca tienen `monto`/`moneda` en `null` (solo ocurre en `estado='revision_manual'`, propio de la bandeja de borradores). */
const filasTabla = computed<FilaMovimiento[]>(() =>
  gastosFiltrados.value.map((gasto) => ({
    id: gasto.id,
    fecha: gasto.fecha,
    descripcion: gasto.descripcion || nombreCategoria(gasto.categoria_id),
    nombreCategoria: nombreCategoria(gasto.categoria_id),
    nombreBanco: nombreBanco(gasto.banco_id),
    monto: gasto.monto ?? 0,
    moneda: gasto.moneda ?? 'PEN',
  })),
)

/** Total del mes en PEN (para el subtítulo del encabezado, independiente de la moneda seleccionada). */
const totalPenDelMes = computed(() =>
  gastosDelMes.value.filter((g) => g.moneda === 'PEN').reduce((total, g) => total + (g.monto ?? 0), 0),
)
/** Total del mes en USD (para el subtítulo del encabezado). */
const totalUsdDelMes = computed(() =>
  gastosDelMes.value.filter((g) => g.moneda === 'USD').reduce((total, g) => total + (g.monto ?? 0), 0),
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
  return `${gastosDelMes.value.length} movimientos en ${etiquetaMes} · ${textoTotalesDelMes.value}`
})

/** Gastos del mes en la moneda del toggle del encabezado (base de las 3 stat cards). */
const gastosDelMesEnMonedaSeleccionada = computed(() =>
  gastosDelMes.value.filter((gasto) => gasto.moneda === monedaSeleccionada.value),
)

/** Total del mes en la moneda seleccionada (1ª stat card). */
const totalDelMes = computed(() =>
  gastosDelMesEnMonedaSeleccionada.value.reduce((total, g) => total + (g.monto ?? 0), 0),
)

/** Ticket promedio = total ÷ cantidad; sin dividir por cero si no hay movimientos (2ª stat card). */
const ticketPromedio = computed(() => {
  const cantidad = gastosDelMesEnMonedaSeleccionada.value.length
  return cantidad > 0 ? totalDelMes.value / cantidad : 0
})

/** Gasto de mayor monto del mes en la moneda seleccionada, o `null` si no hay ninguno (3ª stat card). */
const mayorGasto = computed<Gasto | null>(() =>
  gastosDelMesEnMonedaSeleccionada.value.reduce<Gasto | null>(
    (mayor, gasto) => (mayor === null || (gasto.monto ?? 0) > (mayor.monto ?? 0) ? gasto : mayor),
    null,
  ),
)
const montoMayorGasto = computed(() => mayorGasto.value?.monto ?? 0)
const subtituloMayorGasto = computed(() => {
  const gasto = mayorGasto.value
  if (!gasto) return undefined
  return gasto.descripcion || nombreCategoria(gasto.categoria_id)
})

/** "Por categoría" del sidebar: totales del mes por categoría, en la moneda seleccionada. */
const porCategoria = computed(() =>
  totalesPorCategoria(
    gastosDelMes.value.map((gasto) => ({
      categoria_id: gasto.categoria_id,
      nombre: nombreCategoria(gasto.categoria_id),
      moneda: gasto.moneda ?? 'PEN',
      monto: gasto.monto ?? 0,
    })),
    monedaSeleccionada.value,
  ),
)

/** Abre el modal en modo alta. */
function abrirModalAlta() {
  gastoEnEdicion.value = null
  modalAbierto.value = true
}

/** Abre el modal en modo edición con el gasto seleccionado prellenado. */
function abrirModalEdicion(gasto: Gasto) {
  gastoEnEdicion.value = gasto
  modalAbierto.value = true
}

/** Resuelve el id emitido por `TablaMovimientos` al gasto real antes de abrir el modal de edición. */
function abrirModalEdicionPorId(id: string) {
  const gasto = storeGastos.gastos.find((g) => g.id === id)
  if (gasto) abrirModalEdicion(gasto)
}

/** Cierra el modal de alta/edición sin guardar. */
function cerrarModal() {
  modalAbierto.value = false
  gastoEnEdicion.value = null
}

/** Tras guardar (alta o edición), cierra el modal; la lista ya se actualizó en el store. */
function manejarGuardado() {
  cerrarModal()
}

/** Abre el diálogo de confirmación antes de eliminar. */
function pedirConfirmacionEliminar(gasto: Gasto) {
  gastoAEliminar.value = gasto
}

/** Resuelve el id emitido por `TablaMovimientos` al gasto real antes de pedir confirmación. */
function pedirConfirmacionEliminarPorId(id: string) {
  const gasto = storeGastos.gastos.find((g) => g.id === id)
  if (gasto) pedirConfirmacionEliminar(gasto)
}

/** Cancela la eliminación: no se borra nada. */
function cancelarEliminacion() {
  gastoAEliminar.value = null
}

/** Confirma la eliminación del gasto seleccionado. */
async function confirmarEliminacion() {
  if (!gastoAEliminar.value) return
  await eliminarGasto(gastoAEliminar.value.id)
  gastoAEliminar.value = null
}
</script>

<template>
  <main class="pagina-egresos">
    <header class="encabezado-egresos">
      <div class="titulo-encabezado">
        <h1>Egresos</h1>
        <p class="subtitulo-encabezado">{{ subtituloEncabezado }}</p>
      </div>
      <div class="acciones-encabezado">
        <ToggleMoneda v-model="monedaSeleccionada" mostrar-simbolo />
        <button type="button" class="boton-registrar boton-nuevo" @click="abrirModalAlta">
          + Nuevo egreso
        </button>
      </div>
    </header>

    <p v-if="storeGastos.error" role="alert" class="mensaje-error">{{ storeGastos.error }}</p>

    <FiltrosHistorial
      v-if="!sinGastos"
      v-model:moneda="monedaFiltro"
      v-model:categoria-id="categoriaFiltro"
      v-model:banco-id="bancoFiltro"
      v-model:mes="mesFiltro"
      v-model:busqueda="busquedaFiltro"
      :categorias="categoriasGasto"
      :bancos="storeIngresos.bancos"
      :meses-disponibles="mesesDisponibles"
    />

    <div v-if="!sinGastos" class="fila-kpis">
      <TarjetaKpi label="Total del mes" :monto="totalDelMes" :moneda="monedaSeleccionada" variante="egreso" />
      <TarjetaKpi
        label="Ticket promedio"
        :monto="ticketPromedio"
        :moneda="monedaSeleccionada"
        variante="egreso"
      />
      <TarjetaKpi
        label="Mayor gasto"
        :monto="montoMayorGasto"
        :moneda="monedaSeleccionada"
        variante="egreso"
        :subtitulo="subtituloMayorGasto"
      />
    </div>

    <div v-if="!sinGastos" class="grid-egresos">
      <section class="columna-tabla">
        <TablaMovimientos
          v-if="gastosFiltrados.length > 0"
          :filas="filasTabla"
          :total-sin-filtrar="gastosDelMes.length"
          @editar="abrirModalEdicionPorId"
          @eliminar="pedirConfirmacionEliminarPorId"
        />
        <div v-else-if="sinResultadosPorFiltro" class="estado-vacio estado-vacio-filtro">
          <span class="icono-vacio-filtro" aria-hidden="true">🔍</span>
          <p class="mensaje-vacio">Sin gastos con este filtro</p>
          <p class="sugerencia-vacio">Prueba cambiar el filtro o registra el primer gasto del mes.</p>
        </div>
      </section>

      <aside class="columna-lateral-egresos">
        <div class="tarjeta-lateral tarjeta-registrar">
          <h2>Registrar un egreso</h2>
          <button type="button" class="boton-primario boton-nuevo" @click="abrirModalAlta">
            + Nuevo egreso
          </button>
        </div>
        <div class="tarjeta-lateral">
          <h2>Por categoría</h2>
          <ListaGastoPorCategoria :items="porCategoria" :moneda="monedaSeleccionada" />
        </div>
      </aside>
    </div>

    <div v-else class="estado-vacio estado-vacio-generico">
      <p class="mensaje-vacio">Todavía no hay gastos registrados.</p>
      <button type="button" class="boton-primario boton-nuevo" @click="abrirModalAlta">
        Nuevo gasto
      </button>
    </div>

    <ModalGasto
      v-if="modalAbierto"
      :gasto="gastoEnEdicion"
      @cerrar="cerrarModal"
      @guardado="manejarGuardado"
    />

    <DialogoConfirmacion
      v-if="gastoAEliminar"
      mensaje="¿Seguro que quieres eliminar este gasto? Esta acción no se puede deshacer."
      @confirmar="confirmarEliminacion"
      @cancelar="cancelarEliminacion"
    />
  </main>
</template>

<style scoped>
.pagina-egresos {
  max-width: 1080px;
  margin: 0 auto;
  padding: var(--espacio-6) var(--espacio-4);
}

.encabezado-egresos {
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

.grid-egresos {
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

.columna-lateral-egresos {
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

  .grid-egresos {
    grid-template-columns: 1fr;
  }
}
</style>
