<script setup lang="ts">
import { computed } from 'vue'
import { useColorCategoria } from '@/composables/useColorCategoria'
import { useMoneda } from '@/composables/useMoneda'
import type { Moneda } from '@/types/gasto'

/**
 * Barras horizontales de gasto por categoría (HU-7.2). Presentacional puro:
 * `items` ya viene ordenado de mayor a menor total desde
 * `cargarGastoPorCategoria`; este componente solo resuelve color/formato y
 * calcula el ancho proporcional de cada barra respecto al máximo del set.
 */
const props = defineProps<{
  items: Array<{ categoria_id: string; nombre: string; total: number }>
  moneda: Moneda
}>()

const { colorCategoria } = useColorCategoria()
const { formatearMonto } = useMoneda()

/** Total máximo del set, usado como base del 100% de ancho de las barras. */
const totalMaximo = computed(() => props.items.reduce((max, item) => Math.max(max, item.total), 0))

/** Ancho porcentual de la barra de una categoría, proporcional al máximo. */
function anchoBarra(total: number): string {
  if (totalMaximo.value <= 0) return '0%'
  return `${(total / totalMaximo.value) * 100}%`
}
</script>

<template>
  <div class="lista-gasto-categoria">
    <ul v-if="items.length > 0" class="items-categoria">
      <li v-for="item in items" :key="item.categoria_id" class="item-categoria">
        <div class="cabecera-item-categoria">
          <span class="nombre-item-categoria">
            <span class="punto-categoria" :style="{ background: colorCategoria(item.nombre) }" />
            {{ item.nombre }}
          </span>
          <span class="monto-item-categoria">{{ formatearMonto(item.total, moneda) }}</span>
        </div>
        <div class="barra-categoria-envoltorio">
          <div
            class="barra-categoria"
            :style="{ width: anchoBarra(item.total), background: colorCategoria(item.nombre) }"
          />
        </div>
      </li>
    </ul>
    <p v-else class="mensaje-vacio-seccion">Sin gastos este mes.</p>
  </div>
</template>

<style scoped>
.items-categoria {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--espacio-3);
}

.item-categoria {
  display: flex;
  flex-direction: column;
  gap: var(--espacio-1);
}

.cabecera-item-categoria {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--espacio-2);
}

.nombre-item-categoria {
  display: inline-flex;
  align-items: center;
  gap: var(--espacio-2);
  font-size: var(--tamano-pequeno);
  font-weight: 600;
  color: var(--color-texto);
}

.punto-categoria {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.monto-item-categoria {
  font-size: var(--tamano-pequeno);
  font-weight: 700;
  color: var(--color-texto-secundario);
}

.barra-categoria-envoltorio {
  width: 100%;
  height: 8px;
  border-radius: 999px;
  background: var(--color-fondo-app);
  overflow: hidden;
}

.barra-categoria {
  height: 100%;
  border-radius: 999px;
  transition: width 0.2s ease;
}

.mensaje-vacio-seccion {
  color: var(--color-texto-secundario);
  font-size: var(--tamano-pequeno);
  margin: 0;
}
</style>
