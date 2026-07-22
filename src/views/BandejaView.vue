<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import TarjetaBorrador from '@/components/TarjetaBorrador.vue'
import { useBandeja } from '@/composables/useBandeja'
import { useCategorias } from '@/composables/useCategorias'
import { useGastosStore } from '@/stores/gastos'

/**
 * Bandeja de borradores (HU-5.2): gastos detectados por correo pendientes de
 * confirmar. Banner con el total, lista de tarjetas y estado vacío cuando no
 * queda nada por revisar.
 */
const { cargarBorradores, cargarEstadoIngesta } = useBandeja()
const { cargarCategorias } = useCategorias()
const storeGastos = useGastosStore()

/** Marca de tiempo (ISO) de la última ejecución de la ingesta automática (HU-5.5). */
const ultimaEjecucion = ref<string | null>(null)

onMounted(async () => {
  cargarCategorias()
  cargarBorradores()
  ultimaEjecucion.value = await cargarEstadoIngesta()
})

/** Categorías activas: únicas ofrecidas para reasignar un borrador. */
const categoriasActivas = computed(() => storeGastos.categorias.filter((c) => c.activa))

const cantidadBorradores = computed(() => storeGastos.borradores.length)
const bandejaAlDia = computed(() => !storeGastos.cargando && cantidadBorradores.value === 0)

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

    <ul v-if="cantidadBorradores > 0" class="lista-borradores">
      <TarjetaBorrador
        v-for="borrador in storeGastos.borradores"
        :key="borrador.id"
        :borrador="borrador"
        :categorias="categoriasActivas"
      />
    </ul>

    <div v-else-if="bandejaAlDia" class="estado-vacio">
      <span class="icono-vacio" aria-hidden="true">✓</span>
      <p class="mensaje-vacio">Bandeja al día</p>
      <p class="sugerencia-vacio">No hay gastos por confirmar por ahora.</p>
    </div>
  </main>
</template>

<style scoped>
.pagina-bandeja {
  max-width: 720px;
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

.lista-borradores {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--espacio-3);
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
</style>
