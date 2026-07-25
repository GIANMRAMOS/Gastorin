<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import ModalCategoria from '@/components/ModalCategoria.vue'
import DialogoConfirmacion from '@/components/DialogoConfirmacion.vue'
import { useCategorias } from '@/composables/useCategorias'
import { useGastos } from '@/composables/useGastos'
import { useIngresos } from '@/composables/useIngresos'
import { useColorCategoria } from '@/composables/useColorCategoria'
import { useGastosStore } from '@/stores/gastos'
import { useIngresosStore } from '@/stores/ingresos'
import type { Categoria, TipoCategoria } from '@/types/gasto'

/**
 * Gestión de categorías (Épica 4, ampliada en Épica 12): dos secciones
 * agrupadas (predefinidas/personalizadas), cada fila con círculo de
 * color+abreviatura, nombre y el conteo de movimientos del mes actual.
 * Permite crear categorías personalizadas y editar/desactivar cualquier
 * categoría al tocar su fila. Solo lista categorías activas (la reactivación
 * no está en el backlog de esta épica).
 *
 * Desde la Épica 12 (categorías de Ingreso, migración 008), esta vista
 * gestiona AMBOS tipos vía un toggle Egresos/Ingresos: antes solo mostraba
 * `tipo === 'gasto'` de forma fija (hueco reportado tras la Fase 2 "Caudal"),
 * dejando las categorías de ingreso sin ninguna pantalla de gestión.
 */
const { cargarCategorias, desactivarCategoria } = useCategorias()
const { cargarGastos } = useGastos()
const { cargarIngresos } = useIngresos()
const { colorCategoria } = useColorCategoria()
const storeGastos = useGastosStore()
const storeIngresos = useIngresosStore()

const modalAbierto = ref(false)
const categoriaSeleccionada = ref<Categoria | null>(null)
const categoriaADesactivar = ref<Categoria | null>(null)
/** Tipo actualmente en pantalla (toggle Egresos/Ingresos). Egresos por defecto. */
const tipoSeleccionado = ref<TipoCategoria>('gasto')

onMounted(() => {
  cargarCategorias()
  cargarGastos()
  cargarIngresos()
})

const categoriasPredefinidas = computed(() =>
  storeGastos.categorias.filter(
    (c) => c.predefinida && c.activa && c.tipo === tipoSeleccionado.value,
  ),
)
const categoriasPersonalizadas = computed(() =>
  storeGastos.categorias.filter(
    (c) => !c.predefinida && c.activa && c.tipo === tipoSeleccionado.value,
  ),
)

/** Prefijo del mes actual (`YYYY-MM`) para contar los movimientos "de este mes". */
const mesActual = computed(() => new Date().toISOString().slice(0, 7))

/**
 * Cantidad de movimientos de una categoría en el mes actual: gastos si el
 * toggle está en Egresos, ingresos si está en Ingresos (cada tipo de
 * categoría solo aplica a su propio dominio, nunca se mezclan).
 */
function movimientosEsteMes(categoriaId: string): number {
  if (tipoSeleccionado.value === 'ingreso') {
    return storeIngresos.ingresos.filter(
      (ingreso) => ingreso.categoria_id === categoriaId && ingreso.fecha.slice(0, 7) === mesActual.value,
    ).length
  }
  return storeGastos.gastos.filter(
    (gasto) => gasto.categoria_id === categoriaId && gasto.fecha.slice(0, 7) === mesActual.value,
  ).length
}

/** Etiqueta de la fila, coherente con el tipo en pantalla ("gastos" vs "ingresos"). */
function etiquetaMovimientos(categoriaId: string): string {
  const cantidad = movimientosEsteMes(categoriaId)
  const sustantivo = tipoSeleccionado.value === 'ingreso' ? 'ingresos' : 'gastos'
  return `${cantidad} ${sustantivo} este mes`
}

