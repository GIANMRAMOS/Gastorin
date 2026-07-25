<script setup lang="ts">
import { computed, ref } from 'vue'
import ToggleMoneda from '@/components/ToggleMoneda.vue'
import { useIngresos } from '@/composables/useIngresos'
import { useIngresosStore } from '@/stores/ingresos'
import { useGastosStore } from '@/stores/gastos'
import type { Ingreso, IngresoInput } from '@/types/ingreso'
import type { Moneda } from '@/types/gasto'

/**
 * Formulario único compartido por alta y edición de ingresos (Épica 11,
 * HU-11.2/11.3). Si `ingreso` viene definido, arranca en modo edición
 * prellenado; si no, arranca en modo alta. A diferencia de gastos, Ingreso
 * no tiene concepto de `origen === 'correo'`: todos los campos son siempre
 * editables en ambos modos. Los bancos se leen de `useIngresosStore`
 * (cargados por la vista contenedora vía `useBancos`). Desde la migración
 * `008` (Fase 2 "Caudal", Épica 12), el ingreso exige una categoría propia
 * (`tipo === 'ingreso'`, catálogo separado del de Gasto): selector nativo en
 * orden alfabético, mismo patrón que `FormularioGasto.vue`. La gestión de
 * categorías de ingreso queda fuera de esta fase (no hay "+ Nueva categoría"
 * inline: no existe precedente de ese patrón hoy en el repo, ni siquiera para
 * bancos).
 */
const props = defineProps<{
  ingreso?: Ingreso | null
}>()

const emit = defineEmits<{
  guardado: []
  cerrar: []
}>()

const esEdicion = computed(() => props.ingreso != null)

/** Fecha de hoy en `YYYY-MM-DD` **local** (nunca `toISOString()`, que corrige a UTC y puede mostrar el día siguiente/anterior). */
function hoyISO(): string {
  const ahora = new Date()
  const anio = ahora.getFullYear()
  const mes = String(ahora.getMonth() + 1).padStart(2, '0')
  const dia = String(ahora.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

const fecha = ref(props.ingreso?.fecha ?? hoyISO())
const bancoId = ref(props.ingreso?.banco_id ?? '')
const categoriaId = ref(props.ingreso?.categoria_id ?? '')
const moneda = ref<Moneda | ''>(props.ingreso?.moneda ?? 'PEN')
const importe = ref(props.ingreso ? String(props.ingreso.importe) : '')
const concepto = ref(props.ingreso?.concepto ?? '')

const errorValidacion = ref<string | null>(null)

const storeIngresos = useIngresosStore()
const storeGastos = useGastosStore()
const { crearIngreso, editarIngreso } = useIngresos()

/** No hay bancos cargados: hay que bloquear el guardado (patrón "sin categorías"). */
const sinBancos = computed(() => storeIngresos.bancos.length === 0)

/**
 * Categorías de INGRESO activas (el catálogo de categorías es una bolsa
 * mixta de ambos tipos desde la migración 008; aquí solo se ofrecen las de
 * `tipo === 'ingreso'`, nunca las de gasto).
 */
const categoriasActivas = computed(() =>
  storeGastos.categorias.filter((c) => c.activa && c.tipo === 'ingreso'),
)

/** No hay categorías de ingreso activas cargadas: hay que bloquear el guardado (patrón "sin bancos"). */
const sinCategorias = computed(() => categoriasActivas.value.length === 0)

/** Mismas categorías, en orden alfabético (selector nativo, ahorra espacio en el modal). */
const categoriasOrdenadas = computed(() =>
  [...categoriasActivas.value].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })),
)

