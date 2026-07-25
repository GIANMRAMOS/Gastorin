<script setup lang="ts">
import { computed } from 'vue'
import { useMoneda } from '@/composables/useMoneda'
import { agruparPorFecha } from '@/composables/useFechas'
import type { MovimientoUnificado } from '@/composables/useDashboard'

/**
 * Movimiento del feed, ya enriquecido por `DashboardView` con los nombres
 * resueltos de categoría/banco (contra `storeGastos.categorias`/
 * `storeIngresos.bancos`). `nombreCategoria` es `null` en un ingreso (los
 * ingresos no tienen categoría, ver `MovimientoUnificado`).
 */
export interface MovimientoFeed extends MovimientoUnificado {
  nombreCategoria: string | null
  nombreBanco: string
}

/**
 * Feed unificado de movimientos de la pantalla "Inicio" (Fase 0 "Caudal"):
 * reemplaza a `UltimosMovimientos.vue` (que queda fuera del Dashboard, sin
 * borrarse). Presentacional puro: `movimientos` ya viene filtrado (mes,
 * moneda, tipo) y ordenado desde `combinarMovimientosDelMes`; este componente
 * solo agrupa por fecha (`agruparPorFecha`) y formatea cada fila.
 */
const props = defineProps<{
  movimientos: MovimientoFeed[]
}>()

const { formatearMonto } = useMoneda()

/** Grupos por fecha (etiqueta "Hoy"/"Ayer"/fecha larga + sus movimientos), en el orden ya recibido. */
const grupos = computed(() => agruparPorFecha(props.movimientos, (m) => m.fecha))

/** Inicial mostrada en el cuadro redondeado de cada fila (primera letra del concepto). */
function inicialMovimiento(movimiento: MovimientoFeed): string {
  const texto = movimiento.descripcion.trim()
  return texto ? texto.charAt(0).toUpperCase() : '?'
}

/**
 * Línea secundaria de cada fila: "categoría · banco" en un gasto; solo el
 * banco en un ingreso (los ingresos no tienen categoría).
 */
function subtituloMovimiento(movimiento: MovimientoFeed): string {
  if (movimiento.tipo === 'ingreso') return movimiento.nombreBanco
  return `${movimiento.nombreCategoria ?? 'Categoría'} · ${movimiento.nombreBanco}`
}
</script>

<template>
  <div class="feed-movimientos">
    <div v-if="movimientos.length > 0" class="grupos-feed">
      <div v-for="grupo in grupos" :key="grupo.etiqueta" class="grupo-feed">
        <h3 class="etiqueta-grupo-feed">{{ grupo.etiqueta }}</h3>
        <ul class="items-feed">
          <li v-for="movimiento in grupo.items" :key="movimiento.id" class="item-feed">
            <span class="inicial-feed">{{ inicialMovimiento(movimiento) }}</span>

            <div class="detalle-feed">
              <p class="concepto-feed">{{ movimiento.descripcion || 'Sin descripción' }}</p>
              <p class="subtitulo-feed">{{ subtituloMovimiento(movimiento) }}</p>
            </div>

            <p
              class="monto-feed"
              :class="movimiento.tipo === 'gasto' ? 'monto-feed-egreso' : 'monto-feed-ingreso'"
            >
              <span aria-hidden="true">{{ movimiento.tipo === 'gasto' ? '−' : '+' }}</span>
              {{ formatearMonto(movimiento.monto, movimiento.moneda) }}
            </p>
          </li>
        </ul>
      </div>
    </div>
    <p v-else class="mensaje-vacio-feed">Ningún movimiento con estos filtros.</p>
  </div>
</template>

<style scoped>
.grupos-feed {
  display: flex;
  flex-direction: column;
  gap: var(--espacio-4);
}

.etiqueta-grupo-feed {
  margin: 0 0 var(--espacio-2);
  font-size: var(--tamano-pequeno);
  font-weight: 700;
  color: var(--color-texto-secundario);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.items-feed {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--espacio-3);
}

.item-feed {
  display: flex;
  align-items: center;
  gap: var(--espacio-3);
}

.inicial-feed {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 10px;
  background: var(--color-fondo-app);
  color: var(--color-texto-secundario);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}

.detalle-feed {
  flex: 1;
  min-width: 0;
}

.concepto-feed {
  margin: 0;
  font-weight: 600;
  color: var(--color-texto);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.subtitulo-feed {
  margin: 2px 0 0;
  font-size: var(--tamano-pequeno);
  color: var(--color-texto-secundario);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.monto-feed {
  margin: 0;
  flex-shrink: 0;
  font-family: var(--fuente-mono);
  font-weight: 600;
  white-space: nowrap;
}

.monto-feed-egreso {
  color: var(--color-error);
}

.monto-feed-ingreso {
  color: var(--color-exito);
}

.mensaje-vacio-feed {
  margin: 0;
  color: var(--color-texto-secundario);
  font-size: var(--tamano-pequeno);
}
</style>
