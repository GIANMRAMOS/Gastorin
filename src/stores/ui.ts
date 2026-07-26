import { defineStore } from 'pinia'

/**
 * Store de estado de UI transversal (no es un dominio de negocio).
 * Gobierna si hay un modal abierto (para que el bottom nav reaccione sin
 * acoplarse al componente que lo abre) y, desde el rediseño "Caudal" (Fase
 * 1), si la hoja de acciones de registro está abierta: el botón "+
 * Registrar" vive dentro de cada vista (ej. `DashboardView`, dentro de
 * `<main>`), pero quien monta `HojaAccionesFab`/los modales es el shell
 * (`AppShellLayout`, ruta padre). Sin un store intermedio, la vista no tiene
 * forma de invocar al shell directamente; mediar por aquí desacopla ambos y
 * permite que futuras vistas reutilicen el mismo botón sin duplicar el shell.
 */
export const useUiStore = defineStore('ui', {
  state: () => ({
    modalAbierto: false,
    hojaAccionesAbierta: false,
    /**
     * Contador que sube cada vez que se confirma un gasto o ingreso desde
     * `ModalGasto`/`ModalIngreso` (montados en `AppShellLayout`, fuera de
     * cualquier vista). Vistas que mantienen su PROPIA copia local de datos
     * en vez de leer directo del store de dominio (ej. `DashboardView` vía
     * `useDashboard().cargarDatosDashboard()`, o el propio `AppShellLayout`
     * con la card "Proyección") no se enteran de un registro nuevo por
     * reactividad de Pinia — necesitan un `watch` sobre este contador para
     * volver a pedir sus datos. Las vistas que sí leen directo del store
     * (Egresos/Ingresos) no lo necesitan: ya son reactivas.
     */
    contadorRegistro: 0,
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
    /** Abre la hoja de acciones de registro (Registrar gasto/ingreso) desde cualquier vista. */
    abrirHojaAcciones() {
      this.hojaAccionesAbierta = true
    },
    /** Cierra la hoja de acciones sin haber elegido ninguna acción. */
    cerrarHojaAcciones() {
      this.hojaAccionesAbierta = false
    },
    /** Señala que se acaba de confirmar un gasto o ingreso, para que quien mantenga datos locales los vuelva a pedir. */
    notificarRegistro() {
      this.contadorRegistro += 1
    },
  },
})
