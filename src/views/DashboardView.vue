<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import TarjetaKpi from '@/components/TarjetaKpi.vue'
import TarjetaPresupuestoResumen from '@/components/TarjetaPresupuestoResumen.vue'
import TarjetaSaldosPorCuenta from '@/components/TarjetaSaldosPorCuenta.vue'
import ModalAjusteSaldo from '@/components/ModalAjusteSaldo.vue'
import TarjetaBandejaResumen from '@/components/TarjetaBandejaResumen.vue'
import FeedMovimientos, { type MovimientoFeed } from '@/components/FeedMovimientos.vue'
import ChipsFiltroTipo from '@/components/ChipsFiltroTipo.vue'
import ListaGastoPorCategoria from '@/components/ListaGastoPorCategoria.vue'
import GraficoTendenciaMensual from '@/components/GraficoTendenciaMensual.vue'
import GraficoTendenciaDiaria from '@/components/GraficoTendenciaDiaria.vue'
import ToggleMoneda from '@/components/ToggleMoneda.vue'
import {
  useDashboard,
  cargarResumenPorMoneda,
  cargarGastoPorCategoria,
  cargarTendenciaMensual,
  cargarTendenciaDiaria,
  cargarBalancePorMoneda,
  calcularSaldoNetoPorCuenta,
  combinarMovimientosDelMes,
  proyeccionCierreMes,
  type TipoFiltroMovimiento,
} from '@/composables/useDashboard'
import { useCategorias } from '@/composables/useCategorias'
import { usePresupuestos } from '@/composables/usePresupuestos'
import { useBandeja } from '@/composables/useBandeja'
import { useAjustesSaldo } from '@/composables/useAjustesSaldo'
import { NOMBRE_BANCO_NO_ESPECIFICADO } from '@/composables/useMoneda'
import { useGastosStore } from '@/stores/gastos'
import { useIngresosStore } from '@/stores/ingresos'
import { useUiStore } from '@/stores/ui'
import type { Moneda } from '@/types/gasto'

/**
 * "Dashboard" (rediseño "Caudal", Fase 1: Shell + Dashboard): encabezado con
 * mes + toggle de moneda + "+ Registrar", 3 KPIs (Ingresos/Egresos/Balance),
 * strip "Saldo por cuenta" (BCP/IBK, ajuste de alcance posterior a la Fase 1),
 * y una grilla de 2 columnas
 * con el Historial del mes (izquierda) y Presupuesto + Bandeja (derecha) —
 * todo gobernado por el mismo selector de moneda del encabezado—; debajo se
 * conservan el gasto por categoría (HU-7.2) y las tendencias mensual
 * (HU-7.3) y diaria de los últimos 30 días (se mudarán a la sección
 * "Gráficos" en la Fase 5 del rediseño, no se borran en esta fase). Es la
 * home de la app (ruta raíz redirige aquí, ver `router/index.ts`); el name
 * de ruta sigue siendo `dashboard`.
 */
const { filas, filasIngresos, cargarDatosDashboard } = useDashboard()
const { cargarCategorias } = useCategorias()
const { cargarPresupuestos } = usePresupuestos()
const { cargarBorradores } = useBandeja()
const { ajustes: ajustesSaldo, cargarAjustesSaldo } = useAjustesSaldo()
const storeGastos = useGastosStore()
const storeIngresos = useIngresosStore()
const storeUi = useUiStore()

/** Cuenta que el usuario tocó en "Saldo por cuenta" para setear su saldo, o `null` si el modal está cerrado. */
const cuentaEnEdicion = ref<{ bancoId: string; moneda: Moneda; etiqueta: string } | null>(null)

/** Abre `ModalAjusteSaldo` para la cuenta tocada. */
function abrirAjusteSaldo(cuenta: { bancoId: string; moneda: Moneda; etiqueta: string }) {
  cuentaEnEdicion.value = cuenta
}

/** Cierra el modal de ajuste de saldo sin guardar. */
function cerrarAjusteSaldo() {
  cuentaEnEdicion.value = null
}

/**
 * Tras guardar el ajuste, cierra el modal y recarga `ajustesSaldo`: el guardado real ocurrió en
 * OTRA instancia de `useAjustesSaldo()` (la del formulario dentro de `ModalAjusteSaldo`), que
 * empujó el nuevo ajuste a SU PROPIO `ref` local — el composable no comparte estado entre
 * instancias. Sin este `cargarAjustesSaldo()`, el `ajustesSaldo` de esta vista (y por lo tanto
 * `saldosPorCuenta`, que depende de él) nunca se entera del ajuste nuevo.
 */
function manejarGuardadoAjusteSaldo() {
  cuentaEnEdicion.value = null
  cargarAjustesSaldo()
}

