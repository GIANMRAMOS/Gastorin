<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import FilaBorrador from '@/components/FilaBorrador.vue'
import PanelDetalleBorrador from '@/components/PanelDetalleBorrador.vue'
import { calcularPosiblesDuplicados, useBandeja } from '@/composables/useBandeja'
import { useBancos } from '@/composables/useBancos'
import { useCategorias } from '@/composables/useCategorias'
import { useGastosStore } from '@/stores/gastos'
import { useIngresosStore } from '@/stores/ingresos'

/**
 * Bandeja de borradores (HU-5.2), maestro-detalle (rediseño "Caudal", Fase
 * 3): banner con el total, lista de filas a la izquierda y panel de detalle
 * a la derecha (mismo grid + breakpoint 900px de `HistorialView.vue`).
 * Debajo de 900px, el detalle se abre como una vista de pantalla completa al
 * tocar una fila, con un botón "Volver a la lista" (ver `PanelDetalleBorrador`).
 */
const { cargarBorradores, cargarEstadoIngesta } = useBandeja()
const { cargarCategorias } = useCategorias()
const { cargarBancos } = useBancos()
const storeGastos = useGastosStore()
const storeIngresos = useIngresosStore()

/** Marca de tiempo (ISO) de la última ejecución de la ingesta automática (HU-5.5). */
const ultimaEjecucion = ref<string | null>(null)

/** Id del borrador actualmente abierto en el panel de detalle (`null` = ninguno seleccionado). */
const idSeleccionado = ref<string | null>(null)

onMounted(async () => {
  cargarCategorias()
  cargarBancos()
  cargarBorradores()
  ultimaEjecucion.value = await cargarEstadoIngesta()
})

/** Categorías activas: únicas ofrecidas para reasignar un borrador. */
const categoriasActivas = computed(() => storeGastos.categorias.filter((c) => c.activa))

const cantidadBorradores = computed(() => storeGastos.borradores.length)
const bandejaAlDia = computed(() => !storeGastos.cargando && cantidadBorradores.value === 0)

/** El borrador actualmente seleccionado (o `null` si no hay ninguno / ya salió de la bandeja). */
const borradorSeleccionado = computed(
  () => storeGastos.borradores.find((b) => b.id === idSeleccionado.value) ?? null,
)

/** HU-14.2: ids de borradores que podrían ser un cargo duplicado entre sí. */
const posiblesDuplicados = computed(() => calcularPosiblesDuplicados(storeGastos.borradores))

/** Nombre del banco de un borrador (el borrador solo trae `banco_id`). */
function nombreBanco(bancoId: string): string {
  return storeIngresos.bancos.find((banco) => banco.id === bancoId)?.nombre ?? 'Sin banco'
}

/** Abre el panel de detalle con el borrador elegido de la lista. */
function seleccionarBorrador(id: string) {
  idSeleccionado.value = id
}

/** Cierra el panel de detalle (botón "Volver" en móvil, o tras confirmar/descartar con éxito). */
function cerrarDetalle() {
  idSeleccionado.value = null
}

/** Umbral (HU-5.5): más de 48h desde la última ejecución dispara la advertencia. */
const UMBRAL_ADVERTENCIA_MS = 48 * 60 * 60 * 1000

/** true si hay ejecución registrada y pasaron más de 48h desde entonces. */
const ingestaAtrasada = computed(() => {
  if (!ultimaEjecucion.value) return false
  return Date.now() - new Date(ultimaEjecucion.value).getTime() > UMBRAL_ADVERTENCIA_MS
})

/** Texto del estado de la ingesta automática para los 3 casos de HU-5.5. */
const textoEstadoIngesta = computed(() => {
  if (!ultimaEjecucion.value) {
    return 'Aún no se ha ejecutado la revisión automática'
  }
  const fechaFormateada = new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(ultimaEjecucion.value))
  return `Última revisión: ${fechaFormateada}`
})
</script>

