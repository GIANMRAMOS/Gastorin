<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useMoneda } from '@/composables/useMoneda'
import type { Moneda } from '@/types/gasto'
import AccionesFila from '@/components/AccionesFila.vue'

/** Fila ya enriquecida (nombres resueltos, no ids crudos) de un movimiento. */
export interface FilaMovimiento {
  id: string
  fecha: string
  descripcion: string
  nombreCategoria: string
  nombreBanco: string
  monto: number
  moneda: Moneda
}

/**
 * Tabla presentacional pura de movimientos (Fase 2 "Caudal"), compartida por
 * Egresos (`HistorialView`) e Ingresos (`IngresosView`): reemplaza a la
 * lista-de-tarjetas agrupada por día. Columnas Fecha | Descripción |
 * Categoría | Banco | Monto, con fila de totales al pie ("N de N
 * movimientos" + total por moneda de las filas mostradas). No calcula el
 * filtrado ni el orden: `filas` ya viene lista para pintar, en el orden en
 * que debe mostrarse.
 *
 * El control de acciones ("⋮" Editar/Eliminar) vive FUERA del área con
 * scroll horizontal (`.envoltorio-datos`), en un carril lateral fijo
 * (`.carril-acciones`), para que nunca quede tapado por ni tape a la columna
 * Monto sin importar el `scrollLeft`. En mobile (donde no hay scroll
 * horizontal, la tabla colapsa a tarjetas) el control vuelve a vivir dentro
 * de cada `<tr>` como una celda más.
 */
const props = defineProps<{
  filas: FilaMovimiento[]
  /** Total de movimientos SIN filtrar (para el "N de N" del pie, ej. "3 de 10 movimientos"). */
  totalSinFiltrar: number
}>()

const emit = defineEmits<{
  editar: [string]
  eliminar: [string]
}>()

const { formatearMonto } = useMoneda()

/** Id de la fila cuyo menú "⋮" (Editar/Eliminar) está abierto; solo una fila a la vez. */
const filaMenuAbiertoId = ref<string | null>(null)

/** Abre el menú de la fila indicada, o lo cierra si ya estaba abierto (toggle). */
function alternarMenu(id: string) {
  filaMenuAbiertoId.value = filaMenuAbiertoId.value === id ? null : id
}

function cerrarMenu() {
  filaMenuAbiertoId.value = null
}

function seleccionarEditar(id: string) {
  emit('editar', id)
  cerrarMenu()
}

function seleccionarEliminar(id: string) {
  emit('eliminar', id)
  cerrarMenu()
}

/**
 * Cierra el menú si el clic ocurrió fuera de la celda de Acciones que lo tiene
 * abierto. Se escucha en `mousedown` (no `click`) para que dispare ANTES del
 * `click` del ítem del menú y no le gane la carrera cerrando el menú justo
 * antes de procesar la selección.
 */
function manejarClicFuera(evento: MouseEvent) {
  if (filaMenuAbiertoId.value === null) return
  const objetivo = evento.target as HTMLElement
  const celdaDelMenuAbierto = objetivo.closest(
    `.celda-acciones[data-fila-id="${filaMenuAbiertoId.value}"]`,
  )
  if (!celdaDelMenuAbierto) cerrarMenu()
}

function manejarTeclaEscape(evento: KeyboardEvent) {
  if (evento.key === 'Escape') cerrarMenu()
}

/**
 * `true` por debajo de 640px, donde la tabla colapsa a tarjetas apiladas y el
 * carril lateral de acciones no tiene sentido (no hay scroll horizontal que
 * separar, y un carril no puede alinearse con tarjetas de altura variable).
 * Reactivo vía `matchMedia`, con el mismo patrón de listener en mount/unmount
 * que `manejarClicFuera`/`manejarTeclaEscape`. Si el entorno no soporta
 * `matchMedia` (p. ej. jsdom en los tests), se asume escritorio (carril).
 */
const esMovil = ref(false)
let listaMediaMovil: MediaQueryList | null = null

function actualizarEsMovil(evento: MediaQueryList | MediaQueryListEvent) {
  esMovil.value = evento.matches
}