/** Moneda que gobierna a la vez los KPIs, el presupuesto, el feed, el gasto por categoría y las tendencias. */
const monedaSeleccionada = ref<Moneda>('PEN')

/** Filtro de tipo de movimiento del feed (chips Todos/Ingresos/Egresos). */
const tipoFiltro = ref<TipoFiltroMovimiento>('todos')

/**
 * Hidrata, además de categorías y gastos/ingresos del mes, los presupuestos
 * (Épica 6, `usePresupuestos`) y los borradores de la bandeja (Épica 5,
 * `useBandeja`): sin esto, el resumen de presupuesto y la card de bandeja
 * dependían de que el usuario hubiera visitado antes Presupuestos/Bandeja en
 * la misma sesión (mismo bug de fondo que ya se corrigió para bancos/
 * categorías en `AppShellLayout.vue`). Reutiliza los mismos composables que
 * `PresupuestosView.vue`/`BandejaView.vue`, sin reimplementar la consulta.
 */
onMounted(() => {
  cargarCategorias()
  cargarDatosDashboard()
  cargarPresupuestos()
  cargarBorradores()
  cargarAjustesSaldo()
})

/**
 * `filas`/`filasIngresos` son una copia local de `useDashboard`, no el store
 * de dominio: registrar un gasto/ingreso desde el FAB (montado en
 * `AppShellLayout`, fuera de esta vista) no las actualiza por reactividad de
 * Pinia. Sin este `watch`, los 3 KPIs, "Saldo por cuenta", el feed y las
 * tendencias quedaban desactualizados hasta navegar fuera y volver.
 */
watch(
  () => storeUi.contadorRegistro,
  () => {
    cargarDatosDashboard()
  },
)

/** Primer día del mes actual (`YYYY-MM-01`), base de las agregaciones "mes actual". */
const mesActual = computed(() => {
  const ahora = new Date()
  const anio = ahora.getFullYear()
  const mes = String(ahora.getMonth() + 1).padStart(2, '0')
  return `${anio}-${mes}-01`
})

/** Día del mes actual (1-31): base del subtítulo del encabezado y de la proyección de cierre de mes. */
const diaActual = computed(() => new Date().getDate())

/** Cantidad de días del mes actual (28-31): base del subtítulo y de la proyección de cierre de mes. */
const diasDelMes = computed(() => {
  const ahora = new Date()
  return new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0).getDate()
})

/**
 * Mes y año del encabezado ("Julio 2026"), capitalizado. Se formatea solo el
 * mes con `Intl` (en minúscula) y se concatena el año a mano: el formato
 * combinado `{month:'long', year:'numeric'}` de `Intl` en es-PE inserta un
 * "de" ("julio de 2026") que no calza con el encabezado deseado.
 */
const mesFormateado = computed(() => {
  const ahora = new Date()
  const nombreMes = new Intl.DateTimeFormat('es-PE', { month: 'long' }).format(ahora)
  return `${nombreMes.charAt(0).toUpperCase()}${nombreMes.slice(1)} ${ahora.getFullYear()}`
})

/** Subtítulo del encabezado: "día D de N · X cuentas" (X = bancos, ya hidratados por `AppShellLayout`). */
const subtitulo = computed(
  () => `día ${diaActual.value} de ${diasDelMes.value} · ${storeIngresos.bancos.length} cuentas`,
)

/** Cantidad de borradores pendientes en la bandeja, base de la card "Bandeja de correo". */
const cantidadBorradores = computed(() => storeGastos.borradores.length)

/** Primer borrador de la bandeja (el más reciente), o `null` si está al día: base del peek de la card. */
const peekBorrador = computed(() => storeGastos.borradores[0] ?? null)

/** Resumen de gasto del mes actual por moneda (PEN y USD), independiente del toggle. */
const resumenPorMoneda = computed(() => cargarResumenPorMoneda(filas.value, mesActual.value))

/**
 * Saldo neto (ingresos − gastos) de las cuentas BCP e IBK para el strip
 * "Saldo por cuenta": usa `filas`/`filasIngresos` (ventana de 6 meses ya
 * cargada por `cargarDatosDashboard`), `storeIngresos.bancos` (catálogo ya
 * hidratado por `AppShellLayout`) y `ajustesSaldo` (historial de "setear
 * saldo", migración 011) — sin fetch propio adicional. Independiente del
 * toggle de moneda del encabezado (siempre PEN + badge USD si aplica, ver
 * `calcularSaldoNetoPorCuenta`).
 */
const saldosPorCuenta = computed(() =>
  calcularSaldoNetoPorCuenta(storeIngresos.bancos, filas.value, filasIngresos.value, ajustesSaldo.value),
)

