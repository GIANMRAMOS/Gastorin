<script setup lang="ts">
import { ref } from 'vue'
import { useMetasAhorro } from '@/composables/useMetasAhorro'
import { useGastosStore } from '@/stores/gastos'
import type { MetaAhorro } from '@/types/metaAhorro'

/**
 * Formulario único de alta/edición de la meta de ahorro (Épica 13, HU-13.1),
 * mismo patrón que `FormularioCategoria`/`FormularioPresupuesto`. Al ser
 * `metas_ahorro` una fila ÚNICA por usuario (PK `usuario_id`), tanto el CTA
 * "Configura tu meta de ahorro" (sin meta) como tocar la tarjeta "Ahorro
 * comprometido" ya configurada (editar) abren este mismo formulario, que
 * SIEMPRE guarda con un upsert (`guardarMeta`), nunca un insert puro.
 */
const props = defineProps<{
  meta?: MetaAhorro | null
}>()

const emit = defineEmits<{
  guardado: []
  cerrar: []
}>()

const descripcion = ref(props.meta?.descripcion ?? '')
const monto = ref(props.meta ? String(props.meta.monto) : '')
const errorValidacion = ref<string | null>(null)

const storeGastos = useGastosStore()
const { guardarMeta } = useMetasAhorro()

/** Valida que la descripción no esté vacía y el monto sea mayor a 0 (mismo check que la tabla `metas_ahorro`). */
function validarFormulario(): boolean {
  if (!descripcion.value.trim()) {
    errorValidacion.value = 'Ingresa una descripción para tu meta.'
    return false
  }
  const montoNumerico = Number(monto.value)
  if (!monto.value.trim() || Number.isNaN(montoNumerico) || montoNumerico <= 0) {
    errorValidacion.value = 'Ingresa un monto mayor a 0.'
    return false
  }
  errorValidacion.value = null
  return true
}

/** Envía el formulario: siempre guarda (upsert) la meta única del usuario. */
async function manejarEnvio() {
  storeGastos.limpiarError()
  if (!validarFormulario()) {
    return
  }

  const exito = await guardarMeta({
    descripcion: descripcion.value.trim(),
    monto: Number(monto.value),
  })

  if (exito) {
    emit('guardado')
  }
}
</script>

<template>
  <form class="formulario-meta-ahorro" @submit.prevent="manejarEnvio">
    <div class="grupo-campo">
      <label for="descripcion-meta">Descripción</label>
      <input
        id="descripcion-meta"
        v-model="descripcion"
        type="text"
        class="entrada"
        placeholder="Ej. Viaje 2027"
      />
    </div>

    <div class="grupo-campo">
      <label for="monto-meta">Monto (S/)</label>
      <input
        id="monto-meta"
        v-model="monto"
        type="text"
        inputmode="decimal"
        class="entrada"
        placeholder="0.00"
      />
    </div>

    <p v-if="errorValidacion" role="alert" class="mensaje-error">{{ errorValidacion }}</p>
    <p v-else-if="storeGastos.error" role="alert" class="mensaje-error">{{ storeGastos.error }}</p>

    <button
      type="submit"
      :disabled="storeGastos.cargando"
      class="boton-primario"
      :class="{ cargando: storeGastos.cargando }"
    >
      Guardar
    </button>
    <button type="button" class="enlace-secundario" @click="emit('cerrar')">Cancelar</button>
  </form>
</template>
