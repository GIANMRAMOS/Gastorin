<script setup lang="ts">
import type { Moneda } from '@/types/gasto'

/**
 * Toggle segmentado visual para elegir moneda (PEN/USD).
 * Componente presentacional puro: escribe vía `v-model` sobre el `ref` de
 * moneda que su padre gobierna (por ejemplo, el `<select>` oculto de
 * `FormularioGasto.vue`, que sigue siendo la fuente de verdad de a11y y tests).
 */
const props = defineProps<{
  modelValue: Moneda | ''
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [Moneda]
}>()

/** Emite la nueva moneda elegida, salvo que el toggle esté deshabilitado. */
function elegir(valor: Moneda) {
  if (props.disabled) return
  emit('update:modelValue', valor)
}
</script>

<template>
  <div class="toggle-moneda" role="group" aria-label="Moneda">
    <button
      type="button"
      class="opcion-toggle"
      :class="{ activo: modelValue === 'PEN' }"
      :disabled="disabled"
      @click="elegir('PEN')"
    >
      PEN
    </button>
    <button
      type="button"
      class="opcion-toggle"
      :class="{ activo: modelValue === 'USD' }"
      :disabled="disabled"
      @click="elegir('USD')"
    >
      USD
    </button>
  </div>
</template>

<style scoped>
.toggle-moneda {
  display: inline-flex;
  background: var(--color-fondo-app);
  border-radius: var(--radio-borde);
  padding: 4px;
  gap: 4px;
}

.opcion-toggle {
  border: none;
  background: transparent;
  padding: var(--espacio-2) var(--espacio-4);
  border-radius: 10px;
  font-weight: 600;
  font-size: var(--tamano-pequeno);
  color: var(--color-texto-secundario);
  cursor: pointer;
  font-family: var(--fuente-base);
}
.opcion-toggle.activo {
  background: var(--color-fondo);
  color: var(--color-texto);
  box-shadow: 0 1px 4px rgba(21, 26, 24, 0.12);
}
.opcion-toggle:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
