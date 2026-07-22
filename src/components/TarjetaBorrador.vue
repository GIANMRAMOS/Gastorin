<script setup lang="ts">
import { computed, ref } from 'vue'
import ToggleMoneda from '@/components/ToggleMoneda.vue'
import { useBandeja } from '@/composables/useBandeja'
import { useColorCategoria } from '@/composables/useColorCategoria'
import { useMoneda } from '@/composables/useMoneda'
import type { Categoria, Gasto, Moneda } from '@/types/gasto'

/**
 * Tarjeta de un borrador de la bandeja (HU-5.2). Encapsula sus propias
 * acciones (confirmar/descartar/editar categoría) llamando directamente a
 * `useBandeja`, siguiendo el mismo patrón de `FormularioGasto` (el componente
 * es responsable de su propia IO, el store refleja el resultado solo).
 */
const props = defineProps<{
  borrador: Gasto
  /** Categorías activas del usuario, para el selector de chips. */
  categorias: Categoria[]
}>()

const { confirmarBorrador, descartarBorrador, editarCategoriaBorrador } = useBandeja()
const { colorCategoria } = useColorCategoria()
const { formatearMonto } = useMoneda()

const esRevisionManual = computed(() => props.borrador.estado === 'revision_manual')

/** Estado local editable de monto/moneda, solo relevante en revisión manual. */
const montoEditado = ref(props.borrador.monto != null ? String(props.borrador.monto) : '')
const monedaEditada = ref<Moneda | ''>(props.borrador.moneda ?? '')

/** El chip de categoría, tocado, expande/colapsa la fila de alternativas (1 toque abre). */
const chipsExpandidos = ref(false)

const enviando = ref(false)
const errorLocal = ref<string | null>(null)

/** Nombre de la categoría actual del borrador (sugerida o ya editada). */
const categoriaActual = computed(
  () => props.categorias.find((c) => c.id === props.borrador.categoria_id) ?? null,
)

/** Falta completar monto y/o moneda: campos dudosos a resaltar en revisión manual. */
const faltaMonto = computed(() => esRevisionManual.value && props.borrador.monto == null)
const faltaMoneda = computed(() => esRevisionManual.value && props.borrador.moneda == null)

/** Confirmar queda bloqueado hasta que, en revisión manual, monto y moneda estén completos. */
const puedeConfirmar = computed(() => {
  if (!esRevisionManual.value) return true
  const montoNumerico = Number(montoEditado.value)
  return montoEditado.value.trim() !== '' && !Number.isNaN(montoNumerico) && montoNumerico > 0 && monedaEditada.value !== ''
})

/** Monto formateado para mostrar en grande cuando ya está completo. */
const montoFormateado = computed(() => {
  if (props.borrador.monto == null || props.borrador.moneda == null) return null
  return formatearMonto(props.borrador.monto, props.borrador.moneda)
})

/** Abre/cierra la fila de chips de categorías alternativas (1 toque). */
function alternarChips() {
  chipsExpandidos.value = !chipsExpandidos.value
}

/** Elige una categoría alternativa (1 toque) y la persiste sin salir de la tarjeta. */
async function elegirCategoria(categoriaId: string) {
  if (categoriaId === props.borrador.categoria_id) {
    chipsExpandidos.value = false
    return
  }
  errorLocal.value = null
  const exito = await editarCategoriaBorrador(props.borrador.id, categoriaId)
  if (!exito) {
    errorLocal.value = 'No se pudo cambiar la categoría.'
  }
  chipsExpandidos.value = false
}

/** Confirma el borrador, completando monto/moneda si venía en revisión manual. */
async function confirmar() {
  if (!puedeConfirmar.value || enviando.value) return
  errorLocal.value = null
  enviando.value = true
  try {
    const datosCompletar = esRevisionManual.value
      ? { monto: Number(montoEditado.value), moneda: monedaEditada.value as Moneda }
      : undefined
    const exito = await confirmarBorrador(props.borrador.id, datosCompletar)
    if (!exito) {
      errorLocal.value = 'No se pudo confirmar el gasto.'
    }
  } finally {
    enviando.value = false
  }
}

