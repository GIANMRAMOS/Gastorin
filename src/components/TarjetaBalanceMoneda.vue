<script setup lang="ts">
import { computed } from 'vue'
import { useMoneda } from '@/composables/useMoneda'
import type { Moneda } from '@/types/gasto'

/**
 * Tarjeta de balance neto por moneda (Épica 11, HU-11.4): ingresos − gastos
 * del mes, coloreado según el signo. Presentacional puro: recibe ya
 * calculados los totales desde `DashboardView` (vía `cargarBalancePorMoneda`).
 * Único acceso a Ingresos en móvil, vía el enlace "Ver ingresos".
 */
const props = withDefaults(
  defineProps<{
    moneda: Moneda
    ingresos: number
    gastos: number
    balance: number
    /** Balance equivalente en una segunda moneda, mostrado como insignia informativa. Opcional. */
    montoSecundario?: number
    /** Moneda del monto secundario (requerida junto a `montoSecundario` para mostrar la insignia). */
    monedaSecundaria?: Moneda
  }>(),
  {
    montoSecundario: undefined,
    monedaSecundaria: undefined,
  },
)

const { formatearMonto } = useMoneda()

/** Balance formateado según la moneda de la tarjeta. */
const balanceFormateado = computed(() => formatearMonto(props.balance, props.moneda))

/** Balance negativo se resalta en rojo (color de error); cero o positivo, en verde primario. */
const esNegativo = computed(() => props.balance < 0)

/** Indica si hay datos suficientes para mostrar la insignia de la moneda secundaria. */
const mostrarInsignia = computed(
  () => props.montoSecundario !== undefined && props.monedaSecundaria !== undefined,
)

/** Balance secundario formateado según su propia moneda (independiente de la principal). */
const montoSecundarioFormateado = computed(() => {
  if (props.montoSecundario === undefined || props.monedaSecundaria === undefined) return ''
  return formatearMonto(props.montoSecundario, props.monedaSecundaria)
})
</script>

<template>
  <article class="tarjeta-balance-moneda">
    <p class="etiqueta-balance">Balance {{ moneda }}</p>
    <p class="monto-balance" :class="esNegativo ? 'balance-negativo' : 'balance-positivo'">
      <span aria-hidden="true">{{ esNegativo ? '▼' : '▲' }}</span>
      {{ balanceFormateado }}
    </p>
    <p v-if="mostrarInsignia" class="insignia-secundaria">{{ montoSecundarioFormateado }}</p>
    <router-link :to="{ name: 'ingresos' }" class="enlace-ver-ingresos">Ver ingresos</router-link>
  </article>
</template>

<style scoped>
.tarjeta-balance-moneda {
  background: var(--color-fondo);
  border: 1px solid var(--color-borde-tarjeta);
  border-radius: var(--radio-tarjeta);
  padding: var(--espacio-4);
  display: flex;
  flex-direction: column;
  gap: var(--espacio-1);
}

.etiqueta-balance {
  margin: 0;
  font-size: var(--tamano-pequeno);
  font-weight: 600;
  color: var(--color-texto-secundario);
}

.monto-balance {
  margin: 0;
  font-size: clamp(20px, 4.5vw, 28px);
  font-weight: 800;
}

.balance-positivo {
  color: var(--color-primario);
}

.balance-negativo {
  color: var(--color-error);
}

.enlace-ver-ingresos {
  margin-top: var(--espacio-1);
  font-size: var(--tamano-pequeno);
  font-weight: 600;
  color: var(--color-primario);
  text-decoration: none;
}
.enlace-ver-ingresos:hover {
  text-decoration: underline;
}

.insignia-secundaria {
  align-self: flex-end;
  margin: var(--espacio-1) 0 0;
  padding: 2px var(--espacio-2);
  font-size: var(--tamano-pequeno);
  font-weight: 600;
  color: var(--color-texto-terciario);
  background: var(--color-borde-tarjeta);
  border-radius: var(--radio-tarjeta);
}
</style>
