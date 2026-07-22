<script setup lang="ts">
import { onMounted, ref } from 'vue'
import ModalIngreso from '@/components/ModalIngreso.vue'
import { useIngresos } from '@/composables/useIngresos'
import { useBancos } from '@/composables/useBancos'
import { useIngresosStore } from '@/stores/ingresos'
import { useMoneda } from '@/composables/useMoneda'

/**
 * Historial de ingresos (Épica 11, HU-11.3): clon estructural de
 * `HistorialView.vue` reducido a alta + listado (sin filtros/edición/
 * eliminación, fuera de alcance de esta HU). El orden por fecha descendente
 * lo garantiza el `.order` de `useIngresos.cargarIngresos`.
 */
const { cargarIngresos } = useIngresos()
const { cargarBancos } = useBancos()
const storeIngresos = useIngresosStore()
const { formatearMonto } = useMoneda()

const modalAbierto = ref(false)

onMounted(() => {
  cargarIngresos()
  cargarBancos()
})

/** Nombre del banco de un ingreso (para mostrarlo en la fila). */
function nombreBanco(bancoId: string): string {
  return storeIngresos.bancos.find((banco) => banco.id === bancoId)?.nombre ?? 'Sin banco'
}

/** Abre el modal de alta de ingreso. */
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
  <main class="pagina-ingresos">
    <div class="cabecera-ingresos">
      <h1>Ingresos</h1>
      <button type="button" class="boton-primario boton-nuevo" @click="abrirModalAlta">
        + Nuevo ingreso
      </button>
    </div>

    <p v-if="storeIngresos.error" role="alert" class="mensaje-error">{{ storeIngresos.error }}</p>

    <ul v-if="storeIngresos.ingresos.length > 0" class="lista-ingresos">
      <li v-for="ingreso in storeIngresos.ingresos" :key="ingreso.id" class="fila-ingreso">
        <div class="detalle-ingreso">
          <p class="concepto-ingreso">{{ ingreso.concepto }}</p>
          <p class="metadatos-ingreso">{{ nombreBanco(ingreso.banco_id) }} · {{ ingreso.fecha }}</p>
        </div>
        <p class="importe-ingreso">{{ formatearMonto(ingreso.importe, ingreso.moneda) }}</p>
      </li>
    </ul>

    <div v-else class="estado-vacio">
      <p class="mensaje-vacio">Todavía no hay ingresos registrados.</p>
      <button type="button" class="boton-primario boton-nuevo" @click="abrirModalAlta">
        Nuevo ingreso
      </button>
    </div>

    <ModalIngreso v-if="modalAbierto" @cerrar="cerrarModal" @guardado="manejarGuardado" />
  </main>
</template>

<style scoped>
.pagina-ingresos {
  max-width: 720px;
  margin: 0 auto;
  padding: var(--espacio-6) var(--espacio-4);
}

.cabecera-ingresos {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--espacio-4);
  margin-bottom: var(--espacio-6);
}

.cabecera-ingresos h1 {
  font-size: clamp(20px, 4vw, 26px);
  margin: 0;
}

.boton-nuevo {
  width: auto;
  min-height: 44px;
  margin-top: 0;
  padding: 0 var(--espacio-4);
}

.lista-ingresos {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--espacio-2);
}

.fila-ingreso {
  display: flex;
  align-items: center;
  gap: var(--espacio-3);
  background: var(--color-fondo);
  border: 1px solid var(--color-borde-tarjeta);
  border-radius: 18px;
  padding: var(--espacio-3) var(--espacio-4);
}

.detalle-ingreso {
  flex: 1;
  min-width: 0;
}

.concepto-ingreso {
  margin: 0;
  font-weight: 700;
  color: var(--color-texto);
}

.metadatos-ingreso {
  margin: 2px 0 0;
  font-size: var(--tamano-pequeno);
  color: var(--color-texto-secundario);
}

.importe-ingreso {
  margin: 0;
  font-weight: 700;
  color: var(--color-texto);
  white-space: nowrap;
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
