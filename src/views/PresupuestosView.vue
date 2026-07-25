<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import ToggleMoneda from '@/components/ToggleMoneda.vue'
import ModalPresupuesto from '@/components/ModalPresupuesto.vue'
import ModalMetaAhorro from '@/components/ModalMetaAhorro.vue'
import DialogoConfirmacion from '@/components/DialogoConfirmacion.vue'
import HeroPresupuesto from '@/components/HeroPresupuesto.vue'
import TarjetaKpi from '@/components/TarjetaKpi.vue'
import TarjetaStatPresupuesto from '@/components/TarjetaStatPresupuesto.vue'
import EstadoVacioCta from '@/components/EstadoVacioCta.vue'
import FilaCategoriaPresupuesto from '@/components/FilaCategoriaPresupuesto.vue'
import {
  calcularDesgloseSemanal,
  calcularGastado,
  contarCategoriasExcedidas,
  contarDiasSinGasto,
  usePresupuestos,
} from '@/composables/usePresupuestos'
import { proyeccionCierreMes } from '@/composables/useDashboard'
import { useCategorias } from '@/composables/useCategorias'
import { useGastos } from '@/composables/useGastos'
import { useMetasAhorro } from '@/composables/useMetasAhorro'
import { useGastosStore } from '@/stores/gastos'
import type { Moneda, Presupuesto } from '@/types/gasto'

/**
 * Vista de Presupuestos (rediseño "Caudal", Fase 4: Épicas 15-17). Reemplaza
 * la lista simple de tarjetas anterior por: un hero oscuro de consumo
 * mensual con toggle de moneda, 4 stat cards en grid 2×2 (Proyección de
 * cierre, Ahorro comprometido, Categorías excedidas, Días sin gasto), un
 * desglose semanal expandible por categoría, y un botón para copiar los
 * presupuestos del mes anterior que todavía no existan este mes.
 *
 * Carga categorías, gastos (confirmados, sin ventana de mes) y presupuestos
 * del mes actual en `onMounted`, igual que la vista anterior; además carga
 * la meta de ahorro (Épica 13) y los presupuestos del mes anterior (Épica
 * 17, solo para habilitar/deshabilitar el botón "Copiar"), todo en paralelo
 * (el store cuenta `cargasEnVuelo`).
 */
const {
  cargarPresupuestos,
  eliminarPresupuesto,
  presupuestosMesAnterior,
  cargarPresupuestosMesAnterior,
  copiarPresupuestosMesAnterior,
} = usePresupuestos()
const { cargarCategorias } = useCategorias()
const { cargarGastos } = useGastos()
const { meta: metaAhorro, cargarMeta } = useMetasAhorro()
const storeGastos = useGastosStore()

/** Moneda que gobierna el hero, las 4 stats (salvo "Ahorro comprometido", ver más abajo) y el desglose. */
const monedaSeleccionada = ref<Moneda>('PEN')

const modalAbierto = ref(false)
const presupuestoSeleccionado = ref<Presupuesto | null>(null)
const presupuestoAEliminar = ref<Presupuesto | null>(null)
const modalMetaAbierto = ref(false)

/** Categoría cuya fila de desglose semanal está expandida (una sola a la vez), o `null` si ninguna. */
const filaExpandidaId = ref<string | null>(null)

onMounted(() => {
  cargarCategorias()
  cargarGastos()
  cargarPresupuestos()
  cargarMeta()
  cargarPresupuestosMesAnterior()
})

