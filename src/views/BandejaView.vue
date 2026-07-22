<script setup lang="ts">
import { computed, onMounted } from 'vue'
import TarjetaBorrador from '@/components/TarjetaBorrador.vue'
import { useBandeja } from '@/composables/useBandeja'
import { useCategorias } from '@/composables/useCategorias'
import { useGastosStore } from '@/stores/gastos'

/**
 * Bandeja de borradores (HU-5.2): gastos detectados por correo pendientes de
 * confirmar. Banner con el total, lista de tarjetas y estado vacío cuando no
 * queda nada por revisar.
 */
const { cargarBorradores } = useBandeja()
const { cargarCategorias } = useCategorias()
const storeGastos = useGastosStore()

onMounted(() => {
  cargarCategorias()
  cargarBorradores()
})

/** Categorías activas: únicas ofrecidas para reasignar un borrador. */
const categoriasActivas = computed(() => storeGastos.categorias.filter((c) => c.activa))

const cantidadBorradores = computed(() => storeGastos.borradores.length)
const bandejaAlDia = computed(() => !storeGastos.cargando && cantidadBorradores.value === 0)
</script>

<template>
  <main class="pagina-bandeja">
    <h1>Bandeja</h1>

    <p v-if="storeGastos.error" role="alert" class="mensaje-error">{{ storeGastos.error }}</p>

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
