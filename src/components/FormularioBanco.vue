<script setup lang="ts">
import { ref } from 'vue'
import { useBancos } from '@/composables/useBancos'
import { useIngresosStore } from '@/stores/ingresos'

/**
 * Formulario de alta de banco (Épica 11, HU-11.1). Solo pide el nombre; no
 * hay modo edición/desactivar (fuera de alcance de las HU actuales).
 */
const emit = defineEmits<{
  guardado: []
  cerrar: []
}>()

const nombre = ref('')
const errorValidacion = ref<string | null>(null)

const storeIngresos = useIngresosStore()
const { crearBanco } = useBancos()

/** Valida que el nombre no esté vacío ni sea solo espacios. */
function validarFormulario(): boolean {
  if (!nombre.value.trim()) {
    errorValidacion.value = 'Ingresa un nombre para el banco.'
    return false
  }
  errorValidacion.value = null
  return true
}

/** Envía el formulario: crea el banco. */
async function manejarEnvio() {
  storeIngresos.limpiarError()
  if (!validarFormulario()) {
    return
  }

  const exito = await crearBanco(nombre.value.trim())
  if (exito) {
    emit('guardado')
  }
}
</script>

<template>
  <form class="formulario-banco" @submit.prevent="manejarEnvio">
    <div class="grupo-campo">
      <label for="nombre-banco">Nombre</label>
      <input
        id="nombre-banco"
        v-model="nombre"
        type="text"
        class="entrada"
        placeholder="Ej. BCP"
      />
    </div>

    <p v-if="errorValidacion" role="alert" class="mensaje-error">{{ errorValidacion }}</p>
    <p v-else-if="storeIngresos.error" role="alert" class="mensaje-error">{{ storeIngresos.error }}</p>

    <button
      type="submit"
      :disabled="storeIngresos.cargando"
      class="boton-primario"
      :class="{ cargando: storeIngresos.cargando }"
    >
      Guardar
    </button>
    <button type="button" class="enlace-secundario" @click="emit('cerrar')">Cancelar</button>
  </form>
</template>
