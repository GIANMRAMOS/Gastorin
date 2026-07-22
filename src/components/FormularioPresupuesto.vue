<script setup lang="ts">
import { computed, ref } from 'vue'
import ToggleMoneda from '@/components/ToggleMoneda.vue'
import { usePresupuestos } from '@/composables/usePresupuestos'
import { useColorCategoria } from '@/composables/useColorCategoria'
import { useGastosStore } from '@/stores/gastos'
import type { Moneda, Presupuesto, PresupuestoInput } from '@/types/gasto'

/**
 * Formulario único compartido por alta y edición de presupuestos (espejo de
 * `FormularioCategoria`/`FormularioGasto`). En edición, categoría/moneda/mes
 * son la clave `unique` de la tabla: quedan de solo lectura y solo se puede
 * cambiar el monto límite (HU-6.3).
 */
const props = defineProps<{
  presupuesto?: Presupuesto | null
}>()

const emit = defineEmits<{
  guardado: []
  cerrar: []
  'pedir-eliminar': []
}>()

const esEdicion = computed(() => props.presupuesto != null)

const categoriaId = ref(props.presupuesto?.categoria_id ?? '')
const moneda = ref<Moneda | ''>(props.presupuesto?.moneda ?? '')
const montoLimite = ref(props.presupuesto ? String(props.presupuesto.monto_limite) : '')

const errorValidacion = ref<string | null>(null)

const storeGastos = useGastosStore()
const { crearPresupuesto, editarPresupuesto } = usePresupuestos()
const { colorCategoria } = useColorCategoria()

/** Categorías seleccionables para dar de alta un presupuesto: solo activas. */
const categoriasActivas = computed(() => storeGastos.categorias.filter((c) => c.activa))

/** Selecciona una categoría desde los chips (solo en alta: en edición es de solo lectura). */
function elegirCategoria(id: string) {
  if (esEdicion.value) return
  categoriaId.value = id
}

/** Valida los campos editables según el modo (categoría/moneda solo en alta; monto siempre). */
function validarFormulario(): boolean {
  if (!esEdicion.value) {
    if (!categoriaId.value) {
      errorValidacion.value = 'Selecciona una categoría.'
      return false
    }
    if (!moneda.value) {
      errorValidacion.value = 'Selecciona una moneda.'
      return false
    }
  }
  const montoNumerico = Number(montoLimite.value)
  if (!montoLimite.value.trim() || Number.isNaN(montoNumerico) || montoNumerico <= 0) {
    errorValidacion.value = 'Ingresa un monto límite mayor a 0.'
    return false
  }
  errorValidacion.value = null
  return true
}

/** Envía el formulario: crea el presupuesto o edita solo el monto límite, según el modo. */
async function manejarEnvio() {
  storeGastos.limpiarError()
  if (!validarFormulario()) {
    return
  }

  const montoNumerico = Number(montoLimite.value)
  let exito = false
  if (esEdicion.value && props.presupuesto) {
    exito = await editarPresupuesto(props.presupuesto.id, montoNumerico)
  } else {
    const input: PresupuestoInput = {
      categoria_id: categoriaId.value,
      moneda: moneda.value as Moneda,
      monto_limite: montoNumerico,
    }
    exito = await crearPresupuesto(input)
  }

  if (exito) {
    emit('guardado')
  }
}
</script>

<template>
  <form class="formulario-presupuesto" @submit.prevent="manejarEnvio">
    <div class="grupo-campo">
      <label>Categoría</label>
      <div v-if="!esEdicion" class="chips-categoria">
        <button
          v-for="categoria in categoriasActivas"
          :key="categoria.id"
          type="button"
          class="chip-categoria"
          :class="{ activo: categoriaId === categoria.id }"
          @click="elegirCategoria(categoria.id)"
        >
          <span class="punto-categoria" :style="{ background: colorCategoria(categoria.nombre) }" />
          {{ categoria.nombre }}
        </button>
      </div>
      <p v-else class="valor-solo-lectura">
        <span
          class="punto-categoria"
          :style="{
            background: colorCategoria(
              storeGastos.categorias.find((c) => c.id === categoriaId)?.nombre,
            ),
          }"
        />
        {{ storeGastos.categorias.find((c) => c.id === categoriaId)?.nombre ?? 'Categoría' }}
      </p>
      <select id="categoria" v-model="categoriaId" class="sr-only" :disabled="esEdicion">
        <option value="" disabled>Selecciona una categoría</option>
        <option v-for="categoria in categoriasActivas" :key="categoria.id" :value="categoria.id">
          {{ categoria.nombre }}
        </option>
      </select>
    </div>

    <div class="grupo-campo">
      <label>Moneda</label>
      <ToggleMoneda v-model="moneda" :disabled="esEdicion" />
      <select id="moneda" v-model="moneda" class="sr-only" :disabled="esEdicion">
        <option value="" disabled>Selecciona una moneda</option>
        <option value="PEN">PEN</option>
        <option value="USD">USD</option>
      </select>
    </div>

    <div class="grupo-campo">
      <label for="monto-limite">Monto límite</label>
      <input
        id="monto-limite"
        v-model="montoLimite"
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
    <button
      v-if="esEdicion"
      type="button"
      class="boton-desactivar"
      @click="emit('pedir-eliminar')"
    >
      Eliminar presupuesto
    </button>
    <button type="button" class="enlace-secundario" @click="emit('cerrar')">Cancelar</button>
  </form>
</template>

<style scoped>
.chips-categoria {
  display: flex;
  flex-wrap: wrap;
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
.chip-categoria.activo {
  border-color: var(--color-primario);
  background: #e2f4f1;
  color: #0b7a6e;
}

.punto-categoria {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.valor-solo-lectura {
  display: inline-flex;
  align-items: center;
  gap: var(--espacio-2);
  margin: 0;
  padding: var(--espacio-2) var(--espacio-3);
  border-radius: 999px;
  border: 1px solid var(--color-borde);
  background: var(--color-fondo-app);
  font-size: var(--tamano-pequeno);
  font-weight: 600;
  color: var(--color-texto-secundario);
  width: fit-content;
}

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
