<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useMoneda } from '@/composables/useMoneda'
import type { Gasto } from '@/types/gasto'

/**
 * Card "Bandeja de correo" de la columna lateral del Dashboard "Caudal"
 * (Fase 1): reemplaza a la alerta inline `.alerta-bandeja` (que solo se
 * renderizaba con borradores pendientes). Decisión de diseño (GATE1 Fase 1):
 * esta card es SIEMPRE visible —con 0 borradores muestra un blurb de "todo
 * al día" en vez de desaparecer, para que la columna lateral no quede con un
 * hueco vacío. Presentacional puro: `cantidad`/`peek` ya vienen calculados
 * por `DashboardView` desde `storeGastos.borradores`.
 */
const props = defineProps<{
  cantidad: number
  /** Primer borrador de la bandeja (más reciente), o `null`/ausente si no hay ninguno. */
  peek?: Gasto | null
}>()

const router = useRouter()
const { formatearMonto } = useMoneda()

/** Monto formateado del peek, o `null` si el borrador aún no tiene monto/moneda completos (revisión manual). */
const montoPeekFormateado = computed(() => {
  if (!props.peek || props.peek.monto == null || props.peek.moneda == null) return null
  return formatearMonto(props.peek.monto, props.peek.moneda)
})

/** Navega a la Bandeja completa (HU-5.2). */
function revisarBandeja() {
  router.push({ name: 'bandeja' })
}
</script>

<template>
  <article class="tarjeta-bandeja-resumen" role="region" aria-label="Bandeja de correo">
    <p class="etiqueta-bandeja-resumen">Bandeja de correo</p>

    <p v-if="cantidad === 0" class="blurb-bandeja-resumen">Todo al día, sin gastos por confirmar.</p>

    <template v-else>
      <p class="conteo-bandeja-resumen">
        {{ cantidad }} {{ cantidad === 1 ? 'gasto' : 'gastos' }} por confirmar
      </p>
      <div v-if="peek" class="peek-bandeja-resumen">
        <p class="peek-descripcion-bandeja">{{ peek.descripcion || 'Gasto sin descripción' }}</p>
        <p v-if="montoPeekFormateado" class="peek-monto-bandeja">{{ montoPeekFormateado }}</p>
      </div>
    </template>

    <button type="button" class="boton-revisar-bandeja" @click="revisarBandeja">Revisar bandeja</button>
  </article>
</template>

<style scoped>
.tarjeta-bandeja-resumen {
  background: var(--color-fondo);
  border: 1px solid var(--color-borde-tarjeta);
  border-radius: var(--radio-tarjeta);
  padding: var(--espacio-4);
  display: flex;
  flex-direction: column;
  gap: var(--espacio-2);
}

.etiqueta-bandeja-resumen {
  margin: 0;
  font-size: var(--tamano-pequeno);
  font-weight: 600;
  color: var(--color-texto-secundario);
}

.blurb-bandeja-resumen {
  margin: 0;
  font-size: var(--tamano-pequeno);
  color: var(--color-texto-terciario);
}

.conteo-bandeja-resumen {
  margin: 0;
  font-weight: 700;
  color: var(--color-texto);
}

.peek-bandeja-resumen {
  background: var(--color-fondo-app);
  border-radius: 10px;
  padding: var(--espacio-2) var(--espacio-3);
}

.peek-descripcion-bandeja {
  margin: 0;
  font-size: var(--tamano-pequeno);
  color: var(--color-texto);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.peek-monto-bandeja {
  margin: 2px 0 0;
  font-family: var(--fuente-mono);
  font-size: var(--tamano-pequeno);
  color: var(--color-texto-secundario);
}

.boton-revisar-bandeja {
  align-self: flex-start;
  border: none;
  background: none;
  color: var(--color-primario);
  font-weight: 700;
  font-size: var(--tamano-pequeno);
  padding: 0;
  cursor: pointer;
  font-family: var(--fuente-base);
}
</style>
