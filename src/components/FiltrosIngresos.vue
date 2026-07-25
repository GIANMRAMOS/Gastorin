<script setup lang="ts">
import { formatearMes } from '@/composables/useFechas'
import type { Categoria } from '@/types/gasto'
import type { Banco } from '@/types/ingreso'

/**
 * Barra de filtros de Ingresos (rediseño "Caudal", Fase 2): chips de moneda
 * (Todos/Soles/Dólares) + buscador de texto libre (por concepto) + dropdowns
 * de categoría, banco y mes (rotulado "Julio 2026"). Componente
 * presentacional puro (patrón `v-model`/emit, igual que `FiltrosHistorial`):
 * no calcula el filtrado, solo emite la selección para que la vista la
 * aplique sobre `store.ingresos`. `categorias` ya debe venir filtrada a
 * `tipo === 'ingreso'` por quien la usa. A diferencia de `FiltrosHistorial`,
 * ahora SÍ tiene filtro de categoría: desde la migración 008, Ingreso tiene
 * su propio catálogo de categorías (Épica 12).
 */
const props = defineProps<{
  moneda: 'todos' | 'PEN' | 'USD'
  categoriaId: string
  bancoId: string
  mes: string
  busqueda: string
  categorias: Categoria[]
  bancos: Banco[]
  mesesDisponibles: string[]
}>()

const emit = defineEmits<{
  'update:moneda': ['todos' | 'PEN' | 'USD']
  'update:categoriaId': [string]
  'update:bancoId': [string]
  'update:mes': [string]
  'update:busqueda': [string]
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

    <div class="fila-buscador">
      <input
        type="search"
        class="entrada-buscador"
        placeholder="Buscar por concepto…"
        aria-label="Buscar por concepto"
        :value="props.busqueda"
        @input="emit('update:busqueda', ($event.target as HTMLInputElement).value)"
      />
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
        aria-label="Filtrar por banco"
        :value="props.bancoId"
        @change="emit('update:bancoId', ($event.target as HTMLSelectElement).value)"
      >
        <option value="">Todos los bancos</option>
        <option v-for="banco in props.bancos" :key="banco.id" :value="banco.id">
          {{ banco.nombre }}
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
          {{ formatearMes(mes) }}
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

.fila-buscador {
  display: flex;
}

.entrada-buscador {
  flex: 1;
  min-height: 44px;
  padding: 0 var(--espacio-3);
  border: 1px solid var(--color-borde);
  border-radius: var(--radio-borde);
  font-family: var(--fuente-base);
  font-size: var(--tamano-pequeno);
  color: var(--color-texto);
  background: var(--color-fondo);
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
