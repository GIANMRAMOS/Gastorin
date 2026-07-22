<script setup lang="ts">
import { computed } from 'vue'
import { useColorCategoria } from '@/composables/useColorCategoria'
import { useMoneda } from '@/composables/useMoneda'
import { useGastosStore } from '@/stores/gastos'
import type { Presupuesto } from '@/types/gasto'

/**
 * Tarjeta de un presupuesto mensual (HU-6.2): chip de categoría con punto de
 * color, chip de moneda, línea "gastado / límite", porcentaje y barra de
 * progreso con 3 estados (normal / cerca del límite / sobregiro), más un
 * banner de alerta cuando el gasto supera el límite. Criterio de a11y: el
 * texto del porcentaje SIEMPRE usa `--color-texto`, nunca el color variable
 * de la barra (ver estilos scoped).
 */
const props = defineProps<{
  presupuesto: Presupuesto
  gastado: number
}>()

const emit = defineEmits<{
  editar: []
  eliminar: []
}>()

const storeGastos = useGastosStore()
const { colorCategoria } = useColorCategoria()
const { formatearMonto } = useMoneda()

/** Umbral (en % del límite) a partir del cual el estado pasa a "cerca del límite". */
const UMBRAL_ADVERTENCIA = 85

/** Nombre de la categoría del presupuesto, resuelto desde `storeGastos.categorias`. */
const nombreCategoria = computed(() => {
  const categoria = storeGastos.categorias.find((c) => c.id === props.presupuesto.categoria_id)
  return categoria?.nombre ?? 'Categoría'
})

/** Porcentaje real gastado del límite (puede superar 100 en sobregiro). */
const porcentaje = computed(() => {
  if (props.presupuesto.monto_limite <= 0) return 0
  return (props.gastado / props.presupuesto.monto_limite) * 100
})

/** Porcentaje redondeado para mostrar en el texto. */
const porcentajeTexto = computed(() => Math.round(porcentaje.value))

/** Porcentaje topado a 100 para el ancho visual de la barra (el real puede ser mayor). */
const porcentajeBarra = computed(() => Math.min(porcentaje.value, 100))

/** Estado de la barra según el porcentaje real gastado. */
const estadoBarra = computed<'normal' | 'cerca' | 'sobregiro'>(() => {
  if (porcentaje.value > 100) return 'sobregiro'
  if (porcentaje.value >= UMBRAL_ADVERTENCIA) return 'cerca'
  return 'normal'
})

/** Monto excedido (solo tiene sentido en sobregiro). */
const montoExcedido = computed(() => props.gastado - props.presupuesto.monto_limite)

/** Textos formateados para mostrar en la tarjeta. */
const gastadoFormateado = computed(() => formatearMonto(props.gastado, props.presupuesto.moneda))
const limiteFormateado = computed(() =>
  formatearMonto(props.presupuesto.monto_limite, props.presupuesto.moneda),
)
const excedidoFormateado = computed(() => formatearMonto(montoExcedido.value, props.presupuesto.moneda))
</script>

<template>
  <li class="tarjeta-presupuesto">
    <div class="cabecera-tarjeta">
      <button type="button" class="chip-categoria" @click="emit('editar')">
        <span class="punto-categoria" :style="{ background: colorCategoria(nombreCategoria) }" />
        {{ nombreCategoria }}
      </button>
      <span class="chip-moneda">{{ presupuesto.moneda }}</span>
      <button
        type="button"
        class="boton-eliminar-tarjeta"
        aria-label="Eliminar presupuesto"
        @click="emit('eliminar')"
      >
        &times;
      </button>
    </div>

    <p class="linea-montos">
      <span class="monto-gastado">{{ gastadoFormateado }}</span>
      <span class="monto-separador">/</span>
      <span class="monto-limite">{{ limiteFormateado }}</span>
    </p>

    <div class="barra-progreso-envoltorio">
      <div class="barra-progreso" :class="`estado-${estadoBarra}`" :style="{ width: `${porcentajeBarra}%` }" />
    </div>
    <p class="texto-porcentaje">{{ porcentajeTexto }}%</p>

    <p v-if="estadoBarra === 'sobregiro'" role="alert" class="banner-sobregiro">
      Sobregiro: te pasaste por {{ excedidoFormateado }}.
    </p>
  </li>
</template>

<style scoped>
.tarjeta-presupuesto {
  list-style: none;
  background: var(--color-fondo);
  border: 1px solid var(--color-borde-tarjeta);
  border-radius: var(--radio-tarjeta);
  padding: var(--espacio-4);
  display: flex;
  flex-direction: column;
  gap: var(--espacio-2);
}

.cabecera-tarjeta {
  display: flex;
  align-items: center;
  gap: var(--espacio-2);
}

.chip-categoria {
  display: inline-flex;
  align-items: center;
  gap: var(--espacio-2);
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

.punto-categoria {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.chip-moneda {
  padding: 2px var(--espacio-2);
  border-radius: 999px;
  background: var(--color-fondo-app);
  color: var(--color-texto-secundario);
  font-size: var(--tamano-pequeno);
  font-weight: 700;
}

.boton-eliminar-tarjeta {
  margin-left: auto;
  background: none;
  border: none;
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
  color: var(--color-texto-terciario);
}
.boton-eliminar-tarjeta:hover {
  color: var(--color-error);
}

.linea-montos {
  margin: 0;
  font-weight: 700;
  color: var(--color-texto);
}

.monto-separador {
  margin: 0 4px;
  color: var(--color-texto-terciario);
  font-weight: 400;
}

.monto-limite {
  color: var(--color-texto-secundario);
  font-weight: 600;
}

.barra-progreso-envoltorio {
  width: 100%;
  height: 8px;
  border-radius: 999px;
  background: var(--color-fondo-app);
  overflow: hidden;
}

.barra-progreso {
  height: 100%;
  border-radius: 999px;
  transition: width 0.2s ease;
}
.barra-progreso.estado-normal {
  background: var(--color-primario);
}
.barra-progreso.estado-cerca {
  background: var(--color-advertencia);
}
.barra-progreso.estado-sobregiro {
  background: var(--color-error);
}

/* Criterio de a11y (HU-6.2): el texto del porcentaje siempre usa el color de
   texto estándar, nunca el color variable de la barra (normal/cerca/sobregiro). */
.texto-porcentaje {
  margin: 0;
  font-size: var(--tamano-pequeno);
  font-weight: 700;
  color: var(--color-texto);
}

.banner-sobregiro {
  margin: 0;
  border-radius: var(--radio-borde);
  padding: var(--espacio-3);
  font-size: var(--tamano-pequeno);
  background: var(--color-error-fondo);
  color: var(--color-error);
  border: 1px solid var(--color-error);
}
.banner-sobregiro::before {
  content: '⚠ ';
}
</style>
