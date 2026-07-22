<script setup lang="ts">
/**
 * Diálogo de confirmación reutilizable (ej. eliminar un gasto).
 * Cancelar no ejecuta ninguna acción destructiva: solo emite `cancelar`.
 */
defineProps<{
  mensaje: string
}>()

const emit = defineEmits<{
  confirmar: []
  cancelar: []
}>()
</script>

<template>
  <div class="modal-fondo" @click.self="emit('cancelar')">
    <div class="modal-contenido" role="alertdialog" aria-modal="true">
      <p>{{ mensaje }}</p>
      <div class="dialogo-acciones">
        <button type="button" class="boton-primario" @click="emit('confirmar')">Confirmar</button>
        <button type="button" class="enlace-secundario" @click="emit('cancelar')">Cancelar</button>
      </div>
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
  z-index: 200;
}

.modal-contenido {
  background: var(--color-fondo);
  border: 1px solid var(--color-borde-tarjeta);
  border-radius: var(--radio-tarjeta);
  box-shadow: 0 20px 48px rgba(21, 26, 24, 0.16);
  padding: var(--espacio-6) var(--espacio-4);
  max-width: var(--ancho-maximo-formulario);
  width: 100%;
}

.dialogo-acciones {
  display: flex;
  align-items: center;
  gap: var(--espacio-4);
  margin-top: var(--espacio-4);
}
</style>
