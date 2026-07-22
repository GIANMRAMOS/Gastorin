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
    cargando: false,
    error: null as string | null,
  }),
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
    /** Marca el estado de carga de una operación de gastos en curso. */
    establecerCargando(cargando: boolean) {
      this.cargando = cargando
    },
    /** Guarda el mensaje de error de la última operación de gastos. */
    establecerError(error: string | null) {
      this.error = error
    },
    /** Limpia el error actual (por ejemplo, al reintentar un envío). */
    limpiarError() {
      this.error = null
    },
  },
})