/** Descarta el borrador (soft-delete): desaparece de la bandeja. */
async function descartar() {
  if (enviando.value) return
  errorLocal.value = null
  enviando.value = true
  try {
    const exito = await descartarBorrador(props.borrador.id)
    if (!exito) {
      errorLocal.value = 'No se pudo descartar el gasto.'
    }
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <li class="tarjeta-borrador" :class="{ 'tarjeta-alerta': esRevisionManual }">
    <p v-if="esRevisionManual" class="etiqueta-alerta">⚠ Revisión manual</p>

    <p v-if="borrador.gmail_fragmento" class="fragmento-correo">"{{ borrador.gmail_fragmento }}"</p>

    <div class="cabecera-tarjeta">
      <p class="comercio-tarjeta">{{ borrador.descripcion || 'Gasto sin descripción' }}</p>
      <p class="fecha-tarjeta">{{ borrador.fecha }}</p>
    </div>

    <div class="bloque-monto-tarjeta">
      <template v-if="montoFormateado">
        <span class="monto-tarjeta">{{ montoFormateado }}</span>
        <span class="chip-moneda">{{ borrador.moneda }}</span>
      </template>
      <template v-else>
        <div class="campo-dudoso" :class="{ resaltado: faltaMonto }">
          <label :for="`monto-${borrador.id}`">Monto (falta completar)</label>
          <input
            :id="`monto-${borrador.id}`"
            v-model="montoEditado"
            type="text"
            inputmode="decimal"
            class="entrada"
            placeholder="0.00"
          />
        </div>
        <div class="campo-dudoso" :class="{ resaltado: faltaMoneda }">
          <label>Moneda (falta completar)</label>
          <ToggleMoneda v-model="monedaEditada" />
        </div>
      </template>
    </div>

    <div class="bloque-categoria-tarjeta">
      <button type="button" class="chip-categoria-tocable" @click="alternarChips">
        <span
          class="punto-categoria"
          :style="{ background: colorCategoria(categoriaActual?.nombre) }"
        />
        {{ categoriaActual?.nombre ?? 'Sin categoría' }}
      </button>

      <div v-if="chipsExpandidos" class="chips-categoria-alternativas">
        <button
          v-for="categoria in categorias"
          :key="categoria.id"
          type="button"
          class="chip-categoria"
          :class="{ activo: categoria.id === borrador.categoria_id }"
          @click="elegirCategoria(categoria.id)"
        >
          <span class="punto-categoria" :style="{ background: colorCategoria(categoria.nombre) }" />
          {{ categoria.nombre }}
        </button>
      </div>
    </div>

    <p v-if="errorLocal" role="alert" class="mensaje-error">{{ errorLocal }}</p>

    <div class="acciones-tarjeta">
      <button
        type="button"
        class="boton-primario boton-confirmar"
        :disabled="!puedeConfirmar || enviando"
        @click="confirmar"
      >
        ✓ Confirmar
      </button>
      <button type="button" class="boton-descartar" :disabled="enviando" @click="descartar">
        ✕ Descartar
      </button>
    </div>
  </li>
</template>

<style scoped>
.tarjeta-borrador {
  list-style: none;
  background: var(--color-fondo);
  border: 1px solid var(--color-borde-tarjeta);
  border-radius: var(--radio-tarjeta);
  padding: var(--espacio-4);
  display: flex;
  flex-direction: column;
  gap: var(--espacio-3);
}

.tarjeta-alerta {
  border-color: #f59e0b;
}

.etiqueta-alerta {
  margin: 0;
  align-self: flex-start;
  background: #fffbeb;
  color: #b45309;
  font-size: var(--tamano-pequeno);
  font-weight: 700;
  padding: var(--espacio-1) var(--espacio-3);
  border-radius: 999px;
}

.fragmento-correo {
  margin: 0;
  font-size: var(--tamano-pequeno);
  color: var(--color-texto-terciario);
  font-style: italic;
}

.cabecera-tarjeta {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--espacio-3);
}

.comercio-tarjeta {
  margin: 0;
  font-weight: 700;
  color: var(--color-texto);
}

.fecha-tarjeta {
  margin: 0;
  font-size: var(--tamano-pequeno);
  color: var(--color-texto-secundario);
  white-space: nowrap;
}

.bloque-monto-tarjeta {
  display: flex;
  align-items: center;
  gap: var(--espacio-3);
  flex-wrap: wrap;
}

.monto-tarjeta {
  font-size: 28px;
  font-weight: 800;
  color: var(--color-texto);
}

.chip-moneda {
  background: var(--color-fondo-app);
  color: var(--color-texto-secundario);
  font-size: var(--tamano-pequeno);
  font-weight: 700;
  padding: var(--espacio-1) var(--espacio-2);
  border-radius: 999px;
}

.campo-dudoso {
  display: flex;
  flex-direction: column;
  gap: var(--espacio-1);
}

.campo-dudoso label {
  font-size: var(--tamano-pequeno);
  font-weight: 600;
  color: #b45309;
}

.campo-dudoso.resaltado .entrada {
  border-color: #f59e0b;
  background: #fffbeb;
}

.bloque-categoria-tarjeta {
  display: flex;
  flex-direction: column;
  gap: var(--espacio-2);
}

.chip-categoria-tocable {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: var(--espacio-2);
  padding: var(--espacio-2) var(--espacio-3);
  border-radius: 999px;
  border: 1px dashed var(--color-borde);
  background: var(--color-fondo-app);
  font-size: var(--tamano-pequeno);
  font-weight: 600;
  color: var(--color-texto);
  cursor: pointer;
  font-family: var(--fuente-base);
}

.chips-categoria-alternativas {
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

.acciones-tarjeta {
  display: flex;
  gap: var(--espacio-3);
}

.boton-confirmar {
  width: auto;
  flex: 1;
  min-height: 44px;
  margin-top: 0;
}

.boton-descartar {
  width: auto;
  min-height: 44px;
  padding: 0 var(--espacio-4);
  background: none;
  border: 1px solid var(--color-borde);
  border-radius: var(--radio-borde);
  color: var(--color-texto-secundario);
  font-weight: 600;
  cursor: pointer;
  font-family: var(--fuente-base);
}
.boton-descartar:hover:not(:disabled) {
  border-color: var(--color-error);
  color: var(--color-error);
}
.boton-descartar:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
