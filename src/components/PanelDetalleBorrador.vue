<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import ToggleMoneda from '@/components/ToggleMoneda.vue'
import { useBandeja } from '@/composables/useBandeja'
import { useReglasComercio } from '@/composables/useReglasComercio'
import { useColorCategoria } from '@/composables/useColorCategoria'
import { useMoneda } from '@/composables/useMoneda'
import { useIngresosStore } from '@/stores/ingresos'
import type { BorradorInput, Categoria, Gasto, Moneda } from '@/types/gasto'
import type { ReglaComercio } from '@/types/reglaComercio'

/**
 * Panel de detalle del borrador seleccionado (rediseño "Caudal", Fase 3):
 * absorbe la edición que antes vivía en `TarjetaBorrador.vue` (monto/moneda
 * editables en revisión manual, selector de categoría, confirmar/descartar),
 * más el banner de sugerencia de categoría/banco de HU-14.1 (extendida en la
 * migración 012). Sigue el mismo patrón "el componente es responsable de su
 * propia IO, el store refleja el resultado solo" (llama directamente a
 * `useBandeja`/`useReglasComercio`). Banco pasó de texto de solo lectura a
 * `<select>` editable, preseleccionado por la regla de comercio si ésta trae
 * `banco_id` (mismo patrón que `FormularioGasto.vue`, leyendo el catálogo
 * directo de `useIngresosStore`).
 *
 * El padre (`BandejaView`) monta este componente con `:key="borrador.id"`
 * para que se recree por completo al cambiar de selección: todo el estado
 * local de abajo nace fresco por cada borrador, sin necesidad de `watch`.
 */
const props = defineProps<{
  borrador: Gasto
  /** Categorías activas del usuario, para el selector de chips. */
  categorias: Categoria[]
}>()

const emit = defineEmits<{
  /** Se emite al volver a la lista (botón "Volver" en móvil) o tras confirmar/descartar con éxito. */
  cerrar: []
}>()

const { confirmarBorrador, descartarBorrador } = useBandeja()
const { buscarReglaPorComercio, contarCargosComercio, guardarRegla } = useReglasComercio()
const { colorCategoria } = useColorCategoria()
const { formatearMonto } = useMoneda()
const storeIngresos = useIngresosStore()

const esRevisionManual = computed(() => props.borrador.estado === 'revision_manual')

/** Estado local editable de monto/moneda, solo relevante en revisión manual. */
const montoEditado = ref(props.borrador.monto != null ? String(props.borrador.monto) : '')
const monedaEditada = ref<Moneda | ''>(props.borrador.moneda ?? '')

/**
 * Categoría elegida para este borrador: nace con la del correo y puede
 * cambiar por la sugerencia de HU-14.1 o por un chip elegido a mano. Se
 * persiste recién al confirmar (un solo UPDATE), no en cada toque de chip.
 */
const categoriaSeleccionadaId = ref(props.borrador.categoria_id)

/**
 * Banco elegido para este borrador: nace con el que resolvió la Edge Function
 * `importar-borrador` y lo pisa la regla de comercio si ésta trae `banco_id`
 * (migración 012: la regla pesa más que la heurística de la ingesta).
 * Independiente de `categoriaSeleccionadaId`: tocar uno no afecta al otro,
 * aunque al confirmar compartan la misma fila de `reglas_comercio`.
 */
const bancoSeleccionadoId = ref(props.borrador.banco_id)

/** El chip de categoría, tocado, expande/colapsa la fila de alternativas (1 toque abre). */
const chipsExpandidos = ref(false)

const enviando = ref(false)
const errorLocal = ref<string | null>(null)

/** Regla de comercio encontrada (HU-14.1): dispara el banner verde y preselecciona la categoría. */
const reglaEncontrada = ref<ReglaComercio | null>(null)
/** Cantidad de cargos anteriores confirmados de este comercio, para el texto del banner. */
const cantidadCargosPrevios = ref(0)

