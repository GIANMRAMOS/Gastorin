<script setup lang="ts">
import { computed } from 'vue'
import { useMoneda } from '@/composables/useMoneda'
import type { Moneda } from '@/types/gasto'

/**
 * Gráfico de barras verticales de la tendencia de los últimos meses
 * (HU-7.3), construido con CSS (`height %`), sin dependencia de librería de
 * gráficos (precedente: barra de `TarjetaPresupuesto`). El último elemento de
 * `datos` es el mes actual y se resalta en `--color-primario`; el resto se
 * muestra en un tono más claro.
 */
const props = defineProps<{
  datos: Array<{ mes: string; total: number }>
  moneda: Moneda
}>()

const { formatearMonto } = useMoneda()

/** Total máximo de la ventana, base del 100% de altura de las barras. */
const totalMaximo = computed(() => props.datos.reduce((max, dato) => Math.max(max, dato.total), 0))

/** Altura porcentual de una barra, proporcional al máximo de la ventana. */
function alturaBarra(total: number): string {
  if (totalMaximo.value <= 0) return '0%'
  return `${(total / totalMaximo.value) * 100}%`
}

/** Etiqueta abreviada del mes (ej. "jul.") a partir del prefijo `YYYY-MM`. */
function etiquetaMes(mes: string): string {
  const [anio, mesNumero] = mes.split('-').map(Number)
  const fecha = new Date(anio, mesNumero - 1, 1)
  return new Intl.DateTimeFormat('es-PE', { month: 'short' }).format(fecha).replace('.', '')
}
</script>

<template>
  <div class="grafico-tendencia">
    <div class="barras-tendencia">
      <div
        v-for="(dato, indice) in datos"
        :key="dato.mes"
        class="columna-tendencia"
        :class="{ 'columna-actual': indice === datos.length - 1 }"
      >
        <div class="barra-tendencia-envoltorio">
          <div
            class="barra-tendencia"
            :class="{ 'barra-actual': indice === datos.length - 1 }"
            :style="{ height: alturaBarra(dato.total) }"
            :title="formatearMonto(dato.total, moneda)"
          />
        </div>
        <span class="etiqueta-mes-tendencia">{{ etiquetaMes(dato.mes) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.grafico-tendencia {
  width: 100%;
}

.barras-tendencia {
  display: flex;
  align-items: flex-end;
  gap: var(--espacio-2);
  height: 160px;
}

.columna-tendencia {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--espacio-2);
  height: 100%;
}

.barra-tendencia-envoltorio {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.barra-tendencia {
  width: 70%;
  min-height: 2px;
  border-radius: 6px 6px 0 0;
  background: var(--color-borde);
  transition: height 0.2s ease;
}

.barra-tendencia.barra-actual {
  background: var(--color-primario);
}

.etiqueta-mes-tendencia {
  font-size: var(--tamano-pequeno);
  color: var(--color-texto-secundario);
  text-transform: capitalize;
}

.columna-actual .etiqueta-mes-tendencia {
  color: var(--color-texto);
  font-weight: 700;
}
</style>