/** Balance neto (ingresos − gastos) del mes actual por moneda (PEN y USD): fuente directa de los KPIs. */
const balancePorMoneda = computed(() =>
  cargarBalancePorMoneda(filas.value, filasIngresos.value, mesActual.value),
)

/**
 * Límite total de presupuesto del mes en la moneda seleccionada: suma de
 * `storeGastos.presupuestos` (Épica 6, hidratado por `cargarPresupuestos()`
 * en el `onMounted` de esta vista) filtrados por moneda. Si el usuario no
 * tiene presupuestos configurados, queda en 0 y la tarjeta lo maneja sin
 * dividir por cero (mismo criterio que `TarjetaPresupuesto`).
 */
const presupuestoLimite = computed(() =>
  storeGastos.presupuestos
    .filter((presupuesto) => presupuesto.moneda === monedaSeleccionada.value)
    .reduce((total, presupuesto) => total + presupuesto.monto_limite, 0),
)

/** Gastado del mes en la moneda seleccionada (reutiliza el mismo total ya calculado para los KPIs). */
const presupuestoGastado = computed(() => resumenPorMoneda.value[monedaSeleccionada.value].total)

/** Proyección de cierre de mes a partir de lo gastado hasta hoy, extrapolado linealmente. */
const presupuestoProyeccion = computed(() =>
  proyeccionCierreMes(presupuestoGastado.value, diaActual.value, diasDelMes.value),
)

/** Gasto por categoría del mes actual en la moneda seleccionada, con nombre resuelto desde el store (ya viene ordenado de mayor a menor, ver `cargarGastoPorCategoria`). */
const gastoPorCategoria = computed(() => {
  const totales = cargarGastoPorCategoria(filas.value, mesActual.value, monedaSeleccionada.value)
  return totales.map((item) => {
    const categoria = storeGastos.categorias.find((c) => c.id === item.categoria_id)
    return { categoria_id: item.categoria_id, nombre: categoria?.nombre ?? 'Categoría', total: item.total }
  })
})

/** Top-3 categorías de gasto del mes (mismo orden desc de `gastoPorCategoria`), para las mini-barras de `TarjetaPresupuestoResumen`. */
const topCategorias = computed(() =>
  gastoPorCategoria.value.slice(0, 3).map(({ nombre, total }) => ({ nombre, total })),
)

/** Tendencia de los últimos 6 meses en la moneda seleccionada. */
const tendenciaMensual = computed(() => cargarTendenciaMensual(filas.value, monedaSeleccionada.value))

/** Tendencia de los últimos 30 días en la moneda seleccionada (misma ventana de `filas`, sin fetch nuevo). */
const tendenciaDiaria = computed(() => cargarTendenciaDiaria(filas.value, monedaSeleccionada.value))

/** Movimientos del mes en la moneda y tipo seleccionados (chips), sin tope: el feed muestra TODO el mes. */
const movimientosDelMes = computed(() =>
  combinarMovimientosDelMes(
    filas.value,
    filasIngresos.value,
    mesActual.value,
    monedaSeleccionada.value,
    tipoFiltro.value,
  ),
)

/**
 * Feed enriquecido con el nombre de categoría (solo en gastos: un ingreso
 * nunca tiene `categoriaId`) y el nombre de banco, resueltos contra
 * `storeGastos.categorias`/`storeIngresos.bancos`.
 */
const movimientosEnriquecidos = computed<MovimientoFeed[]>(() =>
  movimientosDelMes.value.map((movimiento) => ({
    ...movimiento,
    nombreCategoria: movimiento.categoriaId
      ? storeGastos.categorias.find((c) => c.id === movimiento.categoriaId)?.nombre ?? 'Categoría'
      : null,
    nombreBanco:
      storeIngresos.bancos.find((banco) => banco.id === movimiento.bancoId)?.nombre ??
      NOMBRE_BANCO_NO_ESPECIFICADO,
  })),
)
</script>