onMounted(async () => {
  // Un borrador sin `descripcion` (nombre de comercio) no puede generar ni
  // consumir una regla de comercio (no hay con qué buscar/guardar).
  if (!props.borrador.descripcion) return

  const regla = await buscarReglaPorComercio(props.borrador.descripcion)
  if (!regla) return

  reglaEncontrada.value = regla
  if (regla.categoria_id !== categoriaSeleccionadaId.value) {
    categoriaSeleccionadaId.value = regla.categoria_id
  }
  // Solo pisa el banco si la regla trae uno: una regla anterior a la migración
  // 012 (`banco_id` null) debe dejar intacto el banco resuelto por la ingesta.
  if (regla.banco_id) {
    bancoSeleccionadoId.value = regla.banco_id
  }
  cantidadCargosPrevios.value = await contarCargosComercio(props.borrador.descripcion)
})

/** Categoría actualmente elegida (sugerida, editada a mano, o la del correo). */
const categoriaActual = computed(
  () => props.categorias.find((c) => c.id === categoriaSeleccionadaId.value) ?? null,
)

/** Texto del banner verde de HU-14.1 (singular/plural de "cargo(s) anterior(es)"). */
const textoBannerRegla = computed(() => {
  const cantidad = cantidadCargosPrevios.value
  const etiquetaCantidad = cantidad === 1 ? 'cargo anterior' : 'cargos anteriores'
  const prefijo = reglaEncontrada.value?.banco_id ? 'Categoría y banco sugeridos' : 'Categoría sugerida'
  return `${prefijo} por ${cantidad} ${etiquetaCantidad} de ${props.borrador.descripcion}. Al confirmar se guarda la regla.`
})

/** Catálogo de bancos todavía sin cargar: el select se muestra inerte, pero el banco del borrador sigue vigente. */
const sinBancos = computed(() => storeIngresos.bancos.length === 0)

/** Falta completar monto y/o moneda: campos dudosos a resaltar en revisión manual. */
const faltaMonto = computed(() => esRevisionManual.value && props.borrador.monto == null)
const faltaMoneda = computed(() => esRevisionManual.value && props.borrador.moneda == null)

/** Confirmar queda bloqueado hasta que, en revisión manual, monto y moneda estén completos. */
const puedeConfirmar = computed(() => {
  if (!esRevisionManual.value) return true
  const montoNumerico = Number(montoEditado.value)
  return (
    montoEditado.value.trim() !== '' &&
    !Number.isNaN(montoNumerico) &&
    montoNumerico > 0 &&
    monedaEditada.value !== ''
  )
})

/** Monto formateado para mostrar en grande cuando ya está completo. */
const montoFormateado = computed(() => {
  if (props.borrador.monto == null || props.borrador.moneda == null) return null
  return formatearMonto(props.borrador.monto, props.borrador.moneda)
})

/** Hora de notificación (`creado_en`), en formato corto "es-PE" (ej. "14:32"). */
const horaFormateada = computed(() => {
  if (!props.borrador.creado_en) return ''
  const fecha = new Date(props.borrador.creado_en)
  if (Number.isNaN(fecha.getTime())) return ''
  return new Intl.DateTimeFormat('es-PE', { timeStyle: 'short' }).format(fecha)
})

/** Abre/cierra la fila de chips de categorías alternativas (1 toque). */
function alternarChips() {
  chipsExpandidos.value = !chipsExpandidos.value
}

/** Elige una categoría alternativa (1 toque); queda en estado local hasta confirmar. */
function elegirCategoria(categoriaId: string) {
  categoriaSeleccionadaId.value = categoriaId
  chipsExpandidos.value = false
}

/**
 * Confirma el borrador, completando monto/moneda si venía en revisión manual
 * y persistiendo la categoría elegida (sugerida o manual) en el mismo UPDATE.
 * Tras confirmar con éxito, si el borrador queda con una categoría (siempre
 * la tiene: la ingesta asigna "Otros" por defecto) y con `descripcion`,
 * guarda la regla de comercio→categoría para la próxima vez (HU-14.1,
 * decisión: el upsert vive aquí, no dentro de `confirmarBorrador`). Un fallo
 * de ese upsert NO revierte ni bloquea el gasto ya confirmado: se ignora.
 */
