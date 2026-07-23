<script setup lang="ts">
import { computed, ref } from 'vue'
import ToggleMoneda from '@/components/ToggleMoneda.vue'
import { useGastos } from '@/composables/useGastos'
import { useColorCategoria } from '@/composables/useColorCategoria'
import { useGastosStore } from '@/stores/gastos'
import { useIngresosStore } from '@/stores/ingresos'
import { useMoneda } from '@/composables/useMoneda'
import type { Gasto, GastoInput, Moneda } from '@/types/gasto'

/**
 * Formulario único compartido por alta y edición de gastos.
 * Si `gasto` viene definido, el formulario arranca en modo edición prellenado;
 * si no, arranca en modo alta. Para gastos con `origen === 'correo'`, `monto`
 * y `fecha` se muestran como referencia no editable (no se pueden modificar);
 * categoría, banco y descripción sí son editables.
 */
const props = defineProps<{
  gasto?: Gasto | null
}>()

const emit = defineEmits<{
  guardado: []
  cerrar: []
}>()

const esEdicion = computed(() => props.gasto != null)
const esOrigenCorreo = computed(() => props.gasto?.origen === 'correo')

/** Fecha de hoy en `YYYY-MM-DD` **local** (nunca `toISOString()`, que corrige a UTC y puede mostrar el día siguiente/anterior). */
function hoyISO(): string {
  const ahora = new Date()
  const anio = ahora.getFullYear()
  const mes = String(ahora.getMonth() + 1).padStart(2, '0')
  const dia = String(ahora.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

const monto = ref(props.gasto ? String(props.gasto.monto) : '')
// En alta, la moneda arranca en PEN (default); en edición, respeta la del gasto.
const moneda = ref<Moneda | ''>(props.gasto?.moneda ?? 'PEN')
const categoriaId = ref(props.gasto?.categoria_id ?? '')
const bancoId = ref(props.gasto?.banco_id ?? '')
// En alta, la fecha arranca en hoy; en edición (incluida origen correo) respeta la del gasto.
const fecha = ref(props.gasto?.fecha ?? hoyISO())
const descripcion = ref(props.gasto?.descripcion ?? '')

const errorValidacion = ref<string | null>(null)

const storeGastos = useGastosStore()
const storeIngresos = useIngresosStore()
const { crearGasto, editarGasto } = useGastos()
const { colorCategoria } = useColorCategoria()
const { formatearMonto } = useMoneda()

/** Símbolo de moneda para el adorno visual del monto grande (el v-model sigue siendo numérico). */
const SIMBOLO_MONEDA: Record<Moneda, string> = { PEN: 'S/', USD: '$' }
const simboloMonto = computed(() => (moneda.value ? SIMBOLO_MONEDA[moneda.value as Moneda] : 'S/'))

/**
 * Categorías seleccionables para dar de alta un gasto: solo activas (una
 * categoría desactivada solo debe seguir viéndose en gastos históricos, no
 * ofrecerse aquí).
 */
const categoriasActivas = computed(() => storeGastos.categorias.filter((c) => c.activa))

/** Selecciona una categoría desde los chips (escribe en el select oculto). */
function elegirCategoria(id: string) {
  if (sinCategorias.value) return
  categoriaId.value = id
}

/** No hay categorías activas cargadas: la gestión de categorías es otra épica, hay que bloquear el guardado. */
const sinCategorias = computed(() => categoriasActivas.value.length === 0)

/**
 * No hay bancos cargados: `banco_id` es obligatorio (migración `006`), hay
 * que bloquear el guardado igual que con categorías. La carga de bancos la
 * hace la vista contenedora vía `useBancos` (catálogo compartido, vive en
 * `stores/ingresos.ts`).
 */
const sinBancos = computed(() => storeIngresos.bancos.length === 0)

/** Monto formateado de solo lectura para gastos de origen correo (no editable). */
const montoReferencia = computed(() => {
  if (!props.gasto) return ''
  // Este formulario solo edita gastos ya `estado='confirmado'` (vienen del
  // Historial, que filtra por ese estado): `monto`/`moneda` solo pueden ser
  // `null` en `estado='revision_manual'` (bandeja de borradores, ver
  // `useBandeja`), así que aquí siempre están completos.
  if (props.gasto.monto == null || props.gasto.moneda == null) return ''
  return formatearMonto(props.gasto.monto, props.gasto.moneda)
})

/** Valida los campos editables según el modo (alta, edición manual o edición de correo). */
function validarFormulario(): boolean {
  if (sinCategorias.value) {
    errorValidacion.value = 'No hay categorías; créalas primero.'
    return false
  }
  if (!categoriaId.value) {
    errorValidacion.value = 'Selecciona una categoría.'
    return false
  }
  if (!bancoId.value) {
    errorValidacion.value = 'Selecciona un banco.'
    return false
  }
  if (!esOrigenCorreo.value) {
    const montoNumerico = Number(monto.value)
    if (!monto.value.trim() || Number.isNaN(montoNumerico) || montoNumerico <= 0) {
      errorValidacion.value = 'Ingresa un monto válido mayor a 0.'
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
  }
  errorValidacion.value = null
  return true
}

/** Envía el formulario: crea o edita el gasto según el modo actual. */
async function manejarEnvio() {
  storeGastos.limpiarError()
  if (!validarFormulario()) {
    return
  }

  let exito = false
  if (esEdicion.value && props.gasto) {
    if (esOrigenCorreo.value) {
      // Gastos de correo: monto y fecha no son editables; categoría, banco y
      // descripción sí (el banco se deja editable para poder corregir la
      // inferencia automática, igual que la categoría).
      exito = await editarGasto(props.gasto.id, {
        categoria_id: categoriaId.value,
        banco_id: bancoId.value,
        descripcion: descripcion.value.trim() || null,
      })
    } else {
      exito = await editarGasto(props.gasto.id, {
        monto: Number(monto.value),
        moneda: moneda.value as Moneda,
        categoria_id: categoriaId.value,
        banco_id: bancoId.value,
        fecha: fecha.value,
        descripcion: descripcion.value.trim() || null,
      })
    }
  } else {
    const input: GastoInput = {
      monto: Number(monto.value),
      moneda: moneda.value as Moneda,
      categoria_id: categoriaId.value,
      banco_id: bancoId.value,
      fecha: fecha.value,
      descripcion: descripcion.value.trim() || null,
    }
    exito = await crearGasto(input)
  }

  if (exito) {
    emit('guardado')
  }
}
</script>

<template>
  <form class="formulario-gasto" @submit.prevent="manejarEnvio">
    <p v-if="sinCategorias" role="alert" class="mensaje-error">
      No hay categorías; créalas primero.
    </p>

    <div class="bloque-monto">
      <label for="monto">Monto</label>
      <div v-if="esOrigenCorreo" class="monto-grande">
        <input
          id="monto"
          type="text"
          class="entrada entrada-monto sr-only"
          :value="montoReferencia"
          disabled
        />
        <span class="valor-monto-referencia">{{ montoReferencia }}</span>
      </div>
      <div v-else class="monto-grande">
        <span class="simbolo-monto">{{ simboloMonto }}</span>
        <input
          id="monto"
          v-model="monto"
          type="text"
          inputmode="decimal"
          class="entrada entrada-monto"
          placeholder="0.00"
        />
      </div>

      <!-- Toggle segmentado PEN/USD: capa visual. El <select> real, oculto,
           sigue siendo la fuente de verdad del v-model de moneda. -->
      <ToggleMoneda v-model="moneda" :disabled="esOrigenCorreo" />
      <select id="moneda" v-model="moneda" class="sr-only" :disabled="esOrigenCorreo">
        <option value="" disabled>Selecciona una moneda</option>
        <option value="PEN">PEN</option>
        <option value="USD">USD</option>
      </select>
    </div>

    <div class="grupo-campo">
      <label>Categoría</label>
      <!-- Chips de categoría: capa visual sobre el <select> oculto (fuente de verdad). -->
      <div v-if="!sinCategorias" class="chips-categoria">
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
      <select
        id="categoria"
        v-model="categoriaId"
        class="sr-only"
        :disabled="sinCategorias"
      >
        <option value="" disabled>Selecciona una categoría</option>
        <option
          v-for="categoria in categoriasActivas"
          :key="categoria.id"
          :value="categoria.id"
        >
          {{ categoria.nombre }}
        </option>
      </select>
    </div>

    <div class="grupo-campo">
      <label for="banco">Banco</label>
      <p v-if="sinBancos" role="alert" class="mensaje-error">No hay bancos; créalos primero.</p>
      <select id="banco" v-model="bancoId" class="entrada" :disabled="sinBancos">
        <option value="" disabled>Selecciona un banco</option>
        <option v-for="banco in storeIngresos.bancos" :key="banco.id" :value="banco.id">
          {{ banco.nombre }}
        </option>
      </select>
    </div>

    <div class="grupo-campo">
      <label for="fecha">Fecha</label>
      <input
        id="fecha"
        v-model="fecha"
        type="date"
        class="entrada"
        :disabled="esOrigenCorreo"
      />
    </div>

    <div class="grupo-campo">
      <label for="descripcion">Descripción</label>
      <input id="descripcion" v-model="descripcion" type="text" class="entrada" />
    </div>

    <p v-if="errorValidacion" role="alert" class="mensaje-error">{{ errorValidacion }}</p>
    <p v-else-if="storeGastos.error" role="alert" class="mensaje-error">{{ storeGastos.error }}</p>

    <button
      type="submit"
      :disabled="storeGastos.cargando || sinCategorias || sinBancos"
      class="boton-primario"
      :class="{ cargando: storeGastos.cargando }"
    >
      Guardar
    </button>
    <button type="button" class="enlace-secundario" @click="emit('cerrar')">Cancelar</button>
  </form>
</template>

<style scoped>
.bloque-monto {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--espacio-3);
  margin-bottom: var(--espacio-4);
}

.bloque-monto label {
  align-self: flex-start;
  font-weight: 600;
  font-size: var(--tamano-pequeno);
  color: var(--color-texto-secundario);
}

.monto-grande {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--espacio-2);
}

.simbolo-monto {
  font-size: 32px;
  font-weight: 700;
  color: var(--color-texto-terciario);
}

.entrada-monto {
  width: auto;
  min-height: auto;
  border: none;
  text-align: center;
  font-size: 46px;
  font-weight: 800;
  padding: 0;
  color: var(--color-texto);
}
.entrada-monto:focus {
  outline: none;
  box-shadow: none;
}

.valor-monto-referencia {
  font-size: 46px;
  font-weight: 800;
  color: var(--color-texto-terciario);
}

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
</style>
