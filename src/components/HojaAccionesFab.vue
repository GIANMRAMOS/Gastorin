<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useUiStore } from '@/stores/ui'

/**
 * Bottom sheet del FAB móvil (Épica 11, UX): ofrece elegir entre registrar un
 * gasto o un ingreso. Cierra solo con el botón "Cancelar" (no tiene botón X).
 * Llama `storeUi.abrirModal()`/`cerrarModal()` al montarse/desmontarse para
 * que el bottom nav se oculte detrás de la hoja.
 */
const emit = defineEmits<{
  cerrar: []
  'registrar-gasto': []
  'registrar-ingreso': []
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
  <div class="hoja-fondo">
    <div class="hoja-contenido" role="dialog" aria-modal="true">
      <button type="button" class="opcion-hoja" @click="emit('registrar-gasto')">
        Registrar gasto
      </button>
      <button type="button" class="opcion-hoja" @click="emit('registrar-ingreso')">
        Registrar ingreso
      </button>
      <button type="button" class="enlace-secundario boton-cancelar-hoja" @click="emit('cerrar')">
        Cancelar
      </button>
    </div>
  </div>
</template>

<style scoped>
.hoja-fondo {
  position: fixed;
  inset: 0;
  background: rgb(0 0 0 / 0.5);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 100;
}

.hoja-contenido {
  background: var(--color-fondo);
  border-radius: 20px 20px 0 0;
  padding: var(--espacio-6) var(--espacio-4);
  width: 100%;
  max-width: 720px;
  display: flex;
  flex-direction: column;
  gap: var(--espacio-2);
}

.opcion-hoja {
  min-height: 44px;
  padding: 0 var(--espacio-4);
  border: 1px solid var(--color-borde);
  border-radius: var(--radio-borde);
  background: var(--color-fondo);
  color: var(--color-texto);
  font-weight: 600;
  font-size: var(--tamano-base);
  cursor: pointer;
  font-family: var(--fuente-base);
}
.opcion-hoja:hover {
  background: var(--color-fondo-app);
}

.boton-cancelar-hoja {
  min-height: 44px;
  margin-top: var(--espacio-2);
}
</style>
