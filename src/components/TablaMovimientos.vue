<script setup lang="ts">
import { computed } from 'vue'
import { useMoneda } from '@/composables/useMoneda'
import type { Moneda } from '@/types/gasto'

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
  <div class="tabla-movimientos-envoltorio">
    <table class="tabla-movimientos">
      <thead>
        <tr>
          <th scope="col">Fecha</th>
          <th scope="col">Descripción</th>
          <th scope="col">Categoría</th>
          <th scope="col">Banco</th>
          <th scope="col" class="columna-monto">Monto</th>
          <th scope="col" class="columna-acciones">
            <span class="sr-only">Acciones</span>
          </th>
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
          <td data-etiqueta="Acciones" class="columna-acciones celda-acciones">
            <button type="button" class="boton-fila boton-editar" @click="emit('editar', fila.id)">
              Editar
            </button>
            <button
              type="button"
              class="boton-fila boton-eliminar"
              aria-label="Eliminar movimiento"
              @click="emit('eliminar', fila.id)"
            >
              ×
            </button>
          </td>
        </tr>
      </tbody>
      <tfoot v-if="filas.length > 0">
        <tr class="fila-totales">
          <td :colspan="4" data-etiqueta="Total">
            {{ filas.length }} de {{ totalSinFiltrar }} movimientos
          </td>
          <td colspan="2" class="columna-monto celda-monto-total">
            <span v-for="(item, indice) in totalesPorMoneda" :key="item.moneda">
              <template v-if="indice > 0"> + </template>{{ formatearMonto(item.total, item.moneda) }}
            </span>
          </td>
        </tr>
      </tfoot>
    </table>
  </div>
</template>

<style scoped>
.tabla-movimientos-envoltorio {
  width: 100%;
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

.tabla-movimientos .columna-acciones {
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

.celda-acciones {
  white-space: nowrap;
}

.boton-fila {
  background: none;
  border: none;
  cursor: pointer;
  font-family: var(--fuente-base);
  font-size: var(--tamano-pequeno);
  color: var(--color-texto-secundario);
  padding: var(--espacio-1) var(--espacio-2);
}
.boton-editar {
  font-weight: 600;
}
.boton-editar:hover {
  color: var(--color-texto);
}
.boton-eliminar {
  font-size: 1.1rem;
  line-height: 1;
  color: var(--color-error, #c0392b);
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

/* Responsive (~375px): la tabla colapsa a tarjetas apiladas "etiqueta: valor",
   sin scroll horizontal del body (el `overflow-x: auto` del envoltorio deja
   de ser necesario porque ya no hay una fila ancha que desbordar). */
@media (max-width: 640px) {
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

  .celda-acciones {
    justify-content: flex-end;
  }
  .celda-acciones::before {
    content: none;
  }

  .fila-totales td {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
}
</style>