onMounted(() => {
  document.addEventListener('mousedown', manejarClicFuera)
  document.addEventListener('keydown', manejarTeclaEscape)

  if (typeof window.matchMedia === 'function') {
    listaMediaMovil = window.matchMedia('(max-width: 640px)')
    actualizarEsMovil(listaMediaMovil)
    listaMediaMovil.addEventListener('change', actualizarEsMovil)
  }
})

onUnmounted(() => {
  document.removeEventListener('mousedown', manejarClicFuera)
  document.removeEventListener('keydown', manejarTeclaEscape)
  listaMediaMovil?.removeEventListener('change', actualizarEsMovil)
})

/** Total por moneda de las filas MOSTRADAS (ya filtradas), en el orden PEN → USD. */
const totalesPorMoneda = computed(() => {
  const acumulado: Partial<Record<Moneda, number>> = {}
  for (const fila of props.filas) {
    acumulado[fila.moneda] = (acumulado[fila.moneda] ?? 0) + fila.monto
  }
  const monedas: Moneda[] = ['PEN', 'USD']
  return monedas
    .filter((moneda) => acumulado[moneda] !== undefined)
    .map((moneda) => ({ moneda, total: acumulado[moneda]! }))
})
</script>

<template>
  <div class="tabla-con-acciones">
    <div class="envoltorio-datos">
      <table class="tabla-movimientos">
        <thead>
          <tr>
            <th scope="col">Fecha</th>
            <th scope="col">Descripción</th>
            <th scope="col">Categoría</th>
            <th scope="col">Banco</th>
            <th scope="col" class="columna-monto">Monto</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="fila in filas" :key="fila.id" class="fila-movimiento">
            <td data-etiqueta="Fecha">{{ fila.fecha }}</td>
            <td data-etiqueta="Descripción" class="celda-descripcion">{{ fila.descripcion }}</td>
            <td data-etiqueta="Categoría">{{ fila.nombreCategoria }}</td>
            <td data-etiqueta="Banco">{{ fila.nombreBanco }}</td>
            <td data-etiqueta="Monto" class="columna-monto celda-monto">
              {{ formatearMonto(fila.monto, fila.moneda) }}
            </td>
            <td v-if="esMovil" data-etiqueta="Acciones" class="celda-acciones-envoltorio-movil">
              <AccionesFila
                :fila-id="fila.id"
                :abierto="filaMenuAbiertoId === fila.id"
                @alternar="alternarMenu"
                @editar="seleccionarEditar"
                @eliminar="seleccionarEliminar"
              />
            </td>
          </tr>
        </tbody>
        <tfoot v-if="filas.length > 0">
          <tr class="fila-totales">
            <td :colspan="4" data-etiqueta="Total">
              {{ filas.length }} de {{ totalSinFiltrar }} movimientos
            </td>
            <td class="columna-monto celda-monto-total">
              <span v-for="(item, indice) in totalesPorMoneda" :key="item.moneda">
                <template v-if="indice > 0"> + </template>{{ formatearMonto(item.total, item.moneda) }}
              </span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Carril lateral de acciones (escritorio): vive fuera de `.envoltorio-datos`
         (que es el único que tiene `overflow-x`), así que el control "⋮" nunca
         puede quedar tapado ni tapar contenido al hacer scroll horizontal. -->
    <div v-if="!esMovil" class="carril-acciones">
      <div class="carril-acciones-cabecera">
        <span class="sr-only">Acciones</span>
      </div>
      <div v-for="fila in filas" :key="fila.id" class="carril-acciones-fila">
        <AccionesFila
          :fila-id="fila.id"
          :abierto="filaMenuAbiertoId === fila.id"
          :etiqueta-fila="fila.descripcion"
          @alternar="alternarMenu"
          @editar="seleccionarEditar"
          @eliminar="seleccionarEliminar"
        />
      </div>
      <!-- Espaciador sin contenido: solo iguala la altura del `<tfoot>` para
           que el borde derecho del carril cierre parejo con la tabla. -->
      <div v-if="filas.length > 0" class="carril-acciones-pie"></div>
    </div>
  </div>
</template>

<style scoped>
/* Altura de línea de texto compartida entre la tabla de datos y el carril de
   acciones: se usa para dar altura a las celdas del carril que no tienen
   contenido visible propio (cabecera sr-only, espaciador del pie), donde no
   hay una caja de línea real que dicte su altura por sí sola. */
