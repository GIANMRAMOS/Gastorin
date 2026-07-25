<script setup lang="ts">
import { computed } from 'vue'
import { useMoneda } from '@/composables/useMoneda'
import type { Moneda } from '@/types/gasto'

/**
 * Resumen agregado del presupuesto del mes en la pantalla "Inicio" (Fase 0
 * "Caudal"): % consumido, montos gastado/límite y proyección de cierre de
 * mes. Distinto de `TarjetaPresupuesto.vue` (esa es por-categoría, con
 * edición/eliminación): aquí es un agregado de solo lectura de todo el mes.
 * Desde la Fase 1 "Caudal" también admite un top-3 de categorías (mini-barras
 * de solo lectura, sin acciones): con la lista vacía (default) no renderiza
 * nada nuevo, por lo que sigue siendo compatible con el uso anterior.
 * Presentacional puro: recibe `gastado`/`limite`/`proyeccion`/`topCategorias`
 * ya calculados por `DashboardView`.
 */
const props = withDefaults(
  defineProps<{
    gastado: number
    limite: number
    proyeccion: number
    moneda: Moneda
    topCategorias?: Array<{ nombre: string; total: number }>
  }>(),
  { topCategorias: () => [] },
)

const { formatearMonto } = useMoneda()

/** Mayor total entre las categorías del top, base del ancho relativo de cada mini-barra (evita división por cero). */
const mayorTotalTopCategorias = computed(() =>
  Math.max(1, ...props.topCategorias.map((categoria) => categoria.total)),
)

/** Ancho (%) de la mini-barra de una categoría del top, relativo a la de mayor total. */
function anchoBarraTopCategoria(total: number): number {
  return (total / mayorTotalTopCategorias.value) * 100
}

/** Umbral (en % del límite) a partir del cual el estado pasa a "cerca del límite" (mismo criterio que `TarjetaPresupuesto`). */
const UMBRAL_ADVERTENCIA = 85

/** Porcentaje real gastado del límite total (puede superar 100 en sobregiro); sin límite configurado, 0 (evita división por cero). */
const porcentaje = computed(() => {
  if (props.limite <= 0) return 0
  return (props.gastado / props.limite) * 100
})

/** Porcentaje redondeado para mostrar en el texto. */
const porcentajeTexto = computed(() => Math.round(porcentaje.value))

/** Porcentaje topado a 100 para el ancho visual de la barra (el real puede ser mayor). */
const porcentajeBarra = computed(() => Math.min(porcentaje.value, 100))

/** Estado de la barra según el porcentaje real gastado; sin límite configurado, siempre "normal". */
const estadoBarra = computed<'normal' | 'cerca' | 'sobregiro'>(() => {
  if (props.limite <= 0) return 'normal'
  if (porcentaje.value > 100) return 'sobregiro'
  if (porcentaje.value >= UMBRAL_ADVERTENCIA) return 'cerca'
  return 'normal'
})

const gastadoFormateado = computed(() => formatearMonto(props.gastado, props.moneda))
const limiteFormateado = computed(() => formatearMonto(props.limite, props.moneda))
const proyeccionFormateada = computed(() => formatearMonto(props.proyeccion, props.moneda))
</script>

<template>
  <article class="tarjeta-presupuesto-resumen">
    <div class="cabecera-presupuesto-resumen">
      <p class="etiqueta-presupuesto-resumen">Presupuesto del mes</p>
      <p class="porcentaje-presupuesto-resumen">{{ porcentajeTexto }}%</p>
    </div>

    <p class="linea-montos-presupuesto-resumen">
      <span class="monto-gastado-presupuesto-resumen">{{ gastadoFormateado }}</span>
      <span class="separador-presupuesto-resumen">/</span>
      <span class="monto-limite-presupuesto-resumen">{{ limiteFormateado }}</span>
    </p>

    <div class="barra-progreso-envoltorio">
      <div
        class="barra-progreso"
        :class="`estado-${estadoBarra}`"
        :style="{ width: `${porcentajeBarra}%` }"
      />
    </div>

    <p class="proyeccion-presupuesto-resumen">Proyecta {{ proyeccionFormateada }} al cierre de mes.</p>

    <div v-if="topCategorias.length > 0" class="top-categorias-presupuesto-resumen">
      <p class="titulo-top-categorias-presupuesto-resumen">Top categorías</p>
      <div
        v-for="categoria in topCategorias"
        :key="categoria.nombre"
        class="fila-top-categoria-presupuesto-resumen"
      >
        <span class="nombre-top-categoria-presupuesto-resumen">{{ categoria.nombre }}</span>
        <div class="barra-top-categoria-envoltorio">
          <div
            class="barra-top-categoria"
            :style="{ width: `${anchoBarraTopCategoria(categoria.total)}%` }"
          />
        </div>
        <span class="monto-top-categoria-presupuesto-resumen">{{ formatearMonto(categoria.total, moneda) }}</span>
      </div>
    </div>
  </article>
</template>

<style scoped>
.tarjeta-presupuesto-resumen {
  background: var(--color-fondo);
  border: 1px solid var(--color-borde-tarjeta);
  border-radius: var(--radio-tarjeta);
  padding: var(--espacio-4);
  display: flex;
  flex-direction: column;
  gap: var(--espacio-2);
}

.cabecera-presupuesto-resumen {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.etiqueta-presupuesto-resumen {
  margin: 0;
  font-size: var(--tamano-pequeno);
  font-weight: 600;
  color: var(--color-texto-secundario);
}

.porcentaje-presupuesto-resumen {
  margin: 0;
  font-weight: 700;
  color: var(--color-texto);
}

.linea-montos-presupuesto-resumen {
  margin: 0;
  font-weight: 700;
  color: var(--color-texto);
}

.separador-presupuesto-resumen {
  margin: 0 4px;
  color: var(--color-texto-terciario);
  font-weight: 400;
}

.monto-limite-presupuesto-resumen {
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

.proyeccion-presupuesto-resumen {
  margin: 0;
  font-size: var(--tamano-pequeno);
  color: var(--color-texto-secundario);
}

.top-categorias-presupuesto-resumen {
  margin-top: var(--espacio-2);
  padding-top: var(--espacio-2);
  border-top: 1px solid var(--color-borde-tarjeta);
  display: flex;
  flex-direction: column;
  gap: var(--espacio-2);
}

.titulo-top-categorias-presupuesto-resumen {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-texto-terciario);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.fila-top-categoria-presupuesto-resumen {
  display: grid;
  grid-template-columns: 72px 1fr auto;
  align-items: center;
  gap: var(--espacio-2);
}

.nombre-top-categoria-presupuesto-resumen {
  font-size: var(--tamano-pequeno);
  color: var(--color-texto-secundario);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.barra-top-categoria-envoltorio {
  height: 6px;
  border-radius: 999px;
  background: var(--color-fondo-app);
  overflow: hidden;
}

.barra-top-categoria {
  height: 100%;
  border-radius: 999px;
  background: var(--color-primario);
}

.monto-top-categoria-presupuesto-resumen {
  font-family: var(--fuente-mono);
  font-size: 0.75rem;
  color: var(--color-texto-secundario);
  white-space: nowrap;
}
</style>
