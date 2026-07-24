<script setup lang="ts">
import { useMoneda } from '@/composables/useMoneda'
import { etiquetaFecha } from '@/composables/useFechas'
import type { MovimientoUnificado } from '@/composables/useDashboard'

/**
 * Widget "Últimos movimientos" del Dashboard: presentacional puro, igual que
 * `ListaGastoPorCategoria`. `movimientos` ya viene ordenado y recortado desde
 * `combinarUltimosMovimientos`; este componente solo formatea fecha/monto y
 * resuelve el color/indicador según el tipo. Sin link "Ver todos" (no existe
 * vista combinada de movimientos, ver micro-plan).
 */
defineProps<{
  movimientos: MovimientoUnificado[]
}>()

const { formatearMonto } = useMoneda()
</script>

<template>
  <div class="ultimos-movimientos">
    <ul v-if="movimientos.length > 0" class="items-movimiento">
      <li v-for="movimiento in movimientos" :key="movimiento.id" class="item-movimiento">
        <span
          class="indicador-tipo-movimiento"
          :class="movimiento.tipo === 'gasto' ? 'indicador-gasto' : 'indicador-ingreso'"
          :aria-label="movimiento.tipo === 'gasto' ? 'Gasto' : 'Ingreso'"
        >
          {{ movimiento.tipo === 'gasto' ? '↓' : '↑' }}
        </span>

        <div class="detalle-movimiento">
          <p class="descripcion-movimiento">{{ movimiento.descripcion || 'Sin descripción' }}</p>
          <p class="fecha-movimiento">{{ etiquetaFecha(movimiento.fecha) }}</p>
        </div>

        <p
          class="monto-movimiento"
          :class="movimiento.tipo === 'gasto' ? 'monto-gasto' : 'monto-ingreso'"
        >
          {{ formatearMonto(movimiento.monto, movimiento.moneda) }}
        </p>
      </li>
    </ul>
    <p v-else class="mensaje-vacio-seccion">Aún no hay movimientos.</p>
  </div>
</template>

<style scoped>
.items-movimiento {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--espacio-3);
}

.item-movimiento {
  display: flex;
  align-items: center;
  gap: var(--espacio-3);
}

.indicador-tipo-movimiento {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: #fff;
}

.indicador-gasto {
  background: var(--color-error);
}

.indicador-ingreso {
  background: var(--color-exito);
}

.detalle-movimiento {
  flex: 1;
  min-width: 0;
}

.descripcion-movimiento {
  margin: 0;
  font-weight: 700;
  color: var(--color-texto);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fecha-movimiento {
  margin: 2px 0 0;
  font-size: var(--tamano-pequeno);
  color: var(--color-texto-secundario);
}

.monto-movimiento {
  margin: 0;
  font-weight: 700;
  white-space: nowrap;
}

.monto-gasto {
  color: var(--color-error);
}

.monto-ingreso {
  color: var(--color-exito);
}

.mensaje-vacio-seccion {
  color: var(--color-texto-secundario);
  font-size: var(--tamano-pequeno);
  margin: 0;
}
</style>
