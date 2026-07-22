<script setup lang="ts">
import { onMounted, ref } from 'vue'
import ModalPresupuesto from '@/components/ModalPresupuesto.vue'
import DialogoConfirmacion from '@/components/DialogoConfirmacion.vue'
import TarjetaPresupuesto from '@/components/TarjetaPresupuesto.vue'
import { usePresupuestos, calcularGastado } from '@/composables/usePresupuestos'
import { useCategorias } from '@/composables/useCategorias'
import { useGastos } from '@/composables/useGastos'
import { useGastosStore } from '@/stores/gastos'
import type { Presupuesto } from '@/types/gasto'

/**
 * Gestión de presupuestos mensuales (Épica 6), espejo de `CategoriasView`.
 * Carga categorías, gastos (confirmados) y presupuestos del mes actual en
 * `onMounted`; cada tarjeta deriva su "gastado" client-side con
 * `calcularGastado` sobre `storeGastos.gastos`.
 */
const { cargarPresupuestos, eliminarPresupuesto } = usePresupuestos()
const { cargarCategorias } = useCategorias()
const { cargarGastos } = useGastos()
const storeGastos = useGastosStore()

const modalAbierto = ref(false)
const presupuestoSeleccionado = ref<Presupuesto | null>(null)
const presupuestoAEliminar = ref<Presupuesto | null>(null)

onMounted(() => {
  cargarCategorias()
  cargarGastos()
  cargarPresupuestos()
})

/** Abre el modal en modo alta. */
function abrirModalAlta() {
  presupuestoSeleccionado.value = null
  modalAbierto.value = true
}

/** Abre el modal de edición con el presupuesto tocado. */
function abrirModalEdicion(presupuesto: Presupuesto) {
  presupuestoSeleccionado.value = presupuesto
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

/** Pide confirmación de eliminación directamente desde la tarjeta. */
function pedirEliminarDesdeTarjeta(presupuesto: Presupuesto) {
  presupuestoAEliminar.value = presupuesto
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
</script>

<template>
  <main class="pagina-presupuestos">
    <div class="cabecera-presupuestos">
      <h1>Presupuestos</h1>
      <button type="button" class="boton-primario boton-nuevo" @click="abrirModalAlta">
        + Nuevo presupuesto
      </button>
    </div>

    <p v-if="storeGastos.error" role="alert" class="mensaje-error">{{ storeGastos.error }}</p>

    <ul v-if="storeGastos.presupuestos.length > 0" class="lista-presupuestos">
      <TarjetaPresupuesto
        v-for="presupuesto in storeGastos.presupuestos"
        :key="presupuesto.id"
        :presupuesto="presupuesto"
        :gastado="calcularGastado(storeGastos.gastos, presupuesto)"
        @editar="abrirModalEdicion(presupuesto)"
        @eliminar="pedirEliminarDesdeTarjeta(presupuesto)"
      />
    </ul>
    <p v-else class="mensaje-vacio-seccion">Todavía no tienes presupuestos para este mes.</p>

    <ModalPresupuesto
      v-if="modalAbierto"
      :presupuesto="presupuestoSeleccionado"
      @cerrar="cerrarModal"
      @guardado="manejarGuardado"
      @pedir-eliminar="pedirConfirmacionEliminar"
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
  max-width: 720px;
  margin: 0 auto;
  padding: var(--espacio-6) var(--espacio-4);
}

.cabecera-presupuestos {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--espacio-4);
  margin-bottom: var(--espacio-6);
}

.cabecera-presupuestos h1 {
  font-size: clamp(20px, 4vw, 26px);
  margin: 0;
}

.boton-nuevo {
  width: auto;
  min-height: 44px;
  margin-top: 0;
  padding: 0 var(--espacio-4);
}

.lista-presupuestos {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--espacio-3);
}

.mensaje-vacio-seccion {
  color: var(--color-texto-secundario);
  font-size: var(--tamano-pequeno);
  margin: 0;
}
</style>
