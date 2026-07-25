<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import FormularioMetaAhorro from '@/components/FormularioMetaAhorro.vue'
import { useUiStore } from '@/stores/ui'
import type { MetaAhorro } from '@/types/metaAhorro'

/**
 * Envoltorio de modal/overlay para el formulario de la meta de ahorro (alta
 * o edición), igual patrón que `ModalPresupuesto.vue`/`ModalCategoria.vue`.
 * Cierra solo con el botón de cierre (X).
 */
defineProps<{
  meta?: MetaAhorro | null
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
        <h2>{{ meta ? 'Editar meta de ahorro' : 'Configura tu meta de ahorro' }}</h2>
        <button type="button" class="modal-cerrar" aria-label="Cerrar" @click="emit('cerrar')">
          &times;
        </button>
      </div>
      <FormularioMetaAhorro :meta="meta" @guardado="emit('guardado')" @cerrar="emit('cerrar')" />
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
