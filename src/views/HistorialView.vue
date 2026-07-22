<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import ModalGasto from '@/components/ModalGasto.vue'
import DialogoConfirmacion from '@/components/DialogoConfirmacion.vue'
import FiltrosHistorial from '@/components/FiltrosHistorial.vue'
import { useGastos } from '@/composables/useGastos'
import { useCategorias } from '@/composables/useCategorias'
import { useBancos } from '@/composables/useBancos'
import { useColorCategoria } from '@/composables/useColorCategoria'
import { useGastosStore } from '@/stores/gastos'
import { useIngresosStore } from '@/stores/ingresos'
import { useMoneda } from '@/composables/useMoneda'
import type { Gasto, Moneda } from '@/types/gasto'

/**
 * Historial de gastos ampliado (Épica 3): lista con círculo de abreviatura,
 * filtros combinables por moneda/categoría/banco/mes y estados vacíos
 * distintos según haya o no gastos en total. Cubre además el alta, edición y
 * eliminación de gastos (Épica 2), y el retrofit de banco obligatorio
 * (migración `006`).
 */
const { cargarGastos, eliminarGasto } = useGastos()
const { cargarCategorias } = useCategorias()
const { cargarBancos } = useBancos()
const { colorCategoria: colorPorNombre } = useColorCategoria()
const storeGastos = useGastosStore()
const storeIngresos = useIngresosStore()
const { formatearMonto } = useMoneda()

const modalAbierto = ref(false)
const gastoEnEdicion = ref<Gasto | null>(null)
const gastoAEliminar = ref<Gasto | null>(null)

/** Filtros de UI del historial (estado local de la vista, no del store). */
const monedaFiltro = ref<'todos' | Moneda>('todos')
const categoriaFiltro = ref('')
const bancoFiltro = ref('')
const mesFiltro = ref('')

onMounted(() => {
  cargarCategorias()
  cargarBancos()
  cargarGastos()
})

/** Nombre del banco de un gasto (para mostrarlo en los metadatos de la fila). */
function nombreBanco(bancoId: string): string {
  return storeIngresos.bancos.find((banco) => banco.id === bancoId)?.nombre ?? 'Sin banco'
}

/** Busca la categoría de un gasto por su id (para nombre, color y abreviatura). */
function categoriaDe(categoriaId: string) {
  return storeGastos.categorias.find((c) => c.id === categoriaId)
}

/** Nombre de la categoría de un gasto (para mostrarlo en la fila). */
function nombreCategoria(categoriaId: string): string {
  return categoriaDe(categoriaId)?.nombre ?? 'Sin categoría'
}

/** Color asociado a la categoría, derivado de su nombre (mismo helper que el resto de la app). */
function colorCategoria(categoriaId: string): string {
  return colorPorNombre(categoriaDe(categoriaId)?.nombre)
}

/** Abreviatura de la categoría (leída del store, no recalculada por fila). */
function abreviaturaCategoria(categoriaId: string): string {
  return categoriaDe(categoriaId)?.abreviatura ?? '?'
}

/**
 * Monto formateado de un gasto del historial. `cargarGastos` filtra a
 * `estado='confirmado'`, así que `monto`/`moneda` siempre están completos
 * aquí (solo pueden ser `null` en `estado='revision_manual'`, propio de la
 * bandeja de borradores); el `null` es solo defensivo por el tipo.
 */
function montoFormateado(gasto: Gasto): string {
  if (gasto.monto == null || gasto.moneda == null) return ''
  return formatearMonto(gasto.monto, gasto.moneda)
}

/** Meses (`YYYY-MM`) con al menos un gasto, únicos y ordenados descendente. */
const mesesDisponibles = computed(() => {
  const meses = new Set(storeGastos.gastos.map((gasto) => gasto.fecha.slice(0, 7)))
  return [...meses].sort((a, b) => b.localeCompare(a))
})

/** Gastos que cumplen la intersección de los 3 filtros activos (moneda, categoría, mes). */
const gastosFiltrados = computed(() => {
  return storeGastos.gastos.filter((gasto) => {
    const cumpleMoneda = monedaFiltro.value === 'todos' || gasto.moneda === monedaFiltro.value
    const cumpleCategoria = !categoriaFiltro.value || gasto.categoria_id === categoriaFiltro.value
    const cumpleBanco = !bancoFiltro.value || gasto.banco_id === bancoFiltro.value
    const cumpleMes = !mesFiltro.value || gasto.fecha.slice(0, 7) === mesFiltro.value
    return cumpleMoneda && cumpleCategoria && cumpleBanco && cumpleMes
  })
})

