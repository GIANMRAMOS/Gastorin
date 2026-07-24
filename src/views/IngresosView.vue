<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import ModalIngreso from '@/components/ModalIngreso.vue'
import DialogoConfirmacion from '@/components/DialogoConfirmacion.vue'
import FiltrosIngresos from '@/components/FiltrosIngresos.vue'
import { useIngresos } from '@/composables/useIngresos'
import { useBancos } from '@/composables/useBancos'
import { useIngresosStore } from '@/stores/ingresos'
import { useMoneda } from '@/composables/useMoneda'
import { agruparPorFecha } from '@/composables/useFechas'
import type { Ingreso } from '@/types/ingreso'
import type { Moneda } from '@/types/gasto'

/**
 * Historial de ingresos (Épica 11, HU-11.1–11.4): clon estructural de
 * `HistorialView.vue` reducido a alta, listado, edición y eliminación, más
 * filtros combinables por moneda/banco/mes (sin categoría: `Ingreso` no tiene
 * ese concepto) y el totalizador de la moneda predominante. El orden por
 * fecha descendente lo garantiza el `.order` de `useIngresos.cargarIngresos`.
 */
const { cargarIngresos, eliminarIngreso } = useIngresos()
const { cargarBancos } = useBancos()
const storeIngresos = useIngresosStore()
const { formatearMonto, resumenMonedaPredominante, saldosPorBanco, montoSinBancoPorMoneda } = useMoneda()

const modalAbierto = ref(false)
const ingresoEnEdicion = ref<Ingreso | null>(null)
const ingresoAEliminar = ref<Ingreso | null>(null)

/** Filtros de UI de Ingresos (estado local de la vista, no del store). */
const monedaFiltro = ref<'todos' | Moneda>('todos')
const bancoFiltro = ref('')
const mesFiltro = ref('')

onMounted(() => {
  cargarIngresos()
  cargarBancos()
})

/** Nombre del banco de un ingreso (para mostrarlo en la fila). */
function nombreBanco(bancoId: string): string {
  return storeIngresos.bancos.find((banco) => banco.id === bancoId)?.nombre ?? 'Sin banco'
}

/** Meses (`YYYY-MM`) con al menos un ingreso, únicos y ordenados descendente. */
const mesesDisponibles = computed(() => {
  const meses = new Set(storeIngresos.ingresos.map((ingreso) => ingreso.fecha.slice(0, 7)))
  return [...meses].sort((a, b) => b.localeCompare(a))
})

/** Ingresos que cumplen la intersección de los 3 filtros activos (moneda, banco, mes). */
const ingresosFiltrados = computed(() => {
  return storeIngresos.ingresos.filter((ingreso) => {
    const cumpleMoneda = monedaFiltro.value === 'todos' || ingreso.moneda === monedaFiltro.value
    const cumpleBanco = !bancoFiltro.value || ingreso.banco_id === bancoFiltro.value
    const cumpleMes = !mesFiltro.value || ingreso.fecha.slice(0, 7) === mesFiltro.value
    return cumpleMoneda && cumpleBanco && cumpleMes
  })
})

/** No hay ningún ingreso registrado (estado vacío genérico). */
const sinIngresos = computed(() => storeIngresos.ingresos.length === 0)

/** Hay ingresos en total, pero el filtro activo no encuentra ninguno. */
const sinResultadosPorFiltro = computed(
  () => !sinIngresos.value && ingresosFiltrados.value.length === 0,
)

/**
 * Ingresos filtrados agrupados por día. `ingresosFiltrados` ya viene
 * ordenado desc (mismo orden de `store.ingresos`), así que el agrupador no
 * reordena.
 */
const gruposIngresos = computed(() => agruparPorFecha(ingresosFiltrados.value, (ingreso) => ingreso.fecha))

/** Totalizador de la moneda predominante sobre el conjunto ya filtrado. */
const resumenIngresos = computed(() =>
  resumenMonedaPredominante(
    ingresosFiltrados.value.map((ingreso) => ({ moneda: ingreso.moneda, monto: ingreso.importe })),
  ),
)

/** Desglose de saldos por banco (excluye "No especificado") sobre el conjunto ya filtrado. */
const saldosPorBancoFiltrados = computed(() =>
  saldosPorBanco(
    ingresosFiltrados.value.map((ingreso) => ({
      bancoId: ingreso.banco_id,
      nombreBanco: nombreBanco(ingreso.banco_id),
      moneda: ingreso.moneda,
      monto: ingreso.importe,
    })),
  ),
)