/** Abre el modal en modo alta, en el tipo actualmente seleccionado. */
function abrirModalAlta() {
  categoriaSeleccionada.value = null
  modalAbierto.value = true
}

/** Abre el modal de detalle/edición con la categoría tocada. */
function abrirModalDetalle(categoria: Categoria) {
  categoriaSeleccionada.value = categoria
  modalAbierto.value = true
}

/** Tipo a pasarle al modal: el de la categoría en edición, o el del toggle si es alta nueva. */
const tipoParaModal = computed(() => categoriaSeleccionada.value?.tipo ?? tipoSeleccionado.value)

/** Texto de confirmación de desactivar, coherente con el tipo de la categoría. */
const mensajeDesactivar = computed(() => {
  const sustantivo = categoriaADesactivar.value?.tipo === 'ingreso' ? 'nuevos ingresos' : 'nuevos gastos'
  return `¿Seguro que quieres desactivar esta categoría? Dejará de estar disponible para ${sustantivo}.`
})

/** Cierra el modal de alta/detalle sin guardar. */
function cerrarModal() {
  modalAbierto.value = false
  categoriaSeleccionada.value = null
}

/** Tras guardar (alta o edición), cierra el modal; la lista ya se actualizó en el store. */
function manejarGuardado() {
  cerrarModal()
}

/** El formulario de detalle pidió desactivar: cierra el modal y abre la confirmación. */
function pedirConfirmacionDesactivar() {
  categoriaADesactivar.value = categoriaSeleccionada.value
  modalAbierto.value = false
}

/** Cancela la desactivación: no se cambia nada. */
function cancelarDesactivacion() {
  categoriaADesactivar.value = null
}

/** Confirma la desactivación de la categoría seleccionada. */
async function confirmarDesactivacion() {
  if (!categoriaADesactivar.value) return
  await desactivarCategoria(categoriaADesactivar.value.id)
  categoriaADesactivar.value = null
  categoriaSeleccionada.value = null
}
</script>

<template>
  <main class="pagina-categorias">
    <div class="cabecera-categorias">
      <h1>Categorías</h1>
      <button type="button" class="boton-primario boton-nuevo" @click="abrirModalAlta">
        + Nueva categoría
      </button>
    </div>

    <div class="toggle-tipo" role="tablist" aria-label="Tipo de categoría">
      <button
        type="button"
        role="tab"
        class="chip-tipo"
        :class="{ activo: tipoSeleccionado === 'gasto' }"
        :aria-selected="tipoSeleccionado === 'gasto'"
        @click="tipoSeleccionado = 'gasto'"
      >
        Egresos
      </button>
      <button
        type="button"
        role="tab"
        class="chip-tipo"
        :class="{ activo: tipoSeleccionado === 'ingreso' }"
        :aria-selected="tipoSeleccionado === 'ingreso'"
        @click="tipoSeleccionado = 'ingreso'"
      >
        Ingresos
      </button>
    </div>

    <p v-if="storeGastos.error" role="alert" class="mensaje-error">{{ storeGastos.error }}</p>

    <section class="seccion-categorias">
      <h2 class="titulo-seccion">Predefinidas</h2>
      <ul v-if="categoriasPredefinidas.length > 0" class="lista-categorias">
        <li
          v-for="categoria in categoriasPredefinidas"
          :key="categoria.id"
          class="fila-categoria"
          @click="abrirModalDetalle(categoria)"
        >
          <span class="circulo-categoria" :style="{ background: colorCategoria(categoria.nombre) }">
            {{ categoria.abreviatura }}
          </span>
          <div class="detalle-categoria">
            <p class="nombre-categoria">{{ categoria.nombre }}</p>
            <p class="contador-categoria">{{ etiquetaMovimientos(categoria.id) }}</p>
          </div>
        </li>
      </ul>
      <p v-else class="mensaje-vacio-seccion">
        Todavía no tienes categorías predefinidas de {{ tipoSeleccionado === 'ingreso' ? 'Ingreso' : 'Egreso' }}.
      </p>
    </section>

    <section class="seccion-categorias">
      <h2 class="titulo-seccion">Personalizadas</h2>
      <ul v-if="categoriasPersonalizadas.length > 0" class="lista-categorias">
        <li
          v-for="categoria in categoriasPersonalizadas"
          :key="categoria.id"
          class="fila-categoria"
          @click="abrirModalDetalle(categoria)"
        >
          <span class="circulo-categoria" :style="{ background: colorCategoria(categoria.nombre) }">
            {{ categoria.abreviatura }}
          </span>
          <div class="detalle-categoria">
            <p class="nombre-categoria">{{ categoria.nombre }}</p>
            <p class="contador-categoria">{{ etiquetaMovimientos(categoria.id) }}</p>
          </div>
        </li>
      </ul>
      <p v-else class="mensaje-vacio-seccion">
        Todavía no tienes categorías personalizadas de {{ tipoSeleccionado === 'ingreso' ? 'Ingreso' : 'Egreso' }}.
      </p>
    </section>

    <ModalCategoria
      v-if="modalAbierto"
      :categoria="categoriaSeleccionada"
      :tipo="tipoParaModal"
      @cerrar="cerrarModal"
      @guardado="manejarGuardado"
      @pedir-desactivar="pedirConfirmacionDesactivar"
    />

    <DialogoConfirmacion
      v-if="categoriaADesactivar"
      :mensaje="mensajeDesactivar"
      @confirmar="confirmarDesactivacion"
      @cancelar="cancelarDesactivacion"
    />
  </main>
