<script setup lang="ts">
/**
 * Control "⋮" (Editar/Eliminar) de una fila de `TablaMovimientos`, extraído
 * como componente presentacional puro para poder montarse en dos lugares
 * distintos (carril lateral en escritorio, celda dentro del `<tr>` en mobile)
 * sin duplicar markup ni lógica. El estado del menú abierto y los handlers
 * de editar/eliminar viven en el padre (`TablaMovimientos`): este componente
 * solo refleja `abierto` y emite intención, nunca decide por sí mismo.
 */
defineProps<{
  filaId: string
  abierto: boolean
  /** Descripción de la fila para enriquecer el aria-label en contextos donde
   * el control pierde la asociación nativa con su `<tr>` (ver TablaMovimientos). */
  etiquetaFila?: string
}>()

const emit = defineEmits<{
  alternar: [string]
  editar: [string]
  eliminar: [string]
}>()
</script>

<template>
  <!-- `.celda-acciones` + `data-fila-id` se mantienen aunque este contenedor
       ya no sea siempre un <td>: el `manejarClicFuera` del padre busca este
       selector para saber si el clic ocurrió dentro del control abierto. -->
  <div class="celda-acciones" :data-fila-id="filaId">
    <button
      type="button"
      class="boton-fila boton-menu-acciones"
      aria-haspopup="true"
      :aria-expanded="abierto"
      :aria-label="etiquetaFila ? `Más acciones para ${etiquetaFila}` : 'Más acciones'"
      @click="emit('alternar', filaId)"
    >
      <svg class="icono-accion-fila" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <circle cx="12" cy="5" r="1.75" />
        <circle cx="12" cy="12" r="1.75" />
        <circle cx="12" cy="19" r="1.75" />
      </svg>
    </button>
    <div v-if="abierto" class="menu-acciones-fila" role="menu">
      <button
        type="button"
        class="boton-menu-item boton-editar"
        role="menuitem"
        aria-label="Editar movimiento"
        @click="emit('editar', filaId)"
      >
        <svg class="icono-accion-fila" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
        <span>Editar</span>
      </button>
      <button
        type="button"
        class="boton-menu-item boton-eliminar"
        role="menuitem"
        aria-label="Eliminar movimiento"
        @click="emit('eliminar', filaId)"
      >
        <svg class="icono-accion-fila" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 6h18" />
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
        </svg>
        <span>Eliminar</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.celda-acciones {
  position: relative;
  display: inline-flex;
  white-space: nowrap;
}

.boton-fila {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  font-family: var(--fuente-base);
  /* Zona clickeable de ~44px de lado (mínimo táctil recomendado) aunque el
     ícono visual sea más chico, tanto en escritorio como en el layout
     apilado de mobile. */
  min-width: 44px;
  min-height: 44px;
  padding: var(--espacio-1) var(--espacio-2);
}
.icono-accion-fila {
  width: 18px;
  height: 18px;
}
.boton-menu-acciones {
  color: var(--color-texto);
}
.boton-menu-acciones:hover {
  opacity: 0.75;
}

/* El contenedor raíz (`.celda-acciones`) es `position: relative`, lo que lo
   vuelve un contenedor de posicionamiento válido para este
   `position: absolute` sin necesitar coordinarse con estilos externos. */
.menu-acciones-fila {
  position: absolute;
  top: 100%;
  right: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  min-width: 150px;
  background: var(--color-fondo);
  border: 1px solid var(--color-borde-tarjeta);
  border-radius: var(--radio-borde);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.18);
  overflow: hidden;
}

.boton-menu-item {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: var(--espacio-2);
  width: 100%;
  min-height: 44px;
  padding: var(--espacio-2) var(--espacio-3);
  font-family: var(--fuente-base);
  font-size: var(--tamano-pequeno);
  text-align: left;
  white-space: nowrap;
}
.boton-menu-item:hover {
  background: var(--color-fondo-app);
}
.boton-menu-item.boton-editar {
  color: var(--color-texto);
}
.boton-menu-item.boton-eliminar {
  color: var(--color-error, #c0392b);
}
</style>