/** Prefijo `YYYY-MM` del mes actual, base de todos los cálculos "de este mes". */
const mesPrefijoActual = computed(() => {
  const ahora = new Date()
  return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`
})

/** Día del mes actual (1-31): base del ritmo esperado, la proyección y "días sin gasto". */
const diaActual = computed(() => new Date().getDate())

/** Cantidad de días del mes actual (28-31): base del ritmo esperado y la proyección. */
const diasDelMes = computed(() => {
  const ahora = new Date()
  return new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0).getDate()
})

/** Nombre del mes anterior, capitalizado (ej. "Junio"), para el botón "Copiar de [mes anterior]". */
const mesAnteriorFormateado = computed(() => {
  const ahora = new Date()
  const fechaAnterior = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1)
  const nombreMes = new Intl.DateTimeFormat('es-PE', { month: 'long' }).format(fechaAnterior)
  return `${nombreMes.charAt(0).toUpperCase()}${nombreMes.slice(1)}`
})

/** Presupuestos del mes actual filtrados por la moneda activa del toggle. */
const presupuestosMoneda = computed(() =>
  storeGastos.presupuestos.filter((presupuesto) => presupuesto.moneda === monedaSeleccionada.value),
)

/** Suma de lo gastado en TODOS los presupuestos de la moneda activa (base del hero). */
const gastadoTotal = computed(() =>
  presupuestosMoneda.value.reduce(
    (total, presupuesto) => total + calcularGastado(storeGastos.gastos, presupuesto),
    0,
  ),
)

/** Suma de los límites de TODOS los presupuestos de la moneda activa (base del hero). */
const limiteTotal = computed(() =>
  presupuestosMoneda.value.reduce((total, presupuesto) => total + presupuesto.monto_limite, 0),
)

/** Ritmo de gasto esperado al día de hoy si se gastara el límite total de forma pareja durante el mes. */
const ritmoEsperadoPct = computed(() =>
  diasDelMes.value > 0 ? (diaActual.value / diasDelMes.value) * 100 : 0,
)

/** Proyección de cierre de mes a partir de lo gastado hasta hoy, extrapolado linealmente (mismo cálculo del Dashboard). */
const proyeccion = computed(() => proyeccionCierreMes(gastadoTotal.value, diaActual.value, diasDelMes.value))

/** Nota de la stat "Proyección de cierre": "X% bajo/sobre presupuesto"; `undefined` sin límite configurado. */
const notaProyeccion = computed(() => {
  if (limiteTotal.value <= 0) return undefined
  const diferenciaPct = ((proyeccion.value - limiteTotal.value) / limiteTotal.value) * 100
  const pctRedondeado = Math.round(Math.abs(diferenciaPct))
  return diferenciaPct > 0 ? `${pctRedondeado}% sobre presupuesto` : `${pctRedondeado}% bajo presupuesto`
})

/** `categoria_id` de los presupuestos excedidos de la moneda activa (Épica 15). */
const categoriasExcedidasIds = computed(() =>
  contarCategoriasExcedidas(storeGastos.presupuestos, storeGastos.gastos, monedaSeleccionada.value),
)

/** Nombres resueltos de las categorías excedidas, para listarlos debajo del conteo. */
const nombresCategoriasExcedidas = computed(() =>
  categoriasExcedidasIds.value.map(
    (categoriaId) => storeGastos.categorias.find((c) => c.id === categoriaId)?.nombre ?? 'Categoría',
  ),
)

/** Días sin ningún gasto confirmado de la moneda activa, de los transcurridos en el mes. */
const diasSinGasto = computed(() =>
  contarDiasSinGasto(storeGastos.gastos, monedaSeleccionada.value, mesPrefijoActual.value, diaActual.value),
)

/** Una fila por presupuesto de la moneda activa, con su desglose semanal ya calculado (Épica 16). */
const filasCategoria = computed(() =>
  presupuestosMoneda.value.map((presupuesto) => {
    const nombreCategoria =
      storeGastos.categorias.find((c) => c.id === presupuesto.categoria_id)?.nombre ?? 'Categoría'
    const gastado = calcularGastado(storeGastos.gastos, presupuesto)
    const desglose = calcularDesgloseSemanal(
      storeGastos.gastos,
      presupuesto.categoria_id,
      monedaSeleccionada.value,
      mesPrefijoActual.value,
    )
    const movimientos = storeGastos.gastos.filter(
      (gasto) =>
        gasto.categoria_id === presupuesto.categoria_id &&
        gasto.moneda === monedaSeleccionada.value &&
        gasto.fecha.slice(0, 7) === mesPrefijoActual.value,
    ).length

    return {
      categoriaId: presupuesto.categoria_id,
      nombreCategoria,
      gastado,
      limite: presupuesto.monto_limite,
      desglose,
      movimientos,
      restante: presupuesto.monto_limite - gastado,
    }
  }),
)

/** `true` si el mes anterior tiene al menos un presupuesto que copiar (Épica 17). */
const hayPresupuestosMesAnterior = computed(() => presupuestosMesAnterior.value.length > 0)

/** Motivo mostrado (título nativo) cuando el botón "Copiar" está deshabilitado. */
const tituloBotonCopiar = computed(() =>
  hayPresupuestosMesAnterior.value
    ? undefined
    : `${mesAnteriorFormateado.value} no tiene presupuestos para copiar.`,
)

/** Abre el modal de presupuesto en modo alta. */
function abrirModalAlta() {
  presupuestoSeleccionado.value = null
  modalAbierto.value = true
}

/** Abre el modal de edición del presupuesto de esa categoría (en la moneda activa). */
function abrirModalEdicion(categoriaId: string) {
  presupuestoSeleccionado.value =
    storeGastos.presupuestos.find(
      (presupuesto) =>
        presupuesto.categoria_id === categoriaId && presupuesto.moneda === monedaSeleccionada.value,
    ) ?? null
  modalAbierto.value = true
}

/** Cierra el modal de alta/edición sin guardar. */
function cerrarModal() {
  modalAbierto.value = false
  presupuestoSeleccionado.value = null
}

/** Tras guardar (alta o edición), cierra el modal; la lista ya se actualizó en el store. */
function manejarGuardado() {
  cerrarModal()
}

/** Pide confirmación de eliminación: cierra el modal y abre el diálogo. */
function pedirConfirmacionEliminar() {
  presupuestoAEliminar.value = presupuestoSeleccionado.value
  modalAbierto.value = false
}

/** Cancela la eliminación: no se borra nada. */
function cancelarEliminacion() {
  presupuestoAEliminar.value = null
}

/** Confirma la eliminación del presupuesto seleccionado. */
async function confirmarEliminacion() {
  if (!presupuestoAEliminar.value) return
  await eliminarPresupuesto(presupuestoAEliminar.value.id)
  presupuestoAEliminar.value = null
  presupuestoSeleccionado.value = null
}

/** Expande/colapsa el desglose semanal de una categoría (una sola fila abierta a la vez). */
function alternarFila(categoriaId: string) {
  filaExpandidaId.value = filaExpandidaId.value === categoriaId ? null : categoriaId
}

/** Abre el modal de meta de ahorro (mismo modal sirve para alta y edición, ver `ModalMetaAhorro`). */
function abrirModalMeta() {
  modalMetaAbierto.value = true
}

/** Cierra el modal de meta de ahorro sin guardar. */
function cerrarModalMeta() {
  modalMetaAbierto.value = false
}

/** Tras guardar la meta, cierra el modal; el valor ya se actualizó en `metaAhorro`. */
function manejarMetaGuardada() {
  cerrarModalMeta()
}

/** Copia al mes actual los presupuestos del mes anterior que todavía no existan (Épica 17). */
async function manejarCopiarMesAnterior() {
  if (!hayPresupuestosMesAnterior.value) return
  await copiarPresupuestosMesAnterior()
}
</script>

<template>
  <main class="pagina-presupuestos">
    <header class="cabecera-presupuestos">
      <h1>Presupuestos</h1>
      <div class="acciones-cabecera-presupuestos">
        <ToggleMoneda v-model="monedaSeleccionada" mostrar-simbolo />
        <button
          type="button"
          class="boton-secundario boton-copiar-mes-anterior"
          :disabled="!hayPresupuestosMesAnterior || storeGastos.cargando"
          :title="tituloBotonCopiar"
          @click="manejarCopiarMesAnterior"
        >
          Copiar de {{ mesAnteriorFormateado }}
        </button>
        <button type="button" class="boton-primario boton-nuevo" @click="abrirModalAlta">
          + Nuevo presupuesto
        </button>
      </div>
    </header>

    <p v-if="storeGastos.error" role="alert" class="mensaje-error">{{ storeGastos.error }}</p>

    <template v-if="presupuestosMoneda.length > 0">
      <HeroPresupuesto
        :gastado="gastadoTotal"
        :limite="limiteTotal"
        :moneda="monedaSeleccionada"
        :ritmo-esperado-pct="ritmoEsperadoPct"
        :dia-actual="diaActual"
      />

      <div class="grid-stats-presupuesto">
        <TarjetaKpi
          label="Proyección de cierre"
          :monto="proyeccion"
          :moneda="monedaSeleccionada"
          variante="ingreso"
          :subtitulo="notaProyeccion"
        />

        <!--
          "Ahorro comprometido" (Épica 13) se asume SIEMPRE en PEN: la tabla
          `metas_ahorro` (migración 009) no tiene columna `moneda`, así que
          esta tarjeta NO se recalcula con el toggle de moneda del encabezado
          (mismo supuesto que ya usa la card "Proyección" del sidebar del App
          Shell). Al haber una fila ya configurada, la tarjeta completa es
          clickable/operable con teclado para editarla (mismo modal del alta).
        -->
        <div
          v-if="metaAhorro"
          class="tarjeta-meta-clickable"
          role="button"
          tabindex="0"
          @click="abrirModalMeta"
          @keydown.enter="abrirModalMeta"
          @keydown.space.prevent="abrirModalMeta"
        >
          <TarjetaKpi
            label="Ahorro comprometido"
            :monto="metaAhorro.monto"
            moneda="PEN"
            variante="ingreso"
            :subtitulo="metaAhorro.descripcion"
          />
        </div>
        <article v-else class="tarjeta-meta-vacia">
          <EstadoVacioCta
            titulo="Ahorro comprometido"
            mensaje="Todavía no configuraste tu meta de ahorro."
            etiqueta-boton="Configura tu meta de ahorro"
            @accion="abrirModalMeta"
          />
        </article>

        <TarjetaStatPresupuesto
          label="Categorías excedidas"
          :valor="categoriasExcedidasIds.length"
          :items="nombresCategoriasExcedidas"
          :con-alerta="categoriasExcedidasIds.length > 0"
        />

        <TarjetaStatPresupuesto
          label="Días sin gasto"
          :valor="diasSinGasto.sinGasto"
          :nota="`de ${diasSinGasto.transcurridos} transcurridos`"
        />
      </div>

      <section class="seccion-desglose-presupuesto">
        <h2>Desglose por categoría</h2>
        <FilaCategoriaPresupuesto
          v-for="fila in filasCategoria"
          :key="fila.categoriaId"
          :categoria-id="fila.categoriaId"
          :nombre-categoria="fila.nombreCategoria"
          :gastado="fila.gastado"
          :limite="fila.limite"
          :moneda="monedaSeleccionada"
          :desglose="fila.desglose"
          :movimientos="fila.movimientos"
          :restante="fila.restante"
          :expandida="filaExpandidaId === fila.categoriaId"
          @alternar="alternarFila"
          @editar="abrirModalEdicion"
        />
      </section>
    </template>

    <EstadoVacioCta
      v-else
      titulo="Todavía no tienes presupuestos"
      :mensaje="`Configura tu primer presupuesto en ${monedaSeleccionada} para seguir tu consumo del mes.`"
      etiqueta-boton="Configura tu primer presupuesto"
      @accion="abrirModalAlta"
    />

    <ModalPresupuesto
      v-if="modalAbierto"
      :presupuesto="presupuestoSeleccionado"
      @cerrar="cerrarModal"
      @guardado="manejarGuardado"
      @pedir-eliminar="pedirConfirmacionEliminar"
    />

    <ModalMetaAhorro
      v-if="modalMetaAbierto"
      :meta="metaAhorro"
      @cerrar="cerrarModalMeta"
      @guardado="manejarMetaGuardada"
    />

    <DialogoConfirmacion
      v-if="presupuestoAEliminar"
      mensaje="¿Seguro que quieres eliminar este presupuesto?"
      @confirmar="confirmarEliminacion"
      @cancelar="cancelarEliminacion"
    />
  </main>
</template>

<style scoped>
.pagina-presupuestos {
  max-width: 1080px;
  margin: 0 auto;
  padding: var(--espacio-6) var(--espacio-4);
}

.cabecera-presupuestos {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--espacio-4);
  margin-bottom: var(--espacio-6);
}

.cabecera-presupuestos h1 {
  font-size: clamp(20px, 4vw, 26px);
  margin: 0;
}

.acciones-cabecera-presupuestos {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--espacio-3);
}

.boton-secundario {
  min-height: 40px;
  padding: 0 var(--espacio-4);
  background: var(--color-fondo);
  color: var(--color-texto);
  border: 1px solid var(--color-borde);
  border-radius: 9px;
  font-weight: 600;
  font-size: var(--tamano-pequeno);
  cursor: pointer;
  font-family: var(--fuente-base);
}
.boton-secundario:hover:not(:disabled) {
  background: var(--color-fondo-app);
}
.boton-secundario:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.boton-nuevo {
  width: auto;
  min-height: 40px;
  margin-top: 0;
  padding: 0 var(--espacio-4);
}

.grid-stats-presupuesto {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
  margin-bottom: var(--espacio-4);
}

.tarjeta-meta-clickable {
  cursor: pointer;
  border-radius: var(--radio-tarjeta);
}
.tarjeta-meta-clickable:focus-visible {
  outline: 2px solid var(--color-borde-foco);
  outline-offset: 2px;
}

.tarjeta-meta-vacia {
  background: var(--color-fondo);
  border: 1px solid var(--color-borde-tarjeta);
  border-radius: var(--radio-tarjeta);
}

.seccion-desglose-presupuesto {
  background: var(--color-fondo);
  border: 1px solid var(--color-borde-tarjeta);
  border-radius: var(--radio-tarjeta);
  padding: var(--espacio-4);
}

.seccion-desglose-presupuesto h2 {
  margin: 0 0 var(--espacio-3);
  font-size: 1rem;
}

@media (max-width: 900px) {
  .grid-stats-presupuesto {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 480px) {
  .acciones-cabecera-presupuestos {
    width: 100%;
  }
}
</style>
