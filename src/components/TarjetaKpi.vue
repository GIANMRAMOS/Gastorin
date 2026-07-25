<script setup lang="ts">
import { computed } from 'vue'
import { useMoneda } from '@/composables/useMoneda'
import type { Moneda } from '@/types/gasto'

/**
 * Tarjeta KPI genérica de la fila superior del Dashboard "Caudal" (Fase 1):
 * reemplaza a `TarjetaHeroBalance` (que agrupaba Ingresos/Egresos/Balance en
 * una sola card oscura con columnas). El diseño separa las 3 métricas en
 * tarjetas independientes; este componente presentacional puro las cubre
 * todas mediante `variante`, sin duplicar marcado. Presentacional puro:
 * recibe el monto ya calculado por `DashboardView` (misma fuente,
 * `cargarBalancePorMoneda`, que ya usaba el hero).
 */
const props = withDefaults(
  defineProps<{
    label: string
    monto: number
    moneda: Moneda
    variante: 'ingreso' | 'egreso' | 'balance'
    subtitulo?: string
    /** Solo tiene sentido en la variante "balance" (puede ser negativo); Ingresos/Egresos son siempre magnitudes positivas. */
    mostrarSigno?: boolean
  }>(),
  { subtitulo: undefined, mostrarSigno: false },
)

const { formatearMonto } = useMoneda()

/** Con signo, cero o positivo se trata como positivo (mismo criterio que el ex-`TarjetaHeroBalance`). */
const esNegativo = computed(() => props.mostrarSigno && props.monto < 0)

/** Signo mostrado por separado del monto (que siempre se formatea en valor absoluto cuando hay signo). */
const signo = computed(() => (esNegativo.value ? '−' : '+'))

const montoFormateado = computed(() =>
  formatearMonto(props.mostrarSigno ? Math.abs(props.monto) : props.monto, props.moneda),
)
</script>

<template>
  <article class="tarjeta-kpi" :class="`tarjeta-kpi-${variante}`">
    <p class="etiqueta-kpi">{{ label }}</p>
    <p class="monto-kpi" :class="{ 'monto-kpi-negativo': esNegativo }">
      <span v-if="mostrarSigno" class="signo-kpi" aria-hidden="true">{{ signo }}</span>{{ montoFormateado }}
    </p>
    <p v-if="subtitulo" class="subtitulo-kpi">{{ subtitulo }}</p>
  </article>
</template>

<style scoped>
.tarjeta-kpi {
  background: var(--color-fondo);
  border: 1px solid var(--color-borde-tarjeta);
  border-radius: var(--radio-tarjeta);
  padding: var(--espacio-4);
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.etiqueta-kpi {
  margin: 0;
  font-size: var(--tamano-pequeno);
  font-weight: 600;
  color: var(--color-texto-secundario);
}

.monto-kpi {
  margin: 0;
  font-family: var(--fuente-mono);
  font-weight: 700;
  font-size: clamp(19px, 3.2vw, 25px);
  letter-spacing: -0.02em;
  color: var(--color-texto);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.signo-kpi {
  margin-right: 2px;
}

.subtitulo-kpi {
  margin: 0;
  font-size: 0.75rem;
  color: var(--color-texto-terciario);
}

/* Variante Ingresos: monto en verde (oklch, paleta Caudal). */
.tarjeta-kpi-ingreso .monto-kpi {
  color: oklch(0.5 0.1 155);
}

/* Variante Egresos: monto en coral (oklch, paleta Caudal). */
.tarjeta-kpi-egreso .monto-kpi {
  color: oklch(0.52 0.14 25);
}

/* Variante Balance: card oscura (misma tinta que el resto de la marca), texto blanco. */
.tarjeta-kpi-balance {
  background: #1a1a18;
  border-color: #1a1a18;
}

.tarjeta-kpi-balance .etiqueta-kpi {
  color: rgba(255, 255, 255, 0.7);
}

.tarjeta-kpi-balance .monto-kpi {
  color: #fff;
}

.tarjeta-kpi-balance .monto-kpi.monto-kpi-negativo {
  color: oklch(0.7 0.14 25);
}

.tarjeta-kpi-balance .subtitulo-kpi {
  color: rgba(255, 255, 255, 0.55);
}
</style>