<template>
  <main class="pagina-bandeja">
    <h1>Bandeja</h1>

    <p v-if="storeGastos.error" role="alert" class="mensaje-error">{{ storeGastos.error }}</p>

    <p class="estado-ingesta" :class="{ 'estado-ingesta--alerta': ingestaAtrasada }">
      {{ textoEstadoIngesta }}
    </p>

    <p v-if="cantidadBorradores > 0" class="banner-bandeja">
      {{ cantidadBorradores }} {{ cantidadBorradores === 1 ? 'gasto' : 'gastos' }} por confirmar
    </p>

    <div
      v-if="cantidadBorradores > 0"
      class="grid-bandeja"
      :class="{ 'grid-bandeja--detalle-abierto': idSeleccionado !== null }"
    >
      <ul class="lista-bandeja">
        <FilaBorrador
          v-for="borrador in storeGastos.borradores"
          :key="borrador.id"
          :borrador="borrador"
          :nombre-banco="nombreBanco(borrador.banco_id)"
          :seleccionado="borrador.id === idSeleccionado"
          :es-duplicado="posiblesDuplicados.has(borrador.id)"
          @seleccionar="seleccionarBorrador"
        />
      </ul>

      <div class="panel-lateral-bandeja">
        <PanelDetalleBorrador
          v-if="borradorSeleccionado"
          :key="borradorSeleccionado.id"
          :borrador="borradorSeleccionado"
          :categorias="categoriasActivas"
          @cerrar="cerrarDetalle"
        />
        <div v-else class="estado-vacio-detalle">
          <p class="mensaje-vacio">Selecciona un cargo</p>
          <p class="sugerencia-vacio">Elige un cargo de la lista para ver el detalle y confirmarlo.</p>
        </div>
      </div>
    </div>

    <div v-else-if="bandejaAlDia" class="estado-vacio">
      <span class="icono-vacio" aria-hidden="true">✓</span>
      <p class="mensaje-vacio">Bandeja al día</p>
      <p class="sugerencia-vacio">No hay gastos por confirmar por ahora.</p>
    </div>
  </main>
</template>

<style scoped>
.pagina-bandeja {
  max-width: 1080px;
  margin: 0 auto;
  padding: var(--espacio-6) var(--espacio-4);
}

.pagina-bandeja h1 {
  font-size: clamp(20px, 4vw, 26px);
  margin: 0 0 var(--espacio-4);
}

.banner-bandeja {
  background: #e2f4f1;
  color: #0b7a6e;
  font-weight: 700;
  padding: var(--espacio-3) var(--espacio-4);
  border-radius: var(--radio-borde);
  margin-bottom: var(--espacio-4);
}

/* Estado de la última ejecución de la ingesta automática (HU-5.5). */
.estado-ingesta {
  background: var(--color-fondo-app);
  color: var(--color-texto-secundario);
  font-size: var(--tamano-pequeno);
  padding: var(--espacio-3) var(--espacio-4);
  border-radius: var(--radio-borde);
  margin: 0 0 var(--espacio-4);
}

.estado-ingesta--alerta {
  background: var(--color-advertencia-fondo);
  color: var(--color-advertencia);
}

.grid-bandeja {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 16px;
  align-items: start;
}

.lista-bandeja {
  list-style: none;
  margin: 0;
  padding: 0;
  background: var(--color-fondo);
  border: 1px solid var(--color-borde-tarjeta);
  border-radius: var(--radio-tarjeta);
  overflow: hidden;
}

.panel-lateral-bandeja {
  position: sticky;
  top: var(--espacio-4);
}

.estado-vacio-detalle {
  background: var(--color-fondo);
  border: 1px solid var(--color-borde-tarjeta);
  border-radius: var(--radio-tarjeta);
  padding: var(--espacio-8) var(--espacio-4);
  text-align: center;
}

.estado-vacio {
  text-align: center;
  padding: var(--espacio-8) 0;
}

.icono-vacio {
  display: block;
  font-size: 32px;
  margin-bottom: var(--espacio-2);
  color: var(--color-exito);
}

.mensaje-vacio {
  color: var(--color-texto);
  font-weight: 700;
  margin: 0 0 var(--espacio-1);
}

.sugerencia-vacio {
  color: var(--color-texto-terciario);
  font-size: var(--tamano-pequeno);
  margin: 0;
}

@media (max-width: 900px) {
  .grid-bandeja {
    grid-template-columns: 1fr;
  }

  .panel-lateral-bandeja {
    position: static;
    display: none;
  }

  .grid-bandeja--detalle-abierto .lista-bandeja {
    display: none;
  }

  .grid-bandeja--detalle-abierto .panel-lateral-bandeja {
    display: block;
  }
}
</style>
