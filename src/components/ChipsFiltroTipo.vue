<script setup lang="ts">
import type { TipoFiltroMovimiento } from '@/composables/useDashboard'

/**
 * Chips segmentados para filtrar el feed de movimientos por tipo
 * (Todos/Ingresos/Egresos), patrón espejo de `ToggleMoneda.vue`.
 * Presentacional puro: `DashboardView` gobierna el `ref` de `tipoFiltro` y
 * pasa el resultado ya filtrado a `FeedMovimientos`.
 */
const props = defineProps<{
  modelValue: TipoFiltroMovimiento
}>()

const emit = defineEmits<{
  'update:modelValue': [TipoFiltroMovimiento]
}>()

/** Emite el nuevo tipo elegido. */
function elegir(valor: TipoFiltroMovimiento) {
  if (props.modelValue === valor) return
  emit('update:modelValue', valor)
}
</script>

<template>
  <div class="chips-filtro-tipo" role="group" aria-label="Filtrar por tipo de movimiento">
    <button
      type="button"
      class="chip-filtro-tipo"
      :class="{ activo: modelValue === 'todos' }"
      @click="elegir('todos')"
    >
      Todos
    </button>
    <button
      type="button"
      class="chip-filtro-tipo"
      :class="{ activo: modelValue === 'ingresos' }"
      @click="elegir('ingresos')"
    >
      Ingresos
    </button>
    <button
      type="button"
      class="chip-filtro-tipo"
      :class="{ activo: modelValue === 'egresos' }"
      @click="elegir('egresos')"
    >
      Egresos
    </button>
  </div>
</template>

<style scoped>
.chips-filtro-tipo {
  display: inline-flex;
  background: var(--color-fondo-app);
  border-radius: var(--radio-borde);
  padding: 4px;
  gap: 4px;
}

.chip-filtro-tipo {
  border: none;
  background: transparent;
  padding: var(--espacio-2) var(--espacio-4);
  border-radius: 10px;
  font-weight: 600;
  font-size: var(--tamano-pequeno);
  color: var(--color-texto-secundario);
  cursor: pointer;
  font-family: var(--fuente-base);
}
.chip-filtro-tipo.activo {
  background: var(--color-fondo);
  color: var(--color-texto);
  box-shadow: 0 1px 4px rgba(21, 26, 24, 0.12);
}
</style>
