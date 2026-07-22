<script setup lang="ts">
import { computed } from 'vue'
import { useMoneda } from '@/composables/useMoneda'
import type { Moneda } from '@/types/gasto'

/**
 * Tarjeta de resumen mensual por moneda (HU-7.1): monto grande + variación
 * porcentual contra el mes anterior. Presentacional puro: recibe ya
 * calculados `total` y `variacionPct` desde `DashboardView`.
 */
const props = defineProps<{
  moneda: Moneda
  total: number
  variacionPct: number | null
}>()

const { formatearMonto } = useMoneda()

/** Monto del total formateado según la moneda de la tarjeta. */
const totalFormateado = computed(() => formatearMonto(props.total, props.moneda))

/** Sentido de la variación: sube (rojo/naranja), baja (verde) o sin dato. */
const sentidoVariacion = computed<'sube' | 'baja' | null>(() => {
  if (props.variacionPct === null) return null
  if (props.variacionPct > 0) return 'sube'
  if (props.variacionPct < 0) return 'baja'
  return null
})

/** Texto de la variación absoluta con un decimal, sin signo (el signo lo da la flecha). */
const variacionTexto = computed(() => {
  if (props.variacionPct === null) return null
  return `${Math.abs(props.variacionPct).toFixed(1)}%`
})
</script>

<template>
  <article class="tarjeta-resumen-moneda">
    <p class="etiqueta-resumen">Gastado este mes</p>
    <p class="monto-resumen">{{ totalFormateado }}</p>
    <p
      v-if="sentidoVariacion"
      class="variacion-resumen"
      :class="`variacion-${sentidoVariacion}`"
    >
      <span aria-hidden="true">{{ sentidoVariacion === 'sube' ? '▲' : '▼' }}</span>
      {{ variacionTexto }} vs. mes anterior
    </p>
    <p v-else class="variacion-resumen variacion-sin-dato">Sin variación</p>
  </article>
</template>

<style scoped>
.tarjeta-resumen-moneda {
  background: var(--color-fondo);
  border: 1px solid var(--color-borde-tarjeta);
  border-radius: var(--radio-tarjeta);
  padding: var(--espacio-4);
  display: flex;
  flex-direction: column;
  gap: var(--espacio-1);
}

.etiqueta-resumen {
  margin: 0;
  font-size: var(--tamano-pequeno);
  font-weight: 600;
  color: var(--color-texto-secundario);
}

.monto-resumen {
  margin: 0;
  font-size: clamp(24px, 5vw, 32px);
  font-weight: 800;
  color: var(--color-texto);
}

.variacion-resumen {
  margin: 0;
  font-size: var(--tamano-pequeno);
  font-weight: 600;
}

.variacion-sube {
  color: var(--color-error);
}

.variacion-baja {
  color: var(--color-exito);
}

.variacion-sin-dato {
  color: var(--color-texto-terciario);
}
</style>