/** Valida los campos antes de enviar (HU-11.2): todos bloquean antes de llamar al backend. */
function validarFormulario(): boolean {
  if (sinBancos.value) {
    errorValidacion.value = 'No hay bancos; créalos primero.'
    return false
  }
  if (sinCategorias.value) {
    errorValidacion.value = 'No hay categorías de ingreso; créalas primero.'
    return false
  }
  const importeNumerico = Number(importe.value)
  if (!importe.value.trim() || Number.isNaN(importeNumerico) || importeNumerico === 0) {
    errorValidacion.value = 'El importe no puede ser cero.'
    return false
  }
  if (!bancoId.value) {
    errorValidacion.value = 'Selecciona un banco.'
    return false
  }
  if (!categoriaId.value) {
    errorValidacion.value = 'Selecciona una categoría.'
    return false
  }
  if (!moneda.value) {
    errorValidacion.value = 'Selecciona una moneda.'
    return false
  }
  if (!fecha.value) {
    errorValidacion.value = 'Selecciona una fecha.'
    return false
  }
  if (!concepto.value.trim()) {
    errorValidacion.value = 'Ingresa un concepto.'
    return false
  }
  errorValidacion.value = null
  return true
}

/** Envía el formulario: crea o edita el ingreso según el modo actual. */
async function manejarEnvio() {
  storeIngresos.limpiarError()
  if (!validarFormulario()) {
    return
  }

  const input: IngresoInput = {
    banco_id: bancoId.value,
    categoria_id: categoriaId.value,
    fecha: fecha.value,
    moneda: moneda.value as Moneda,
    importe: Number(importe.value),
    concepto: concepto.value.trim(),
  }

  const exito =
    esEdicion.value && props.ingreso
      ? await editarIngreso(props.ingreso.id, input)
      : await crearIngreso(input)

  if (exito) {
    emit('guardado')
  }
}
</script>

<template>
  <form class="formulario-ingreso" @submit.prevent="manejarEnvio">
    <p v-if="sinBancos" role="alert" class="mensaje-error">
      No hay bancos; créalos primero.
    </p>
    <p v-else-if="sinCategorias" role="alert" class="mensaje-error">
      No hay categorías de ingreso; créalas primero.
    </p>

    <div class="grupo-campo">
      <label for="importe">Importe</label>
      <input
        id="importe"
        v-model="importe"
        type="text"
        inputmode="decimal"
        class="entrada"
        placeholder="0.00"
        :disabled="sinBancos"
      />
    </div>

    <ToggleMoneda v-model="moneda" :disabled="sinBancos" />
    <select id="moneda-ingreso" v-model="moneda" class="sr-only" :disabled="sinBancos">
      <option value="" disabled>Selecciona una moneda</option>
      <option value="PEN">PEN</option>
      <option value="USD">USD</option>
    </select>

    <div class="grupo-campo">
      <label for="categoria-ingreso">Categoría</label>
      <select id="categoria-ingreso" v-model="categoriaId" class="entrada" :disabled="sinCategorias">
        <option value="" disabled>Selecciona una categoría</option>
        <option v-for="categoria in categoriasOrdenadas" :key="categoria.id" :value="categoria.id">
          {{ categoria.nombre }}
        </option>
      </select>
    </div>

    <div class="grupo-campo">
      <label for="banco">Banco</label>
      <select id="banco" v-model="bancoId" class="entrada" :disabled="sinBancos">
        <option value="" disabled>Selecciona un banco</option>
        <option v-for="banco in storeIngresos.bancos" :key="banco.id" :value="banco.id">
          {{ banco.nombre }}
        </option>
      </select>
    </div>

    <div class="grupo-campo">
      <label for="fecha-ingreso">Fecha</label>
      <input id="fecha-ingreso" v-model="fecha" type="date" class="entrada" :disabled="sinBancos" />
    </div>

    <div class="grupo-campo">
      <label for="concepto">Concepto</label>
      <input id="concepto" v-model="concepto" type="text" class="entrada" :disabled="sinBancos" />
    </div>

    <p v-if="errorValidacion" role="alert" class="mensaje-error">{{ errorValidacion }}</p>
    <p v-else-if="storeIngresos.error" role="alert" class="mensaje-error">{{ storeIngresos.error }}</p>

    <button
      type="submit"
      :disabled="storeIngresos.cargando || sinBancos || sinCategorias"
      class="boton-primario"
      :class="{ cargando: storeIngresos.cargando }"
    >
      Guardar
    </button>
    <button type="button" class="enlace-secundario" @click="emit('cerrar')">Cancelar</button>
  </form>
</template>

