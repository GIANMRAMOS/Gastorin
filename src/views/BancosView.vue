<script setup lang="ts">
import { onMounted, ref } from 'vue'
import ModalBanco from '@/components/ModalBanco.vue'
import { useBancos } from '@/composables/useBancos'
import { useIngresosStore } from '@/stores/ingresos'

/**
 * Catálogo de bancos (Épica 11, HU-11.1): lista simple, sin agrupación
 * predefinida/personalizada (a diferencia de `CategoriasView`) y sin
 * edición/desactivación (fuera de alcance de esta HU).
 */
const { cargarBancos } = useBancos()
const storeIngresos = useIngresosStore()

const modalAbierto = ref(false)

onMounted(() => {
  cargarBancos()
})

/** Abre el modal de alta de banco. */
function abrirModalAlta() {
  modalAbierto.value = true
}

/** Cierra el modal de alta sin guardar. */
function cerrarModal() {
  modalAbierto.value = false
}

/** Tras guardar, cierra el modal; la lista ya se actualizó en el store. */
function manejarGuardado() {
  cerrarModal()
}
</script>

<template>
  <main class="pagina-bancos">
    <div class="cabecera-bancos">
      <h1>Bancos</h1>
      <button type="button" class="boton-primario boton-nuevo" @click="abrirModalAlta">
        + Nuevo banco
      </button>
    </div>

    <p v-if="storeIngresos.error" role="alert" class="mensaje-error">{{ storeIngresos.error }}</p>

    <ul v-if="storeIngresos.bancos.length > 0" class="lista-bancos">
      <li v-for="banco in storeIngresos.bancos" :key="banco.id" class="fila-banco">
        <p class="nombre-banco">{{ banco.nombre }}</p>
      </li>
    </ul>
    <div v-else class="estado-vacio">
      <p class="mensaje-vacio">Todavía no tienes bancos registrados.</p>
      <button type="button" class="boton-primario boton-nuevo" @click="abrirModalAlta">
        Nuevo banco
      </button>
    </div>

    <ModalBanco v-if="modalAbierto" @cerrar="cerrarModal" @guardado="manejarGuardado" />
  </main>
</template>

<style scoped>
.pagina-bancos {
  max-width: 720px;
  margin: 0 auto;
  padding: var(--espacio-6) var(--espacio-4);
}

.cabecera-bancos {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--espacio-4);
  margin-bottom: var(--espacio-6);
}

.cabecera-bancos h1 {
  font-size: clamp(20px, 4vw, 26px);
  margin: 0;
}

.boton-nuevo {
  width: auto;
  min-height: 44px;
  margin-top: 0;
  padding: 0 var(--espacio-4);
}

.lista-bancos {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--espacio-2);
}

.fila-banco {
  background: var(--color-fondo);
  border: 1px solid var(--color-borde-tarjeta);
  border-radius: 18px;
  padding: var(--espacio-3) var(--espacio-4);
}

.nombre-banco {
  margin: 0;
  font-weight: 700;
  color: var(--color-texto);
}

.estado-vacio {
  text-align: center;
  padding: var(--espacio-8) 0;
}

.mensaje-vacio {
  color: var(--color-texto-secundario);
  margin: 0 0 var(--espacio-3);
}
</style>
