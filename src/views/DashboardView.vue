<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import TarjetaResumenMoneda from '@/components/TarjetaResumenMoneda.vue'
import TarjetaBalanceMoneda from '@/components/TarjetaBalanceMoneda.vue'
import ListaGastoPorCategoria from '@/components/ListaGastoPorCategoria.vue'
import GraficoTendenciaMensual from '@/components/GraficoTendenciaMensual.vue'
import ToggleMoneda from '@/components/ToggleMoneda.vue'
import {
  useDashboard,
  cargarResumenPorMoneda,
  cargarGastoPorCategoria,
  cargarTendenciaMensual,
  cargarBalancePorMoneda,
} from '@/composables/useDashboard'
import { useCategorias } from '@/composables/useCategorias'
import { useGastosStore } from '@/stores/gastos'
import type { Moneda } from '@/types/gasto'

/**
 * Dashboard (Épica 7): resumen del mes por moneda (HU-7.1, siempre ambas
 * monedas), gasto por categoría (HU-7.2), tendencia mensual (HU-7.3) —estas
 * dos últimas gobernadas por un único `ToggleMoneda` compartido— y balance
 * neto por moneda (Épica 11, HU-11.4). Es la nueva home de la app (ruta raíz
 * redirige aquí, ver `router/index.ts`).
 */
const { filas, filasIngresos, cargarDatosDashboard } = useDashboard()
const { cargarCategorias } = useCategorias()
const store = useGastosStore()

/** Moneda que gobiernan a la vez el gasto por categoría y la tendencia mensual. */
const monedaSeleccionada = ref<Moneda>('PEN')

onMounted(() => {
  cargarCategorias()
  cargarDatosDashboard()
})

/** Primer día del mes actual (`YYYY-MM-01`), base de las agregaciones "mes actual". */
const mesActual = computed(() => {
  const ahora = new Date()
  const anio = ahora.getFullYear()
  const mes = String(ahora.getMonth() + 1).padStart(2, '0')
  return `${anio}-${mes}-01`
})

/** Resumen de gasto del mes actual por moneda (PEN y USD), independiente del toggle. */
const resumenPorMoneda = computed(() => cargarResumenPorMoneda(filas.value, mesActual.value))

/** Balance neto (ingresos − gastos) del mes actual por moneda (PEN y USD). */
const balancePorMoneda = computed(() =>
  cargarBalancePorMoneda(filas.value, filasIngresos.value, mesActual.value),
)

/** Gasto por categoría del mes actual en la moneda seleccionada, con nombre resuelto desde el store. */
const gastoPorCategoria = computed(() => {
  const totales = cargarGastoPorCategoria(filas.value, mesActual.value, monedaSeleccionada.value)
  return totales.map((item) => {
    const categoria = store.categorias.find((c) => c.id === item.categoria_id)
    return { categoria_id: item.categoria_id, nombre: categoria?.nombre ?? 'Categoría', total: item.total }
  })
})

/** Tendencia de los últimos 6 meses en la moneda seleccionada. */
const tendenciaMensual = computed(() => cargarTendenciaMensual(filas.value, monedaSeleccionada.value))
</script>

<template>
  <main class="pagina-dashboard">
    <h1>Dashboard</h1>

    <p v-if="store.error" role="alert" class="mensaje-error">{{ store.error }}</p>

    <section class="seccion-resumen" aria-label="Gastado este mes">
      <TarjetaResumenMoneda
        moneda="PEN"
        etiqueta="Gastado este mes"
        :total="resumenPorMoneda.PEN.total"
        :variacion-pct="resumenPorMoneda.PEN.variacionPct"
      />
      <TarjetaResumenMoneda
        moneda="USD"
        etiqueta="Gastado este mes"
        :total="resumenPorMoneda.USD.total"
        :variacion-pct="resumenPorMoneda.USD.variacionPct"
      />
    </section>

    <section class="seccion-resumen" aria-label="Ingresos este mes">
      <TarjetaResumenMoneda
        moneda="PEN"
        etiqueta="Ingresos este mes"
        :total="balancePorMoneda.PEN.ingresos"
        :variacion-pct="null"
      />
      <TarjetaResumenMoneda
        moneda="USD"
        etiqueta="Ingresos este mes"
        :total="balancePorMoneda.USD.ingresos"
        :variacion-pct="null"
      />
    </section>

    <section class="seccion-resumen" aria-label="Balance este mes">
      <TarjetaBalanceMoneda
        moneda="PEN"
        :ingresos="balancePorMoneda.PEN.ingresos"
        :gastos="balancePorMoneda.PEN.gastos"
        :balance="balancePorMoneda.PEN.balance"
      />
      <TarjetaBalanceMoneda
        moneda="USD"
        :ingresos="balancePorMoneda.USD.ingresos"
        :gastos="balancePorMoneda.USD.gastos"
        :balance="balancePorMoneda.USD.balance"
      />
    </section>

    <div class="selector-moneda-dashboard">
      <ToggleMoneda v-model="monedaSeleccionada" />
    </div>

    <section class="seccion-dashboard">
      <h2>Gasto por categoría</h2>
      <ListaGastoPorCategoria :items="gastoPorCategoria" :moneda="monedaSeleccionada" />
    </section>

    <section class="seccion-dashboard">
      <h2>Tendencia mensual</h2>
      <GraficoTendenciaMensual :datos="tendenciaMensual" :moneda="monedaSeleccionada" />
    </section>
  </main>
</template>

<style scoped>
.pagina-dashboard {
  max-width: 720px;
  margin: 0 auto;
  padding: var(--espacio-6) var(--espacio-4);
}

.pagina-dashboard h1 {
  font-size: clamp(20px, 4vw, 26px);
  margin: 0 0 var(--espacio-6);
}

.seccion-resumen {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--espacio-3);
  margin-bottom: var(--espacio-6);
}

.selector-moneda-dashboard {
  display: flex;
  justify-content: flex-end;
  margin-bottom: var(--espacio-4);
}

.seccion-dashboard {
  background: var(--color-fondo);
  border: 1px solid var(--color-borde-tarjeta);
  border-radius: var(--radio-tarjeta);
  padding: var(--espacio-4);
  margin-bottom: var(--espacio-4);
}

.seccion-dashboard h2 {
  margin: 0 0 var(--espacio-4);
  font-size: 1rem;
}
</style>
