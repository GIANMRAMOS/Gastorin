<script setup lang="ts">
import { computed, ref } from 'vue'
import { useCategorias } from '@/composables/useCategorias'
import { useGastosStore } from '@/stores/gastos'
import type { Categoria } from '@/types/gasto'

/**
 * Formulario único compartido por alta y edición de categorías. Si
 * `categoria` viene definida, arranca en modo edición prellenado; si no,
 * arranca en modo alta. Solo pide el nombre: el color se deriva de él
 * (ver `useColorCategoria`), no se persiste.
 * En edición de una categoría predefinida, el nombre es de solo lectura y
 * solo se ofrece la acción de desactivar (HU-4.4).
 */
const props = defineProps<{
  categoria?: Categoria | null
}>()

const emit = defineEmits<{
  guardado: []
  cerrar: []
  'pedir-desactivar': []
}>()

const esEdicion = computed(() => props.categoria != null)
const esPredefinida = computed(() => props.categoria?.predefinida === true)

const nombre = ref(props.categoria?.nombre ?? '')
const errorValidacion = ref<string | null>(null)

const storeGastos = useGastosStore()
const { crearCategoria, editarCategoria } = useCategorias()

/** Valida que el nombre no esté vacío ni sea solo espacios. */
function validarFormulario(): boolean {
  if (!nombre.value.trim()) {
    errorValidacion.value = 'Ingresa un nombre para la categoría.'
    return false
  }
  errorValidacion.value = null
  return true
}

/** Envía el formulario: crea o edita la categoría según el modo actual. */
async function manejarEnvio() {
  // Una categoría predefinida no admite edición de su nombre (HU-4.4):
  // solo puede desactivarse, acción que pasa por 'pedir-desactivar', no por aquí.
  if (esPredefinida.value) {
    return
  }

  storeGastos.limpiarError()
  if (!validarFormulario()) {
    return
  }

  const nombreLimpio = nombre.value.trim()
  let exito = false
  if (esEdicion.value && props.categoria) {
    exito = await editarCategoria(props.categoria.id, nombreLimpio)
  } else {
    exito = await crearCategoria(nombreLimpio)
  }

  if (exito) {
    emit('guardado')
  }
}
</script>

<template>
  <form class="formulario-categoria" @submit.prevent="manejarEnvio">
    <div class="grupo-campo">
      <label for="nombre">Nombre</label>
      <input
        id="nombre"
        v-model="nombre"
        type="text"
        class="entrada"
        :disabled="esPredefinida"
        placeholder="Ej. Mascotas"
      />
    </div>

    <p v-if="errorValidacion" role="alert" class="mensaje-error">{{ errorValidacion }}</p>
    <p v-else-if="storeGastos.error" role="alert" class="mensaje-error">{{ storeGastos.error }}</p>

    <button
      v-if="!esPredefinida"
      type="submit"
      :disabled="storeGastos.cargando"
      class="boton-primario"
      :class="{ cargando: storeGastos.cargando }"
    >
      Guardar
    </button>
    <button
      v-if="esEdicion"
      type="button"
      class="boton-desactivar"
      @click="emit('pedir-desactivar')"
    >
      Desactivar categoría
    </button>
    <button type="button" class="enlace-secundario" @click="emit('cerrar')">Cancelar</button>
  </form>
</template>

<style scoped>
.boton-desactivar {
  width: 100%;
  min-height: 44px;
  margin-top: var(--espacio-2);
  padding: 0 var(--espacio-4);
  background: none;
  border: 1px solid var(--color-error);
  border-radius: var(--radio-borde);
  color: var(--color-error);
  font-weight: 600;
  font-size: var(--tamano-base);
  cursor: pointer;
  font-family: var(--fuente-base);
}
.boton-desactivar:hover {
  background: var(--color-error-fondo);
}
</style>
