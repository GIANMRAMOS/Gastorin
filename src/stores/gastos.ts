import { defineStore } from 'pinia'
import type { Categoria, Gasto, Presupuesto } from '@/types/gasto'

/**
 * Store de gastos: fuente única de verdad de los gastos y categorías del usuario.
 * `useGastos` es responsable de ejecutar las operaciones contra Supabase
 * y de escribir aquí el resultado (listas, estado de carga y errores).
 */
export const useGastosStore = defineStore('gastos', {
  state: () => ({
    gastos: [] as Gasto[],
    categorias: [] as Categoria[],
    /**
     * Borradores de la bandeja (`origen='correo'`, `estado in ('borrador',
     * 'revision_manual')`). Lista separada de `gastos` (que solo contiene
     * `estado='confirmado'`) para que un borrador nunca aparezca en el Historial.
     */
    borradores: [] as Gasto[],
    /**
     * Presupuestos mensuales del usuario (Épica 6). Sub-dominio propio que
     * reutiliza el mismo `useGastosStore`, igual precedente que `borradores`.
     */
    presupuestos: [] as Presupuesto[],
    /**
     * Contador de cargas en vuelo (fuente real de `cargando`, ver getter
     * abajo). Este store lo comparten cinco composables (`useGastos`,
     * `useCategorias`, `usePresupuestos`, `useBandeja`, `useDashboard`), y
     * "Inicio" (Fase 0 "Caudal") dispara cuatro de sus acciones en paralelo
     * desde un mismo `onMounted`, sin `await` entre ellas. Con un booleano
     * plano, la primera acción en terminar apagaba `cargando` aunque otra
     * (ej. `cargarDatosDashboard`, la más pesada) siguiera en vuelo. Cada
     * acción sigue haciendo un único `establecerCargando(true)`/`(false)` (el
     * segundo siempre en su propio `finally`), así que el contador queda
     * en 0 exactamente cuando TODAS terminaron.
     */
    cargasEnVuelo: 0,
    error: null as string | null,
  }),
  getters: {
    /** `true` mientras haya al menos una carga en vuelo (contador > 0). */
    cargando: (state) => state.cargasEnVuelo > 0,
  },
  actions: {
    /** Reemplaza la lista completa de gastos (ej. tras `cargarGastos`). */
    establecerGastos(gastos: Gasto[]) {
      this.gastos = gastos
    },
    /** Añade un gasto recién creado al principio de la lista. */
    agregarGasto(gasto: Gasto) {
      this.gastos.unshift(gasto)
    },
    /** Reemplaza un gasto existente por su id (tras una edición exitosa). */
    actualizarGasto(gasto: Gasto) {
      const indice = this.gastos.findIndex((g) => g.id === gasto.id)
      if (indice !== -1) {
        this.gastos[indice] = gasto
      }
    },
    /** Quita un gasto de la lista por su id (tras una eliminación exitosa). */
    quitarGasto(id: string) {
      this.gastos = this.gastos.filter((g) => g.id !== id)
    },
    /** Reemplaza la lista completa de borradores (ej. tras `cargarBorradores`). */
    establecerBorradores(borradores: Gasto[]) {
      this.borradores = borradores
    },
    /**
     * Reemplaza un borrador existente por su id (tras editar su categoría).
     * Se usa distinto de `quitarBorrador` porque el borrador sigue vivo en la
     * bandeja, solo cambian sus datos.
     */
    actualizarBorrador(borrador: Gasto) {
      const indice = this.borradores.findIndex((b) => b.id === borrador.id)
      if (indice !== -1) {
        this.borradores[indice] = borrador
      }
    },
    /** Quita un borrador de la bandeja por su id (tras confirmarlo o descartarlo). */
    quitarBorrador(id: string) {
      this.borradores = this.borradores.filter((b) => b.id !== id)
    },
    /** Reemplaza la lista completa de categorías del usuario. */
    establecerCategorias(categorias: Categoria[]) {
      this.categorias = categorias
    },
    /** Añade una categoría recién creada a la lista. */
    agregarCategoria(categoria: Categoria) {
      this.categorias.push(categoria)
    },
    /** Reemplaza una categoría existente por su id (tras editarla o desactivarla). */
    actualizarCategoria(categoria: Categoria) {
      const indice = this.categorias.findIndex((c) => c.id === categoria.id)
      if (indice !== -1) {
        this.categorias[indice] = categoria
      }
    },
    /** Reemplaza la lista completa de presupuestos (ej. tras `cargarPresupuestos`). */
    establecerPresupuestos(presupuestos: Presupuesto[]) {
      this.presupuestos = presupuestos
    },
    /** Añade un presupuesto recién creado a la lista. */
    agregarPresupuesto(presupuesto: Presupuesto) {
      this.presupuestos.push(presupuesto)
    },
    /** Reemplaza un presupuesto existente por su id (tras editar su monto límite). */
    actualizarPresupuesto(presupuesto: Presupuesto) {
      const indice = this.presupuestos.findIndex((p) => p.id === presupuesto.id)
      if (indice !== -1) {
        this.presupuestos[indice] = presupuesto
      }
    },
    /** Quita un presupuesto de la lista por su id (tras eliminarlo). */
    quitarPresupuesto(id: string) {
      this.presupuestos = this.presupuestos.filter((p) => p.id !== id)
    },
    /**
     * Registra el inicio (`true`) o el fin (`false`) de una carga en curso:
     * incrementa/decrementa `cargasEnVuelo` en vez de pisar un booleano, para
     * que varias acciones concurrentes de este store (ver `cargasEnVuelo`)
     * no se pisen entre sí. El piso en 0 (`Math.max`) es una defensa
     * adicional ante un desbalance futuro (no debería ocurrir: cada acción
     * hace su `(false)` en un `finally`).
     */
    establecerCargando(cargando: boolean) {
      this.cargasEnVuelo = Math.max(0, this.cargasEnVuelo + (cargando ? 1 : -1))
    },
    /**
     * Guarda el mensaje de error de una operación de gastos. Si ya hay un
     * error activo, conserva el PRIMERO en vez de pisarlo: cuando dos
     * acciones concurrentes de este store fallan a la vez (mismo escenario
     * de `cargasEnVuelo`), la segunda en resolver ya no debería esconder la
     * causa de la primera. Cada acción sigue llamando a `limpiarError()` al
     * entrar, así que un intento nuevo (secuencial, no solapado) despeja el
     * error anterior con normalidad antes de poder reportar uno propio.
     */
    establecerError(error: string | null) {
      if (this.error !== null && error !== null) return
      this.error = error
    },
    /** Limpia el error actual (por ejemplo, al reintentar un envío). */
    limpiarError() {
      this.error = null
    },
  },
})
