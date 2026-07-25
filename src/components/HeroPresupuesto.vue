<script setup lang="ts">
import { computed } from 'vue'
import { useMoneda } from '@/composables/useMoneda'
import type { Moneda } from '@/types/gasto'

/**
 * Hero oscuro de consumo mensual de presupuesto (Épica 15): reemplaza la
 * cabecera de la vista anterior (una lista simple de tarjetas). Mismo
 * lenguaje visual que `TarjetaKpi` variante "balance" (fondo `#1a1a18`,
 * texto blanco): literal en CSS scoped, no hay token con nombre para ese
 * color (ver micro-plan Fase 4 "Caudal"). Presentacional puro: recibe los
 * totales ya calculados por `PresupuestosView` (suma de los presupuestos de
 * la moneda activa) y respeta el toggle de moneda del encabezado.
 */
const props = defineProps<{
  gastado: number
  limite: number
  moneda: Moneda
  /** Ritmo esperado de gasto al día de hoy, ya calculado por la vista (`diaActual / diasDelMes * 100`). */
  ritmoEsperadoPct: number
  diaActual: number
}>()

const { formatearMonto } = useMoneda()

/** Umbral (en % del límite) a partir del cual el estado pasa a "cerca del límite" (mismo criterio que `TarjetaPresupuesto`). */
const UMBRAL_ADVERTENCIA = 85

/** Porcentaje real consumido del límite total (puede superar 100 en sobregiro); sin límite configurado, 0 (evita división por cero). */
const porcentaje = computed(() => {
  if (props.limite <= 0) return 0
  return (props.gastado / props.limite) * 100
})

const porcentajeTexto = computed(() => Math.round(porcentaje.value))
const porcentajeBarra = computed(() => Math.min(porcentaje.value, 100))

const estadoBarra = computed<'normal' | 'cerca' | 'sobregiro'>(() => {
  if (props.limite <= 0) return 'normal'
  if (porcentaje.value > 100) return 'sobregiro'
  if (porcentaje.value >= UMBRAL_ADVERTENCIA) return 'cerca'
  return 'normal'
})

/** `true` cuando el gasto ya superó el límite total (dispara "excedido en S/Y" en vez de "quedan S/Z"). */
const excedido = computed(() => props.limite > 0 && props.gastado > props.limite)

/** Monto restante (si no excedido) o excedido (si lo está), siempre como magnitud positiva. */
const montoRestanteOExcedido = computed(() => Math.abs(props.gastado - props.limite))

const gastadoFormateado = computed(() => formatearMonto(props.gastado, props.moneda))
const limiteFormateado = computed(() => formatearMonto(props.limite, props.moneda))
const montoRestanteOExcedidoFormateado = computed(() =>
  formatearMonto(montoRestanteOExcedido.value, props.moneda),
)
const ritmoEsperadoTexto = computed(() => Math.round(props.ritmoEsperadoPct))
</script>

<template>
  <section class="hero-presupuesto" aria-label="Consumo del mes">
    <p class="etiqueta-hero">Consumo del mes</p>
    <!-- A11y (mismo criterio que `TarjetaPresupuesto`): el % siempre en blanco, nunca en el color variable de la barra. -->
    <p class="porcentaje-hero">{{ porcentajeTexto }}%</p>

    <p class="linea-montos-hero">
      <span class="monto-gastado-hero">{{ gastadoFormateado }}</span>
      <span class="separador-hero">/</span>
      <span class="monto-limite-hero">{{ limiteFormateado }}</span>
    </p>

    <div class="barra-progreso-envoltorio-hero">
      <div
        class="barra-progreso-hero"
        :class="`estado-${estadoBarra}`"
        :style="{ width: `${porcentajeBarra}%` }"
      />
    </div>

    <p class="nota-ritmo-hero">Ritmo esperado al día {{ diaActual }}: {{ ritmoEsperadoTexto }}%</p>

    <p v-if="excedido" class="nota-restante-hero nota-excedido-hero">
      Excedido en {{ montoRestanteOExcedidoFormateado }}
    </p>
    <p v-else class="nota-restante-hero">Quedan {{ montoRestanteOExcedidoFormateado }}</p>
  </section>
</template>

<style scoped>
.hero-presupuesto {
  background: #1a1a18;
  border: 1px solid #1a1a18;
  border-radius: var(--radio-tarjeta);
  padding: var(--espacio-6) var(--espacio-4);
  display: flex;
  flex-direction: column;
  gap: var(--espacio-2);
  margin-bottom: var(--espacio-4);
}

.etiqueta-hero {
  margin: 0;
  font-size: var(--tamano-pequeno);
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
}

.porcentaje-hero {
  margin: 0;
  font-family: var(--fuente-mono);
  font-weight: 700;
  font-size: clamp(36px, 8vw, 52px);
  letter-spacing: -0.02em;
  color: #fff;
}

.linea-montos-hero {
  margin: 0;
  font-weight: 700;
  color: #fff;
}

.separador-hero {
  margin: 0 4px;
  color: rgba(255, 255, 255, 0.55);
  font-weight: 400;
}

.monto-limite-hero {
  color: rgba(255, 255, 255, 0.7);
  font-weight: 600;
}

.barra-progreso-envoltorio-hero {
  width: 100%;
  height: 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  overflow: hidden;
  margin-top: var(--espacio-2);
}

.barra-progreso-hero {
  height: 100%;
  border-radius: 999px;
  transition: width 0.2s ease;
}
.barra-progreso-hero.estado-normal {
  background: #fff;
}
.barra-progreso-hero.estado-cerca {
  background: var(--color-advertencia);
}
.barra-progreso-hero.estado-sobregiro {
  background: var(--color-error);
}

.nota-ritmo-hero {
  margin: 0;
  font-size: var(--tamano-pequeno);
  color: rgba(255, 255, 255, 0.55);
}

.nota-restante-hero {
  margin: 0;
  font-size: var(--tamano-pequeno);
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
}

/* Regla dura del brief: "excedido en S/Y" siempre en --color-error, sin excepción. */
.nota-excedido-hero {
  color: var(--color-error);
  font-weight: 700;
}
</style>
