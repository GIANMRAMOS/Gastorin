import { defineStore } from 'pinia'
import type { Banco, Ingreso } from '@/types/ingreso'

/**
 * Store de ingresos: fuente única de verdad de los ingresos y bancos del
 * usuario (Épica 11). `useIngresos`/`useBancos` son responsables de ejecutar
 * las operaciones contra Supabase y de escribir aquí el resultado.
 * Cubre alta, listado, edición y eliminación (HU 11.1–11.4).
 */
export const useIngresosStore = defineStore('ingresos', {
  state: () => ({
    ingresos: [] as Ingreso[],
    bancos: [] as Banco[],
    /**
     * Contador de cargas en vuelo (fuente real de `cargando`, ver getter
     * abajo). Este store lo comparten `useIngresos` y `useBancos`, e
     * "Ingresos" (`IngresosView`) dispara `cargarIngresos` y `cargarBancos`
     * en paralelo desde un mismo `onMounted`, sin `await` entre ellas. Con un
     * booleano plano, la primera acción en terminar apagaba `cargando` aunque
     * la otra siguiera en vuelo. Cada acción sigue haciendo un único
     * `establecerCargando(true)`/`(false)` (el segundo siempre en su propio
     * `finally`), así que el contador queda en 0 exactamente cuando TODAS
     * terminaron. Mismo patrón que `useGastosStore` (Fase 0 "Caudal").
     */
    cargasEnVuelo: 0,
    error: null as string | null,
  }),
  getters: {
    /** `true` mientras haya al menos una carga en vuelo (contador > 0). */
    cargando: (state) => state.cargasEnVuelo > 0,
  },
  actions: {
    /** Reemplaza la lista completa de ingresos (ej. tras `cargarIngresos`). */
    establecerIngresos(ingresos: Ingreso[]) {
      this.ingresos = ingresos
    },
    /** Añade un ingreso recién creado al principio de la lista. */
    agregarIngreso(ingreso: Ingreso) {
      this.ingresos.unshift(ingreso)
    },
    /** Reemplaza un ingreso existente por su id (tras una edición exitosa). */
    actualizarIngreso(ingreso: Ingreso) {
      const indice = this.ingresos.findIndex((i) => i.id === ingreso.id)
      if (indice !== -1) {
        this.ingresos[indice] = ingreso
      }
    },
    /** Quita un ingreso de la lista por su id (tras una eliminación exitosa). */
    quitarIngreso(id: string) {
      this.ingresos = this.ingresos.filter((i) => i.id !== id)
    },
    /** Reemplaza la lista completa de bancos (ej. tras `cargarBancos`). */
    establecerBancos(bancos: Banco[]) {
      this.bancos = bancos
    },
    /** Añade un banco recién creado a la lista. */
    agregarBanco(banco: Banco) {
      this.bancos.push(banco)
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
     * Guarda el mensaje de error de una operación de ingresos/bancos. Si ya
     * hay un error activo, conserva el PRIMERO en vez de pisarlo: cuando dos
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
