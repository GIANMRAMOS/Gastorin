<script setup lang="ts">
import { computed, ref } from 'vue'
import ToggleMoneda from '@/components/ToggleMoneda.vue'
import { useIngresos } from '@/composables/useIngresos'
import { useIngresosStore } from '@/stores/ingresos'
import type { IngresoInput } from '@/types/ingreso'
import type { Moneda } from '@/types/gasto'

/**
 * Formulario de alta de ingreso (Épica 11, HU-11.2). Solo cubre alta (sin
 * modo edición: no está en las HU actuales). Los bancos se leen de
 * `useIngresosStore` (cargados por la vista contenedora vía `useBancos`).
 */
const emit = defineEmits<{
  guardado: []
  cerrar: []
}>()

/** Fecha de hoy en `YYYY-MM-DD` **local** (nunca `toISOString()`, que corrige a UTC y puede mostrar el día siguiente/anterior). */
function hoyISO(): string {
  const ahora = new Date()
  const anio = ahora.getFullYear()
  const mes = String(ahora.getMonth() + 1).padStart(2, '0')
  const dia = String(ahora.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

const fecha = ref(hoyISO())
const bancoId = ref('')
const moneda = ref<Moneda | ''>('PEN')
const importe = ref('')
const concepto = ref('')

const errorValidacion = ref<string | null>(null)

const storeIngresos = useIngresosStore()
const { crearIngreso } = useIngresos()

/** No hay bancos cargados: hay que bloquear el guardado (patrón "sin categorías"). */
const sinBancos = computed(() => storeIngresos.bancos.length === 0)

/** Valida los campos antes de enviar (HU-11.2): todos bloquean antes de llamar al backend. */
function validarFormulario(): boolean {
  if (sinBancos.value) {
    errorValidacion.value = 'No hay bancos; créalos primero.'
    return false
  }
  const importeNumerico = Number(importe.value)
  if (!importe.value.trim() || Number.isNaN(importeNumerico) || importeNumerico <= 0) {
    errorValidacion.value = 'Ingresa un importe válido mayor a 0.'
    return false
  }
  if (!bancoId.value) {
    errorValidacion.value = 'Selecciona un banco.'
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

/** Envía el formulario: crea el ingreso. */
async function manejarEnvio() {
  storeIngresos.limpiarError()
  if (!validarFormulario()) {
    return
  }

  const input: IngresoInput = {
    banco_id: bancoId.value,
    fecha: fecha.value,
    moneda: moneda.value as Moneda,
    importe: Number(importe.value),
    concepto: concepto.value.trim(),
  }
  const exito = await crearIngreso(input)

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
      :disabled="storeIngresos.cargando || sinBancos"
      class="boton-primario"
      :class="{ cargando: storeIngresos.cargando }"
    >
      Guardar
    </button>
    <button type="button" class="enlace-secundario" @click="emit('cerrar')">Cancelar</button>
  </form>
</template>
