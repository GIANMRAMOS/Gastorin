<script setup lang="ts">
import { computed } from 'vue'
import { useColorCategoria } from '@/composables/useColorCategoria'
import { useMoneda } from '@/composables/useMoneda'
import type { Moneda } from '@/types/gasto'
import type { DesgloseSemanal } from '@/composables/usePresupuestos'

/**
 * Fila-disclosure de una categoría en el desglose semanal (Épica 16):
 * cabecera operable (click, Enter o Espacio) que expande un panel con el
 * gasto de las 4 semanas del mes. Decisión de diseño del micro-plan: NO se
 * fuerza dentro de un `<table>` semántico (una fila-disclosure con
 * `aria-expanded` no mapea limpio a `<tr>`); la cabecera es un
 * `role="button"` propio, y el botón "Editar" (que conserva `ModalPresupuesto`/
 * `DialogoConfirmacion` para el CRUD por categoría) va aparte para no anidar
 * un `<button>` real dentro de otro. Reutiliza el enfoque visual de colapso
 * etiqueta/valor de `TablaMovimientos` para <640px (no su marcado `<table>`).
 * Presentacional puro: recibe `desglose`/`movimientos`/`restante` ya
 * calculados por `PresupuestosView`; el estado de expansión lo gobierna el
 * padre (`expandida`), para que solo una fila esté abierta a la vez.
 */
const props = defineProps<{
  categoriaId: string
  nombreCategoria: string
  gastado: number
  limite: number
  moneda: Moneda
  desglose: DesgloseSemanal[]
  movimientos: number
  /** `limite - gastado`: positivo si todavía queda margen, negativo si ya se excedió. */
  restante: number
  expandida: boolean
}>()

const emit = defineEmits<{
  alternar: [string]
  editar: [string]
}>()

const { colorCategoria } = useColorCategoria()
const { formatearMonto } = useMoneda()

/** Umbral (en % del límite) a partir del cual el estado pasa a "cerca del límite" (mismo criterio que `TarjetaPresupuesto`). */
const UMBRAL_ADVERTENCIA = 85

const idPanel = computed(() => `panel-desglose-${props.categoriaId}`)

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

const gastadoFormateado = computed(() => formatearMonto(props.gastado, props.moneda))
const limiteFormateado = computed(() => formatearMonto(props.limite, props.moneda))
const restanteFormateado = computed(() => formatearMonto(Math.abs(props.restante), props.moneda))
const excedido = computed(() => props.restante < 0)

/** Alterna la expansión de esta fila. */
function alternar() {
  emit('alternar', props.categoriaId)
}

/** Operable con teclado (Enter/Espacio) además de click, ver criterio de a11y del micro-plan. */
function manejarTeclado(evento: KeyboardEvent) {
  if (evento.key === 'Enter' || evento.key === ' ' || evento.key === 'Spacebar') {
    evento.preventDefault()
    alternar()
  }
}
</script>