/** No hay ningún gasto registrado (HU-3.1: estado vacío genérico). */
const sinGastos = computed(() => storeGastos.gastos.length === 0)

/** Hay gastos en total, pero el filtro activo no encuentra ninguno (HU-3.4). */
const sinResultadosPorFiltro = computed(
  () => !sinGastos.value && gastosFiltrados.value.length === 0,
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
  <main class="pagina-historial">
    <div class="cabecera-historial">
      <h1>Historial</h1>
      <button type="button" class="boton-primario boton-nuevo" @click="abrirModalAlta">
        + Nuevo gasto
      </button>
    </div>

    <p v-if="storeGastos.error" role="alert" class="mensaje-error">{{ storeGastos.error }}</p>

    <FiltrosHistorial
      v-if="!sinGastos"
      v-model:moneda="monedaFiltro"
      v-model:categoria-id="categoriaFiltro"
      v-model:banco-id="bancoFiltro"
      v-model:mes="mesFiltro"
      :categorias="storeGastos.categorias"
      :bancos="storeIngresos.bancos"
      :meses-disponibles="mesesDisponibles"
    />

    <ul v-if="gastosFiltrados.length > 0" class="lista-gastos">
      <li v-for="gasto in gastosFiltrados" :key="gasto.id" class="fila-gasto">
        <span class="circulo-categoria" :style="{ background: colorCategoria(gasto.categoria_id) }">
          {{ abreviaturaCategoria(gasto.categoria_id) }}
        </span>

        <div class="detalle-gasto">
          <p class="descripcion-gasto">{{ gasto.descripcion || nombreCategoria(gasto.categoria_id) }}</p>
          <p class="metadatos-gasto">
            {{ nombreCategoria(gasto.categoria_id) }} · {{ nombreBanco(gasto.banco_id) }} · {{ gasto.fecha }}
          </p>
        </div>

        <p class="monto-gasto">{{ montoFormateado(gasto) }}</p>

        <div class="acciones-gasto">
          <button type="button" class="enlace-secundario indicador-editar" @click="abrirModalEdicion(gasto)">
            Editar ›
          </button>
          <button type="button" class="enlace-secundario" @click="pedirConfirmacionEliminar(gasto)">Eliminar</button>
        </div>
      </li>
    </ul>

    <div v-else-if="sinGastos" class="estado-vacio estado-vacio-generico">
      <p class="mensaje-vacio">Todavía no hay gastos registrados.</p>
      <button type="button" class="boton-primario boton-nuevo" @click="abrirModalAlta">
        Nuevo gasto
      </button>
    </div>

    <div v-else-if="sinResultadosPorFiltro" class="estado-vacio estado-vacio-filtro">
      <span class="icono-vacio-filtro" aria-hidden="true">🔍</span>
      <p class="mensaje-vacio">Sin gastos con este filtro</p>
      <p class="sugerencia-vacio">Prueba cambiar el filtro o registra el primer gasto del mes.</p>
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
.pagina-historial {
  max-width: 720px;
  margin: 0 auto;
  padding: var(--espacio-6) var(--espacio-4);
}

.cabecera-historial {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--espacio-4);
  margin-bottom: var(--espacio-6);
}

.cabecera-historial h1 {
  font-size: clamp(20px, 4vw, 26px);
  margin: 0;
}

.boton-nuevo {
  width: auto;
  min-height: 44px;
  margin-top: 0;
  padding: 0 var(--espacio-4);
}

.lista-gastos {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--espacio-2);
}

.fila-gasto {
  display: flex;
  align-items: center;
  gap: var(--espacio-3);
  background: var(--color-fondo);
  border: 1px solid var(--color-borde-tarjeta);
  border-radius: 18px;
  padding: var(--espacio-3) var(--espacio-4);
}

.circulo-categoria {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  flex-shrink: 0;
  color: #fff;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.detalle-gasto {
  flex: 1;
  min-width: 0;
}

.descripcion-gasto {
  margin: 0;
  font-weight: 700;
  color: var(--color-texto);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metadatos-gasto {
  margin: 2px 0 0;
  font-size: var(--tamano-pequeno);
  color: var(--color-texto-secundario);
}

.monto-gasto {
  margin: 0;
  font-weight: 700;
  color: var(--color-texto);
  white-space: nowrap;
}

.acciones-gasto {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.acciones-gasto button {
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
</style>