async function confirmar() {
  if (!puedeConfirmar.value || enviando.value) return
  errorLocal.value = null
  enviando.value = true
  try {
    const datosCompletar: BorradorInput = { categoria_id: categoriaSeleccionadaId.value }
    if (esRevisionManual.value) {
      datosCompletar.monto = Number(montoEditado.value)
      datosCompletar.moneda = monedaEditada.value as Moneda
    }
    // Guarda contra `''`: si el catálogo no cargó, se prefiere no mandar el campo
    // (el borrador conserva su `banco_id`) antes que romper el UPDATE con un uuid inválido.
    if (bancoSeleccionadoId.value) {
      datosCompletar.banco_id = bancoSeleccionadoId.value
    }

    const exito = await confirmarBorrador(props.borrador.id, datosCompletar)
    if (!exito) {
      errorLocal.value = 'No se pudo confirmar el gasto.'
      return
    }

    if (props.borrador.descripcion && categoriaSeleccionadaId.value) {
      try {
        await guardarRegla(props.borrador.descripcion, categoriaSeleccionadaId.value, bancoSeleccionadoId.value || null)
      } catch {
        // Comodidad, no crítica: un fallo aquí no debe afectar la confirmación ya hecha.
      }
    }

    emit('cerrar')
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
      return
    }
    emit('cerrar')
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <section class="panel-detalle-borrador" :class="{ 'panel-detalle-borrador--alerta': esRevisionManual }">
    <button type="button" class="boton-volver" @click="emit('cerrar')">← Volver a la lista</button>

    <header class="cabecera-panel-detalle">
      <div>
        <p class="comercio-panel-detalle">{{ borrador.descripcion || 'Gasto sin descripción' }}</p>
        <p class="fecha-hora-panel-detalle">
          {{ borrador.fecha }}<template v-if="horaFormateada"> · {{ horaFormateada }}</template>
        </p>
      </div>
      <p v-if="esRevisionManual" class="etiqueta-alerta">⚠ Revisión manual</p>
    </header>

    <div v-if="borrador.gmail_fragmento" class="caja-correo-original">
      <p class="titulo-caja-correo">CORREO ORIGINAL</p>
      <p class="texto-correo-original">"{{ borrador.gmail_fragmento }}"</p>
    </div>

    <p v-if="reglaEncontrada" class="banner-regla-comercio">{{ textoBannerRegla }}</p>

    <div class="fila-datos-panel">
      <div class="dato-panel">
        <p class="etiqueta-dato-panel">Monto</p>
        <template v-if="montoFormateado">
          <p class="valor-dato-panel valor-monto-panel">
            {{ montoFormateado }} <span class="chip-moneda">{{ borrador.moneda }}</span>
          </p>
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
        </template>
      </div>
      <div class="dato-panel">
        <p class="etiqueta-dato-panel">Fecha</p>
        <p class="valor-dato-panel">{{ borrador.fecha }}</p>
      </div>
    </div>

    <div v-if="!montoFormateado" class="campo-dudoso" :class="{ resaltado: faltaMoneda }">
      <label>Moneda (falta completar)</label>
      <ToggleMoneda v-model="monedaEditada" />
    </div>

    <div class="fila-datos-panel">
      <div class="dato-panel bloque-categoria-panel">
        <p class="etiqueta-dato-panel">Categoría</p>
        <button type="button" class="chip-categoria-tocable" @click="alternarChips">
          <span class="punto-categoria" :style="{ background: colorCategoria(categoriaActual?.nombre) }" />
          {{ categoriaActual?.nombre ?? 'Sin categoría' }}
        </button>

        <div v-if="chipsExpandidos" class="chips-categoria-alternativas">
          <button
            v-for="categoria in categorias"
            :key="categoria.id"
            type="button"
            class="chip-categoria"
            :class="{ activo: categoria.id === categoriaSeleccionadaId }"
            @click="elegirCategoria(categoria.id)"
          >
            <span class="punto-categoria" :style="{ background: colorCategoria(categoria.nombre) }" />
            {{ categoria.nombre }}
          </button>
        </div>
      </div>
      <div class="dato-panel">
        <label class="etiqueta-dato-panel" :for="`banco-${borrador.id}`">Banco</label>
        <select
          :id="`banco-${borrador.id}`"
          v-model="bancoSeleccionadoId"
          class="entrada entrada-banco-panel"
          :disabled="sinBancos"
        >
          <!-- Fallback mientras el catálogo no llegó: evita que el select se vea
               vacío/roto sin perder el banco que ya trae el borrador. -->
          <option v-if="sinBancos" :value="bancoSeleccionadoId" disabled>Cargando bancos…</option>
          <option v-for="banco in storeIngresos.bancos" :key="banco.id" :value="banco.id">
            {{ banco.nombre }}
          </option>
        </select>
      </div>
    </div>

    <p v-if="errorLocal" role="alert" class="mensaje-error">{{ errorLocal }}</p>

    <div class="acciones-panel-detalle">
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

    <p class="nota-pie-panel">Al confirmar, el cargo entra a Egresos y ya no aparecerá en esta bandeja.</p>
  </section>
</template>

<style scoped>
.panel-detalle-borrador {
  background: var(--color-fondo);
  border: 1px solid var(--color-borde-tarjeta);
  border-radius: var(--radio-tarjeta);
  padding: var(--espacio-4);
  display: flex;
  flex-direction: column;
  gap: var(--espacio-3);
}

.panel-detalle-borrador--alerta {
  border-color: #f59e0b;
}

.boton-volver {
  display: none;
  align-self: flex-start;
  background: none;
  border: none;
  color: var(--color-texto-secundario);
  font-weight: 600;
  font-size: var(--tamano-pequeno);
  cursor: pointer;
  padding: 0;
  font-family: var(--fuente-base);
}

.cabecera-panel-detalle {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--espacio-3);
}