/** Monto total sin banco asignado ("No especificado"), por moneda, sobre el conjunto ya filtrado. */
const montoSinBanco = computed(() =>
  montoSinBancoPorMoneda(
    ingresosFiltrados.value.map((ingreso) => ({
      nombreBanco: nombreBanco(ingreso.banco_id),
      moneda: ingreso.moneda,
      monto: ingreso.importe,
    })),
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
    <div class="cabecera-ingresos">
      <h1>Ingresos</h1>
      <button type="button" class="boton-primario boton-nuevo" @click="abrirModalAlta">
        + Nuevo ingreso
      </button>
    </div>

    <p v-if="storeIngresos.error" role="alert" class="mensaje-error">{{ storeIngresos.error }}</p>

    <FiltrosIngresos
      v-if="!sinIngresos"
      v-model:moneda="monedaFiltro"
      v-model:banco-id="bancoFiltro"
      v-model:mes="mesFiltro"
      :bancos="storeIngresos.bancos"
      :meses-disponibles="mesesDisponibles"
    />

    <p v-if="resumenIngresos" class="resumen-totalizador">
      Total {{ formatearMonto(resumenIngresos.total, resumenIngresos.moneda) }}
    </p>

    <ul v-if="saldosPorBancoFiltrados.length > 0" class="desglose-bancos">
      <li v-for="banco in saldosPorBancoFiltrados" :key="banco.bancoId" class="item-desglose-banco">
        <span class="nombre-desglose-banco">{{ banco.nombreBanco }}</span>
        <span
          v-for="[moneda, monto] in Object.entries(banco.montosPorMoneda)"
          :key="`${banco.bancoId}-${moneda}`"
          class="monto-desglose-banco"
        >
          {{ formatearMonto(monto, moneda as Moneda) }}
        </span>
      </li>
    </ul>

    <template v-if="Object.keys(montoSinBanco).length > 0">
      <p
        v-for="[moneda, monto] in Object.entries(montoSinBanco)"
        :key="`sin-banco-${moneda}`"
        class="nota-sin-banco"
      >
        Incluye {{ formatearMonto(monto, moneda as Moneda) }} sin banco asignado
      </p>
    </template>

    <div v-if="ingresosFiltrados.length > 0" class="grupos-ingresos">
      <div v-for="grupo in gruposIngresos" :key="grupo.etiqueta + grupo.items[0].id" class="grupo-fecha">
        <h2 class="encabezado-grupo-fecha">{{ grupo.etiqueta }}</h2>
        <ul class="lista-ingresos">
          <li v-for="ingreso in grupo.items" :key="ingreso.id" class="fila-ingreso">
            <div class="detalle-ingreso">
              <p class="concepto-ingreso">{{ ingreso.concepto }}</p>
              <p class="metadatos-ingreso">{{ nombreBanco(ingreso.banco_id) }} · {{ ingreso.fecha }}</p>
            </div>
            <p class="importe-ingreso">{{ formatearMonto(ingreso.importe, ingreso.moneda) }}</p>

            <div class="acciones-ingreso">
              <button type="button" class="enlace-secundario indicador-editar" @click="abrirModalEdicion(ingreso)">
                Editar ›
              </button>
              <button type="button" class="enlace-secundario" @click="pedirConfirmacionEliminar(ingreso)">
                Eliminar
              </button>
            </div>
          </li>
        </ul>
      </div>
    </div>

    <div v-else-if="sinIngresos" class="estado-vacio estado-vacio-generico">
      <p class="mensaje-vacio">Todavía no hay ingresos registrados.</p>
      <button type="button" class="boton-primario boton-nuevo" @click="abrirModalAlta">
        Nuevo ingreso
      </button>
    </div>

    <div v-else-if="sinResultadosPorFiltro" class="estado-vacio estado-vacio-filtro">
      <span class="icono-vacio-filtro" aria-hidden="true">🔍</span>
      <p class="mensaje-vacio">Sin ingresos con este filtro</p>
      <p class="sugerencia-vacio">Prueba cambiar el filtro o registra el primer ingreso del mes.</p>
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
  max-width: 720px;
  margin: 0 auto;
  padding: var(--espacio-6) var(--espacio-4);
}

.cabecera-ingresos {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--espacio-4);
  margin-bottom: var(--espacio-6);
}

.cabecera-ingresos h1 {
  font-size: clamp(20px, 4vw, 26px);
  margin: 0;
}

.boton-nuevo {
  width: auto;
  min-height: 44px;
  margin-top: 0;
  padding: 0 var(--espacio-4);
}

.grupos-ingresos {
  display: flex;
  flex-direction: column;
  gap: var(--espacio-4);
}

.encabezado-grupo-fecha {
  margin: 0 0 var(--espacio-2);
  font-size: var(--tamano-pequeno);
  font-weight: 700;
  color: var(--color-texto-secundario);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.lista-ingresos {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--espacio-2);
}

.fila-ingreso {
  display: flex;
  align-items: center;
  gap: var(--espacio-3);
  background: var(--color-fondo);
  border: 1px solid var(--color-borde-tarjeta);
  border-radius: 18px;
  padding: var(--espacio-3) var(--espacio-4);
}

.detalle-ingreso {
  flex: 1;
  min-width: 0;
}

.concepto-ingreso {
  margin: 0;
  font-weight: 700;
  color: var(--color-texto);
}

.metadatos-ingreso {
  margin: 2px 0 0;
  font-size: var(--tamano-pequeno);
  color: var(--color-texto-secundario);
}

.importe-ingreso {
  margin: 0;
  font-weight: 700;
  color: var(--color-texto);
  white-space: nowrap;
}

.acciones-ingreso {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.acciones-ingreso button {
  margin-top: 0;
  padding: 0;
}

.indicador-editar {
  font-weight: 600;
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

.resumen-totalizador {
  margin: 0 0 var(--espacio-3);
  font-weight: 700;
  color: var(--color-texto);
}

.desglose-bancos {
  list-style: none;
  margin: 0 0 var(--espacio-4);
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--espacio-1);
}

.item-desglose-banco {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--espacio-3);
  font-size: var(--tamano-pequeno);
  color: var(--color-texto-secundario);
}

.nombre-desglose-banco {
  font-weight: 600;
}

.monto-desglose-banco {
  white-space: nowrap;
}

.nota-sin-banco {
  margin: 0 0 var(--espacio-3);
  font-size: var(--tamano-pequeno);
  color: var(--color-texto-terciario);
}
</style>
