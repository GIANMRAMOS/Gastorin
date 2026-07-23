<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import FormularioGasto from '@/components/FormularioGasto.vue'
import { useUiStore } from '@/stores/ui'
import type { Gasto } from '@/types/gasto'

/**
 * Envoltorio de modal/overlay para el formulario de gasto (alta o edición).
 * No es una ruta aparte: la vista controla su apertura con `v-if`. Cierra
 * solo con el botón de cierre (X).
 */
defineProps<{
  gasto?: Gasto | null
}>()

const emit = defineEmits<{
  cerrar: []
  guardado: []
}>()

const storeUi = useUiStore()

onMounted(() => {
  storeUi.abrirModal()
})
onUnmounted(() => {
  storeUi.cerrarModal()
})
</script>

<template>
  <div class="modal-fondo">
    <div class="modal-contenido" role="dialog" aria-modal="true">
      <div class="modal-cabecera">
        <h2>{{ gasto ? 'Editar gasto' : 'Nuevo gasto' }}</h2>
        <button type="button" class="modal-cerrar" aria-label="Cerrar" @click="emit('cerrar')">
          &times;
        </button>
      </div>
      <FormularioGasto :gasto="gasto" @guardado="emit('guardado')" @cerrar="emit('cerrar')" />
    </div>
  </div>
</template>

<style scoped>
.modal-fondo {
  position: fixed;
  inset: 0;
  background: rgb(0 0 0 / 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--espacio-4);
  z-index: 100;
}

.modal-contenido {
  background: var(--color-fondo);
  border: 1px solid var(--color-borde-tarjeta);
  border-radius: var(--radio-tarjeta);
  box-shadow: 0 20px 48px rgba(21, 26, 24, 0.16);
  padding: var(--espacio-6) var(--espacio-4);
  max-width: var(--ancho-maximo-formulario);
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-cabecera {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--espacio-4);
}

.modal-cabecera h2 {
  font-size: var(--tamano-titulo);
  margin: 0;
}

.modal-cerrar {
  background: none;
  border: none;
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
  color: var(--color-texto-secundario);
}
</style>