<template>
  <div class="fila-categoria-presupuesto">
    <div
      class="cabecera-fila-categoria"
      role="button"
      tabindex="0"
      :aria-expanded="expandida"
      :aria-controls="idPanel"
      @click="alternar"
      @keydown="manejarTeclado"
    >
      <span class="celda-fila celda-nombre-fila" data-etiqueta="Categoría">
        <span class="punto-categoria-fila" :style="{ background: colorCategoria(nombreCategoria) }" />
        {{ nombreCategoria }}
      </span>
      <span class="celda-fila celda-montos-fila" data-etiqueta="Gastado / límite">
        {{ gastadoFormateado }} / {{ limiteFormateado }}
      </span>
      <span class="celda-fila celda-porcentaje-fila" data-etiqueta="%">{{ porcentajeTexto }}%</span>
      <button
        type="button"
        class="boton-editar-fila-categoria"
        @click.stop="emit('editar', categoriaId)"
        @keydown.stop
      >
        Editar
      </button>
      <span class="icono-expandir-fila" aria-hidden="true">{{ expandida ? '−' : '+' }}</span>
    </div>

    <div class="barra-progreso-envoltorio-fila">
      <div
        class="barra-progreso-fila"
        :class="`estado-${estadoBarra}`"
        :style="{ width: `${porcentajeBarra}%` }"
      />
    </div>

    <div v-if="expandida" :id="idPanel" class="panel-desglose-categoria" role="region">
      <div class="grid-desglose-semanal">
        <div v-for="item in desglose" :key="item.semana" class="celda-semana-desglose">
          <p class="etiqueta-semana-desglose">Semana {{ item.semana }}</p>
          <p class="monto-semana-desglose">{{ formatearMonto(item.total, moneda) }}</p>
        </div>
      </div>
      <p class="nota-desglose-categoria" :class="{ 'nota-excedido-desglose': excedido }">
        {{ movimientos }} movimientos ·
        {{ excedido ? `excedido en ${restanteFormateado}` : `te quedan ${restanteFormateado}` }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.fila-categoria-presupuesto {
  border-bottom: 1px solid var(--color-borde-tarjeta);
  padding: var(--espacio-3) 0;
}
.fila-categoria-presupuesto:last-child {
  border-bottom: none;
}

.cabecera-fila-categoria {
  display: flex;
  align-items: center;
  gap: var(--espacio-3);
  cursor: pointer;
  color: var(--color-texto);
}
.cabecera-fila-categoria:focus-visible {
  outline: 2px solid var(--color-borde-foco);
  outline-offset: 2px;
  border-radius: var(--radio-borde);
}

.celda-nombre-fila {
  display: inline-flex;
  align-items: center;
  gap: var(--espacio-2);
  font-weight: 600;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.punto-categoria-fila {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.celda-montos-fila {
  font-weight: 700;
  white-space: nowrap;
}

.celda-porcentaje-fila {
  font-weight: 700;
  color: var(--color-texto);
  width: 44px;
  text-align: right;
}

.boton-editar-fila-categoria {
  background: none;
  border: none;
  cursor: pointer;
  font-family: var(--fuente-base);
  font-size: var(--tamano-pequeno);
  font-weight: 600;
  color: var(--color-texto-secundario);
  padding: var(--espacio-1) var(--espacio-2);
}
.boton-editar-fila-categoria:hover {
  color: var(--color-texto);
}

.icono-expandir-fila {
  font-size: 1.1rem;
  color: var(--color-texto-secundario);
  width: 16px;
  text-align: center;
}

.barra-progreso-envoltorio-fila {
  width: 100%;
  height: 6px;
  border-radius: 999px;
  background: var(--color-fondo-app);
  overflow: hidden;
  margin-top: var(--espacio-2);
}

.barra-progreso-fila {
  height: 100%;
  border-radius: 999px;
}
.barra-progreso-fila.estado-normal {
  background: var(--color-primario);
}
.barra-progreso-fila.estado-cerca {
  background: var(--color-advertencia);
}
.barra-progreso-fila.estado-sobregiro {
  background: var(--color-error);
}

.panel-desglose-categoria {
  margin-top: var(--espacio-3);
  padding-top: var(--espacio-3);
  border-top: 1px dashed var(--color-borde-tarjeta);
}

.grid-desglose-semanal {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--espacio-2);
}

.celda-semana-desglose {
  background: var(--color-fondo-app);
  border-radius: var(--radio-borde);
  padding: var(--espacio-2);
  text-align: center;
}

.etiqueta-semana-desglose {
  margin: 0;
  font-size: 0.7rem;
  color: var(--color-texto-terciario);
}

.monto-semana-desglose {
  margin: 2px 0 0;
  font-family: var(--fuente-mono);
  font-weight: 700;
  font-size: var(--tamano-pequeno);
  color: var(--color-texto);
}

.nota-desglose-categoria {
  margin: var(--espacio-3) 0 0;
  font-size: var(--tamano-pequeno);
  color: var(--color-texto-secundario);
}

.nota-excedido-desglose {
  color: var(--color-error);
  font-weight: 600;
}

/* Responsive (~375px): la cabecera colapsa a etiqueta/valor apilados (mismo
   patrón de `TablaMovimientos`), y el desglose semanal pasa a grid 2×2 en
   vez de 4 columnas comprimidas o scroll horizontal. */
@media (max-width: 640px) {
  .cabecera-fila-categoria {
    flex-wrap: wrap;
    row-gap: var(--espacio-1);
  }

  .celda-fila {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
  }

  .celda-nombre-fila {
    order: 1;
  }
  .celda-montos-fila {
    order: 2;
  }
  .celda-montos-fila::before {
    content: attr(data-etiqueta);
    font-weight: 600;
    color: var(--color-texto-secundario);
  }
  .celda-porcentaje-fila {
    order: 3;
    width: auto;
  }
  .celda-porcentaje-fila::before {
    content: attr(data-etiqueta);
    font-weight: 600;
    color: var(--color-texto-secundario);
  }
  .boton-editar-fila-categoria {
    order: 4;
  }
  .icono-expandir-fila {
    order: 5;
  }

  .grid-desglose-semanal {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
