<script setup lang="ts">
import type { Categoria } from '@/types/gasto'

/**
 * Barra de filtros del historial: chips de moneda (Todos/Soles/Dólares) +
 * dropdowns de categoría y mes. Componente presentacional puro (patrón
 * `v-model`/emit, como `ToggleMoneda`): no calcula el filtrado, solo emite
 * la selección para que la vista la aplique sobre `store.gastos`.
 */
const props = defineProps<{
  moneda: 'todos' | 'PEN' | 'USD'
  categoriaId: string
  mes: string
  categorias: Categoria[]
  mesesDisponibles: string[]
}>()

const emit = defineEmits<{
  'update:moneda': ['todos' | 'PEN' | 'USD']
  'update:categoriaId': [string]
  'update:mes': [string]
}>()

/** Chips de moneda disponibles, con su etiqueta visual. */
const CHIPS_MONEDA: Array<{ valor: 'todos' | 'PEN' | 'USD'; etiqueta: string }> = [
  { valor: 'todos', etiqueta: 'Todos' },
  { valor: 'PEN', etiqueta: 'S/ Soles' },
  { valor: 'USD', etiqueta: '$ Dólares' },
]

/** Selecciona un chip de moneda (uno activo a la vez). */
function elegirMoneda(valor: 'todos' | 'PEN' | 'USD') {
  emit('update:moneda', valor)
}
</script>

<template>
  <div class="filtros-historial">
    <div class="chips-moneda" role="group" aria-label="Filtrar por moneda">
      <button
        v-for="chip in CHIPS_MONEDA"
        :key="chip.valor"
        type="button"
        class="chip-moneda"
        :class="{ activo: props.moneda === chip.valor }"
        @click="elegirMoneda(chip.valor)"
      >
        {{ chip.etiqueta }}
      </button>
    </div>

    <div class="selects-filtro">
      <select
        class="select-filtro"
        aria-label="Filtrar por categoría"
        :value="props.categoriaId"
        @change="emit('update:categoriaId', ($event.target as HTMLSelectElement).value)"
      >
        <option value="">Todas las categorías</option>
        <option v-for="categoria in props.categorias" :key="categoria.id" :value="categoria.id">
          {{ categoria.nombre }}
        </option>
      </select>

      <select
        class="select-filtro"
        aria-label="Filtrar por mes"
        :value="props.mes"
        @change="emit('update:mes', ($event.target as HTMLSelectElement).value)"
      >
        <option value="">Todos los meses</option>
        <option v-for="mes in props.mesesDisponibles" :key="mes" :value="mes">
          {{ mes }}
        </option>
      </select>
    </div>
  </div>
</template>

<style scoped>
.filtros-historial {
  display: flex;
  flex-direction: column;
  gap: var(--espacio-3);
  margin-bottom: var(--espacio-4);
}

.chips-moneda {
  display: flex;
  gap: var(--espacio-2);
}

.chip-moneda {
  padding: var(--espacio-2) var(--espacio-3);
  border-radius: 999px;
  border: 1px solid var(--color-borde);
  background: var(--color-fondo);
  font-size: var(--tamano-pequeno);
  font-weight: 600;
  color: var(--color-texto-secundario);
  cursor: pointer;
  font-family: var(--fuente-base);
}
.chip-moneda.activo {
  border-color: var(--color-primario);
  background: #e2f4f1;
  color: #0b7a6e;
}

.selects-filtro {
  display: flex;
  gap: var(--espacio-2);
  flex-wrap: wrap;
}

.select-filtro {
  flex: 1;
  min-width: 140px;
  min-height: 44px;
  padding: 0 var(--espacio-3);
  border: 1px solid var(--color-borde);
  border-radius: var(--radio-borde);
  font-family: var(--fuente-base);
  font-size: var(--tamano-pequeno);
  color: var(--color-texto);
  background: var(--color-fondo);
}
</style>
