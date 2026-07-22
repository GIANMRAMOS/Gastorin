import { defineStore } from 'pinia'

/**
 * Store de estado de UI transversal (no es un dominio de negocio).
 * Por ahora gobierna si hay un modal abierto, para que otras piezas del
 * layout (como el bottom nav) puedan reaccionar sin acoplarse directamente
 * al componente que lo abre.
 */
export const useUiStore = defineStore('ui', {
  state: () => ({
    modalAbierto: false,
  }),
  actions: {
    /** Marca que hay un modal abierto. */
    abrirModal() {
      this.modalAbierto = true
    },
    /** Marca que no hay ningún modal abierto. */
    cerrarModal() {
      this.modalAbierto = false
    },
  },
})
