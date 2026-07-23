<script setup lang="ts">
import { computed } from 'vue'
import { useMoneda } from '@/composables/useMoneda'
import type { Moneda } from '@/types/gasto'

/**
 * Gráfico de líneas de la tendencia de los últimos días (Cambio 2), dibujado
 * con SVG (`polyline` + puntos), sin dependencia de librería de gráficos
 * (mismo precedente sin-librería que `GraficoTendenciaMensual`, que en cambio
 * es de barras). No se reutiliza ese componente porque keyea por `dato.mes`
 * y formatea etiquetas asumiendo prefijo `YYYY-MM`: no encaja con puntos
 * diarios `YYYY-MM-DD`. El último punto (hoy) se resalta.
 */
const props = defineProps<{
  datos: Array<{ dia: string; total: number }>
  moneda: Moneda
}>()

const { formatearMonto } = useMoneda()

/** Ancho y alto lógicos del viewBox del SVG (unidades arbitrarias, escalan por CSS). */
const ANCHO_VIEWBOX = 300
const ALTO_VIEWBOX = 100

/** Total máximo de la ventana, base del 100% de altura de la línea. */
const totalMaximo = computed(() => props.datos.reduce((max, dato) => Math.max(max, dato.total), 0))

/** Coordenada X de cada punto, repartida uniformemente en el ancho del viewBox. */
function coordenadaX(indice: number): number {
  if (props.datos.length <= 1) return ANCHO_VIEWBOX / 2
  return (indice / (props.datos.length - 1)) * ANCHO_VIEWBOX
}

/** Coordenada Y de cada punto (invertida: mayor total = más arriba = Y menor). */
function coordenadaY(total: number): number {
  if (totalMaximo.value <= 0) return ALTO_VIEWBOX
  return ALTO_VIEWBOX - (total / totalMaximo.value) * ALTO_VIEWBOX
}

/** Puntos del `polyline` en formato `"x,y x,y ..."`. */
const puntosLinea = computed(() =>
  props.datos.map((dato, indice) => `${coordenadaX(indice)},${coordenadaY(dato.total)}`).join(' '),
)

/** Etiquetas del eje: solo primer y último día, para no saturar con 30 textos. */
const etiquetaPrimerDia = computed(() => etiquetaDia(props.datos[0]?.dia))
const etiquetaUltimoDia = computed(() => etiquetaDia(props.datos.at(-1)?.dia))

/** Etiqueta corta `dd/mm` de un día `YYYY-MM-DD`. */
function etiquetaDia(dia: string | undefined): string {
  if (!dia) return ''
  const [, mes, diaNumero] = dia.split('-')
  return `${diaNumero}/${mes}`
}
</script>

<template>
  <div class="grafico-tendencia-diaria">
    <svg
      class="lienzo-tendencia-diaria"
      :viewBox="`0 0 ${ANCHO_VIEWBOX} ${ALTO_VIEWBOX}`"
      preserveAspectRatio="none"
    >
      <polyline class="linea-tendencia-diaria" :points="puntosLinea" />
      <circle
        v-for="(dato, indice) in datos"
        :key="dato.dia"
        class="punto-tendencia-diaria"
        :class="{ 'punto-actual': indice === datos.length - 1 }"
        :cx="coordenadaX(indice)"
        :cy="coordenadaY(dato.total)"
        :r="indice === datos.length - 1 ? 3 : 1.5"
      >
        <title>{{ formatearMonto(dato.total, moneda) }} · {{ dato.dia }}</title>
      </circle>
    </svg>
    <div class="etiquetas-tendencia-diaria">
      <span>{{ etiquetaPrimerDia }}</span>
      <span>{{ etiquetaUltimoDia }}</span>
    </div>
  </div>
</template>

<style scoped>
.grafico-tendencia-diaria {
  width: 100%;
}

.lienzo-tendencia-diaria {
  width: 100%;
  height: 160px;
  overflow: visible;
}

.linea-tendencia-diaria {
  fill: none;
  stroke: var(--color-primario);
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
}

.punto-tendencia-diaria {
  fill: var(--color-primario);
  opacity: 0.5;
}

.punto-tendencia-diaria.punto-actual {
  opacity: 1;
}

.etiquetas-tendencia-diaria {
  display: flex;
  justify-content: space-between;
  margin-top: var(--espacio-2);
  font-size: var(--tamano-pequeno);
  color: var(--color-texto-secundario);
}
</style>