.comercio-panel-detalle {
  margin: 0;
  font-weight: 700;
  font-size: 1.05rem;
  color: var(--color-texto);
}

.fecha-hora-panel-detalle {
  margin: var(--espacio-1) 0 0;
  font-size: var(--tamano-pequeno);
  color: var(--color-texto-secundario);
}

.etiqueta-alerta {
  margin: 0;
  background: #fffbeb;
  color: #b45309;
  font-size: var(--tamano-pequeno);
  font-weight: 700;
  padding: var(--espacio-1) var(--espacio-3);
  border-radius: 999px;
  white-space: nowrap;
}

.caja-correo-original {
  background: var(--color-fondo-app);
  border-radius: var(--radio-borde);
  padding: var(--espacio-3);
}

.titulo-caja-correo {
  margin: 0 0 var(--espacio-1);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--color-texto-terciario);
}

.texto-correo-original {
  margin: 0;
  font-size: var(--tamano-pequeno);
  font-style: italic;
  color: var(--color-texto-secundario);
}

.banner-regla-comercio {
  margin: 0;
  background: var(--color-exito-fondo);
  color: var(--color-exito);
  border: 1px solid var(--color-exito);
  border-radius: var(--radio-borde);
  padding: var(--espacio-3);
  font-size: var(--tamano-pequeno);
  font-weight: 600;
}

.fila-datos-panel {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--espacio-4);
}

.dato-panel {
  display: flex;
  flex-direction: column;
  gap: var(--espacio-1);
  min-width: 0;
}

.etiqueta-dato-panel {
  margin: 0;
  font-size: var(--tamano-pequeno);
  font-weight: 600;
  color: var(--color-texto-secundario);
}

.valor-dato-panel {
  margin: 0;
  color: var(--color-texto);
  font-weight: 600;
}

.entrada-banco-panel {
  width: 100%;
  min-width: 0;
}

.valor-monto-panel {
  font-size: 22px;
  font-weight: 800;
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

.bloque-categoria-panel {
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

.acciones-panel-detalle {
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

.nota-pie-panel {
  margin: 0;
  font-size: 0.75rem;
  color: var(--color-texto-terciario);
  text-align: center;
}

@media (max-width: 900px) {
  .boton-volver {
    display: inline-flex;
  }
}
</style>