<template>
  <main class="pagina-inicio">
    <header class="encabezado-inicio">
      <div class="titulo-encabezado">
        <h1>{{ mesFormateado }}</h1>
        <p class="subtitulo-encabezado">{{ subtitulo }}</p>
      </div>
      <div class="acciones-encabezado">
        <ToggleMoneda v-model="monedaSeleccionada" mostrar-simbolo />
        <button type="button" class="boton-registrar" @click="storeUi.abrirHojaAcciones()">
          + Registrar
        </button>
      </div>
    </header>

    <p v-if="storeGastos.error" role="alert" class="mensaje-error">{{ storeGastos.error }}</p>

    <div class="fila-kpis">
      <TarjetaKpi
        label="Ingresos"
        :monto="balancePorMoneda[monedaSeleccionada].ingresos"
        :moneda="monedaSeleccionada"
        variante="ingreso"
      />
      <TarjetaKpi
        label="Egresos"
        :monto="balancePorMoneda[monedaSeleccionada].gastos"
        :moneda="monedaSeleccionada"
        variante="egreso"
      />
      <TarjetaKpi
        label="Balance"
        :monto="balancePorMoneda[monedaSeleccionada].balance"
        :moneda="monedaSeleccionada"
        variante="balance"
        mostrar-signo
      />
    </div>

    <TarjetaSaldosPorCuenta :cuentas="saldosPorCuenta" @editar-cuenta="abrirAjusteSaldo" />

    <ModalAjusteSaldo
      v-if="cuentaEnEdicion"
      :banco-id="cuentaEnEdicion.bancoId"
      :moneda="cuentaEnEdicion.moneda"
      :etiqueta="cuentaEnEdicion.etiqueta"
      @cerrar="cerrarAjusteSaldo"
      @guardado="manejarGuardadoAjusteSaldo"
    />

    <div class="grid-inicio">
      <section class="columna-historial">
        <div class="cabecera-seccion-feed">
          <h2>Historial</h2>
          <ChipsFiltroTipo v-model="tipoFiltro" />
        </div>
        <FeedMovimientos :movimientos="movimientosEnriquecidos" />
      </section>

      <div class="columna-lateral-inicio">
        <TarjetaPresupuestoResumen
          :gastado="presupuestoGastado"
          :limite="presupuestoLimite"
          :proyeccion="presupuestoProyeccion"
          :moneda="monedaSeleccionada"
          :top-categorias="topCategorias"
        />

        <TarjetaBandejaResumen :cantidad="cantidadBorradores" :peek="peekBorrador" />
      </div>
    </div>

    <section class="seccion-dashboard">
      <h2>Gasto por categoría</h2>
      <ListaGastoPorCategoria :items="gastoPorCategoria" :moneda="monedaSeleccionada" />
    </section>

    <!-- Se muda a la sección "Gráficos" en la Fase 5 del rediseño "Caudal"; se conserva aquí hasta entonces. -->
    <section class="seccion-dashboard">
      <h2>Tendencia mensual</h2>
      <GraficoTendenciaMensual :datos="tendenciaMensual" :moneda="monedaSeleccionada" />
    </section>

    <section class="seccion-dashboard">
      <h2>Tendencia diaria</h2>
      <GraficoTendenciaDiaria :datos="tendenciaDiaria" :moneda="monedaSeleccionada" />
    </section>
  </main>
</template>

<style scoped>
.pagina-inicio {
  max-width: 1080px;
  margin: 0 auto;
  padding: var(--espacio-6) var(--espacio-4);
}

.encabezado-inicio {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--espacio-4);
  margin-bottom: var(--espacio-6);
}

.titulo-encabezado h1 {
  margin: 0;
  font-weight: 600;
  font-size: 21px;
  letter-spacing: -0.02em;
}

.subtitulo-encabezado {
  margin: var(--espacio-1) 0 0;
  font-weight: 400;
  font-size: 12.5px;
  color: rgba(0, 0, 0, 0.5);
}

.acciones-encabezado {
  display: flex;
  align-items: center;
  gap: var(--espacio-3);
  flex-shrink: 0;
}

.boton-registrar {
  min-height: 40px;
  padding: 0 var(--espacio-4);
  background: #1a1a18;
  color: #fff;
  border: none;
  border-radius: 9px;
  font-weight: 600;
  font-size: var(--tamano-pequeno);
  cursor: pointer;
  font-family: var(--fuente-base);
}
.boton-registrar:hover {
  background: var(--color-primario-hover);
}

.mensaje-error {
  margin-bottom: var(--espacio-4);
}

.fila-kpis {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-bottom: var(--espacio-4);
}

.grid-inicio {
  display: grid;
  grid-template-columns: 1.55fr 1fr;
  gap: 16px;
  align-items: start;
  margin: var(--espacio-4) 0;
}

.columna-historial {
  background: var(--color-fondo);
  border: 1px solid var(--color-borde-tarjeta);
  border-radius: var(--radio-tarjeta);
  padding: var(--espacio-4);
}

.columna-lateral-inicio {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cabecera-seccion-feed {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--espacio-3);
  margin-bottom: var(--espacio-4);
}

.cabecera-seccion-feed h2 {
  margin: 0;
  font-size: 1rem;
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

@media (max-width: 900px) {
  .fila-kpis {
    grid-template-columns: 1fr;
  }

  .grid-inicio {
    grid-template-columns: 1fr;
  }
}
</style>
