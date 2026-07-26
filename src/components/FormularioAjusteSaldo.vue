<script setup lang="ts">
import { ref } from 'vue'
import { useAjustesSaldo } from '@/composables/useAjustesSaldo'
import { useMoneda } from '@/composables/useMoneda'
import { useGastosStore } from '@/stores/gastos'
import type { Moneda } from '@/types/gasto'

/**
 * Formulario para "setear el saldo" de una cuenta (banco+moneda) desde la
 * tarjeta "Saldo por cuenta" del Dashboard (migración 011). Siempre crea un
 * ajuste NUEVO (nunca edita uno anterior): el historial se conserva y el más
 * reciente por fecha es el que gobierna el cálculo desde ese momento (ver
 * `calcularSaldoNetoPorCuenta` en `useDashboard.ts`).
 */
const props = defineProps<{
  bancoId: string
  moneda: Moneda
  /** Etiqueta ya resuelta por `TarjetaSaldosPorCuenta` (ej. "BCP", "IBK S/.", "IBK $"), solo para mostrar. */
  etiqueta: string
}>()

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

const saldo = ref('')
const fecha = ref(hoyISO())
const errorValidacion = ref<string | null>(null)

const storeGastos = useGastosStore()
const { guardarAjusteSaldo } = useAjustesSaldo()
const { formatearMonto } = useMoneda()

const simboloMoneda = formatearMonto(0, props.moneda).replace(/[\d.,\s]/g, '')

/** Valida que el saldo sea un número (puede ser negativo, ej. una cuenta en sobregiro) y que haya fecha. */
function validarFormulario(): boolean {
  const saldoNumerico = Number(saldo.value)
  if (!saldo.value.trim() || Number.isNaN(saldoNumerico)) {
    errorValidacion.value = 'Ingresa un saldo válido.'
    return false
  }
  if (!fecha.value) {
    errorValidacion.value = 'Selecciona una fecha.'
    return false
  }
  errorValidacion.value = null
  return true
}

/** Envía el formulario: siempre un INSERT nuevo (nunca sobrescribe un ajuste anterior). */
async function manejarEnvio() {
  storeGastos.limpiarError()
  if (!validarFormulario()) {
    return
  }

  const exito = await guardarAjusteSaldo({
    banco_id: props.bancoId,
    moneda: props.moneda,
    saldo: Number(saldo.value),
    fecha: fecha.value,
  })

  if (exito) {
    emit('guardado')
  }
}
</script>

<template>
  <form class="formulario-ajuste-saldo" @submit.prevent="manejarEnvio">
    <p class="nota-ajuste-saldo">
      Desde la fecha que elijas, el saldo de <strong>{{ etiqueta }}</strong> se calcula sumando/restando
      los ingresos y egresos de esa cuenta a partir de este monto — no desde el historial completo.
    </p>

    <div class="grupo-campo">
      <label for="saldo-ajuste">Saldo ({{ simboloMoneda }})</label>
      <input
        id="saldo-ajuste"
        v-model="saldo"
        type="text"
        inputmode="decimal"
        class="entrada"
        placeholder="0.00"
      />
    </div>

    <div class="grupo-campo">
      <label for="fecha-ajuste">Fecha</label>
      <input id="fecha-ajuste" v-model="fecha" type="date" class="entrada" />
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

<style scoped>
.nota-ajuste-saldo {
  margin: 0 0 var(--espacio-4);
  font-size: var(--tamano-pequeno);
  color: var(--color-texto-secundario);
}
</style>
