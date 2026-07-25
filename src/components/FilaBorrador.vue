<script setup lang="ts">
import { computed } from 'vue'
import { useColorCategoria } from '@/composables/useColorCategoria'
import { useMoneda } from '@/composables/useMoneda'
import type { Gasto } from '@/types/gasto'

/**
 * Fila de la lista izquierda del maestro-detalle de la Bandeja (rediseño
 * "Caudal", Fase 3): avatar con las iniciales del comercio, comercio, banco +
 * hora de notificación, y monto a la derecha. Presentacional puro: no llama a
 * ningún composable de IO, solo emite `seleccionar` con el id del borrador
 * (el padre decide qué hacer, ver `BandejaView.vue`).
 */
const props = defineProps<{
  borrador: Gasto
  /** Nombre del banco ya resuelto (el borrador solo trae `banco_id`). */
  nombreBanco: string
  /** `true` si esta es la fila actualmente abierta en el panel de detalle. */
  seleccionado: boolean
  /** `true` si HU-14.2 detectó que este borrador podría ser un cargo duplicado. */
  esDuplicado: boolean
}>()

const emit = defineEmits<{
  seleccionar: [string]
}>()

const { colorCategoria } = useColorCategoria()
const { formatearMonto } = useMoneda()

/** Iniciales del comercio (hasta 2 letras) para el avatar de la fila. */
const iniciales = computed(() => {
  const nombre = props.borrador.descripcion?.trim()
  if (!nombre) return '?'
  const palabras = nombre.split(/\s+/)
  if (palabras.length >= 2) {
    return (palabras[0][0] + palabras[1][0]).toUpperCase()
  }
  return palabras[0].slice(0, 2).toUpperCase()
})

/** Hora de notificación (`creado_en`), en formato corto "es-PE" (ej. "14:32"). */
const horaFormateada = computed(() => {
  if (!props.borrador.creado_en) return ''
  const fecha = new Date(props.borrador.creado_en)
  if (Number.isNaN(fecha.getTime())) return ''
  return new Intl.DateTimeFormat('es-PE', { timeStyle: 'short' }).format(fecha)
})

/** "Banco · hora" (omite la hora si no se puede calcular). */
const metaFila = computed(() =>
  horaFormateada.value ? `${props.nombreBanco} · ${horaFormateada.value}` : props.nombreBanco,
)

/** Monto formateado, o `null` si el borrador está en revisión manual (aún sin monto/moneda). */
const montoFormateado = computed(() => {
  if (props.borrador.monto == null || props.borrador.moneda == null) return null
  return formatearMonto(props.borrador.monto, props.borrador.moneda)
})
</script>

<template>
  <li class="item-fila-borrador">
    <button
      type="button"
      class="fila-borrador"
      :class="{ 'fila-borrador--seleccionada': seleccionado }"
      @click="emit('seleccionar', borrador.id)"
    >
      <span
        class="avatar-comercio"
        :style="{ background: colorCategoria(borrador.descripcion) }"
        aria-hidden="true"
      >
        {{ iniciales }}
      </span>

      <span class="info-fila-borrador">
        <span class="comercio-fila-borrador">{{ borrador.descripcion || 'Gasto sin descripción' }}</span>
        <span class="meta-fila-borrador">{{ metaFila }}</span>
      </span>

      <span class="lado-derecho-fila">
        <span v-if="esDuplicado" class="badge-duplicado">Posible duplicado</span>
        <span v-if="montoFormateado" class="monto-fila-borrador">{{ montoFormateado }}</span>
        <span v-else class="monto-fila-borrador monto-fila-borrador--pendiente">Por definir</span>
      </span>
    </button>
  </li>
</template>

<style scoped>
.item-fila-borrador {
  list-style: none;
}

.fila-borrador {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--espacio-3);
  padding: var(--espacio-3);
  background: none;
  border: none;
  border-bottom: 1px solid var(--color-borde-tarjeta);
  cursor: pointer;
  font-family: var(--fuente-base);
  text-align: left;
}

.fila-borrador:hover {
  background: var(--color-fondo-app);
}

.fila-borrador--seleccionada {
  background: var(--color-fondo-app);
  box-shadow: inset 3px 0 0 var(--color-primario);
}

.avatar-comercio {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: var(--tamano-pequeno);
}

.info-fila-borrador {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.comercio-fila-borrador {
  font-weight: 600;
  color: var(--color-texto);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta-fila-borrador {
  font-size: var(--tamano-pequeno);
  color: var(--color-texto-secundario);
}

.lado-derecho-fila {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--espacio-1);
}

.monto-fila-borrador {
  font-weight: 700;
  color: var(--color-texto);
  white-space: nowrap;
}

.monto-fila-borrador--pendiente {
  font-weight: 600;
  font-size: var(--tamano-pequeno);
  color: var(--color-advertencia);
}

.badge-duplicado {
  background: var(--color-advertencia-fondo);
  color: var(--color-advertencia);
  font-size: 0.75rem;
  font-weight: 700;
  padding: 2px var(--espacio-2);
  border-radius: 999px;
  white-space: nowrap;
}
</style>