</template>

<style scoped>
.pagina-categorias {
  max-width: 720px;
  margin: 0 auto;
  padding: var(--espacio-6) var(--espacio-4);
}

.cabecera-categorias {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--espacio-4);
  margin-bottom: var(--espacio-6);
}

.cabecera-categorias h1 {
  font-size: clamp(20px, 4vw, 26px);
  margin: 0;
}

.toggle-tipo {
  display: flex;
  gap: var(--espacio-2);
  margin-bottom: var(--espacio-5);
}

.chip-tipo {
  padding: var(--espacio-2) var(--espacio-4);
  border-radius: 999px;
  border: 1px solid var(--color-borde);
  background: var(--color-fondo);
  font-size: var(--tamano-pequeno);
  font-weight: 600;
  color: var(--color-texto-secundario);
  cursor: pointer;
  font-family: var(--fuente-base);
}

.chip-tipo.activo {
  border-color: var(--color-primario);
  background: #e2f4f1;
  color: #0b7a6e;
}

.boton-nuevo {
  width: auto;
  min-height: 44px;
  margin-top: 0;
  padding: 0 var(--espacio-4);
}

.seccion-categorias {
  margin-bottom: var(--espacio-6);
}

.titulo-seccion {
  font-size: var(--tamano-pequeno);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-texto-terciario);
  margin: 0 0 var(--espacio-3);
}

.lista-categorias {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--espacio-2);
}

.fila-categoria {
  display: flex;
  align-items: center;
  gap: var(--espacio-3);
  background: var(--color-fondo);
  border: 1px solid var(--color-borde-tarjeta);
  border-radius: 18px;
  padding: var(--espacio-3) var(--espacio-4);
  cursor: pointer;
}
.fila-categoria:hover {
  background: var(--color-fondo-app);
}

.circulo-categoria {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  flex-shrink: 0;
  color: #fff;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.detalle-categoria {
  flex: 1;
  min-width: 0;
}

.nombre-categoria {
  margin: 0;
  font-weight: 700;
  color: var(--color-texto);
}

.contador-categoria {
  margin: 2px 0 0;
  font-size: var(--tamano-pequeno);
  color: var(--color-texto-secundario);
}

.mensaje-vacio-seccion {
  color: var(--color-texto-secundario);
  font-size: var(--tamano-pequeno);
  margin: 0;
}
</style>