.tabla-con-acciones {
  --altura-linea-texto: calc(var(--tamano-pequeno) * var(--interlineado));
  display: flex;
  width: 100%;
}

.envoltorio-datos {
  flex: 1 1 auto;
  min-width: 0;
  overflow-x: auto;
}

.tabla-movimientos {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--tamano-pequeno);
}

.tabla-movimientos thead th {
  text-align: left;
  padding: var(--espacio-2) var(--espacio-3);
  font-weight: 600;
  color: var(--color-texto-secundario);
  border-bottom: 1px solid var(--color-borde-tarjeta);
  white-space: nowrap;
}

.tabla-movimientos .columna-monto {
  text-align: right;
}

.fila-movimiento td {
  padding: var(--espacio-3);
  border-bottom: 1px solid var(--color-borde-tarjeta);
  color: var(--color-texto);
  vertical-align: middle;
}

.celda-descripcion {
  font-weight: 600;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.celda-monto {
  font-weight: 700;
  white-space: nowrap;
}

.fila-totales td {
  padding: var(--espacio-3);
  font-weight: 700;
  color: var(--color-texto);
  border-top: 2px solid var(--color-borde-tarjeta);
  border-bottom: none;
}

.celda-monto-total {
  white-space: nowrap;
}

/* Carril lateral de acciones: ancho fijo, fuera del `overflow-x` del
   envoltorio de datos, sin scroll propio. */
.carril-acciones {
  flex: 0 0 56px;
  width: 56px;
  display: flex;
  flex-direction: column;
}

.carril-acciones-cabecera {
  /* Mismo box-model que `thead th` (padding + border-bottom) más una altura
     de línea explícita, ya que su único contenido es un `<span class="sr-only">`
     fuera del flujo (`position: absolute`) y por sí solo no generaría caja de línea. */
  padding: var(--espacio-2) var(--espacio-3);
  min-height: var(--altura-linea-texto);
  border-bottom: 1px solid var(--color-borde-tarjeta);
  box-sizing: content-box;
}

.carril-acciones-fila {
  /* Mismo padding y border-bottom que `.fila-movimiento td`, para que cada
     fila del carril alinee verticalmente con su fila de datos correspondiente. */
  padding: var(--espacio-3);
  border-bottom: 1px solid var(--color-borde-tarjeta);
  display: flex;
  align-items: center;
  justify-content: center;
}

.carril-acciones-pie {
  /* Espaciador vacío que iguala la altura del `<tfoot>` (`.fila-totales td`:
     mismo padding, mismo grosor de borde superior, sin borde inferior). */
  padding: var(--espacio-3);
  min-height: var(--altura-linea-texto);
  border-top: 2px solid var(--color-borde-tarjeta);
  box-sizing: content-box;
}

/* Responsive (~375px): la tabla colapsa a tarjetas apiladas "etiqueta: valor",
   sin scroll horizontal del body (el `overflow-x: auto` del envoltorio deja
   de ser necesario porque ya no hay una fila ancha que desbordar). En este
   punto de quiebre `esMovil` es `true`: el carril lateral no se renderiza y
   las acciones vuelven a vivir dentro de cada `<tr>` como una celda más. */
@media (max-width: 640px) {
  .tabla-con-acciones {
    display: block;
  }

  .envoltorio-datos {
    overflow-x: visible;
  }

  .tabla-movimientos thead {
    display: none;
  }

  .tabla-movimientos,
  .tabla-movimientos tbody,
  .tabla-movimientos tfoot,
  .fila-movimiento,
  .fila-totales {
    display: block;
    width: 100%;
  }

  .fila-movimiento {
    padding: var(--espacio-3) 0;
    border-bottom: 1px solid var(--color-borde-tarjeta);
  }

  .fila-movimiento td {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--espacio-3);
    padding: 2px var(--espacio-1);
    border-bottom: none;
    text-align: right;
    max-width: none;
    white-space: normal;
  }

  .fila-movimiento td::before {
    content: attr(data-etiqueta);
    font-weight: 600;
    color: var(--color-texto-secundario);
    text-align: left;
    margin-right: var(--espacio-3);
  }

  .celda-acciones-envoltorio-movil {
    justify-content: flex-end;
  }
  .celda-acciones-envoltorio-movil::before {
    content: none;
  }

  .fila-totales td {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
}
</style>
