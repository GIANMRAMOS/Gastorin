<script setup lang="ts">
/**
 * Estado vacío compartido por los CTA de la vista de Presupuestos (Épica
 * 15): "Configura tu primer presupuesto" (sin presupuestos del mes en la
 * moneda activa) y "Configura tu meta de ahorro" (sin fila en
 * `metas_ahorro`). Mismo componente/estilo base para ambos casos (regla
 * transversal del brief); el tercer estado vacío del brief — mes anterior
 * sin presupuestos — es un botón deshabilitado dentro de la propia vista, no
 * un CTA de esta forma (no hay ninguna acción que ofrecer ahí).
 */
defineProps<{
  titulo: string
  mensaje: string
  etiquetaBoton: string
}>()

const emit = defineEmits<{
  accion: []
}>()
</script>

<template>
  <div class="estado-vacio-cta">
    <p class="titulo-estado-vacio">{{ titulo }}</p>
    <p class="mensaje-estado-vacio">{{ mensaje }}</p>
    <button type="button" class="boton-primario boton-estado-vacio" @click="emit('accion')">
      {{ etiquetaBoton }}
    </button>
  </div>
</template>

<style scoped>
.estado-vacio-cta {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--espacio-2);
  padding: var(--espacio-4);
  text-align: left;
}

.titulo-estado-vacio {
  margin: 0;
  font-weight: 700;
  color: var(--color-texto);
}

.mensaje-estado-vacio {
  margin: 0;
  font-size: var(--tamano-pequeno);
  color: var(--color-texto-secundario);
}

.boton-estado-vacio {
  width: auto;
  min-height: 40px;
  margin-top: var(--espacio-2);
  padding: 0 var(--espacio-4);
}
</style>
