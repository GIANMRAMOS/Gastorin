import { defineStore } from 'pinia'
import type { Banco, Ingreso } from '@/types/ingreso'

/**
 * Store de ingresos: fuente única de verdad de los ingresos y bancos del
 * usuario (Épica 11). `useIngresos`/`useBancos` son responsables de ejecutar
 * las operaciones contra Supabase y de escribir aquí el resultado.
 * Solo cubre alta + listado (sin editar/eliminar): las HU 11.1–11.4 no lo piden.
 */
export const useIngresosStore = defineStore('ingresos', {
  state: () => ({
    ingresos: [] as Ingreso[],
    bancos: [] as Banco[],
    cargando: false,
    error: null as string | null,
  }),
  actions: {
    /** Reemplaza la lista completa de ingresos (ej. tras `cargarIngresos`). */
    establecerIngresos(ingresos: Ingreso[]) {
      this.ingresos = ingresos
    },
    /** Añade un ingreso recién creado al principio de la lista. */
    agregarIngreso(ingreso: Ingreso) {
      this.ingresos.unshift(ingreso)
    },
    /** Reemplaza la lista completa de bancos (ej. tras `cargarBancos`). */
    establecerBancos(bancos: Banco[]) {
      this.bancos = bancos
    },
    /** Añade un banco recién creado a la lista. */
    agregarBanco(banco: Banco) {
      this.bancos.push(banco)
    },
    /** Marca el estado de carga de una operación de ingresos/bancos en curso. */
    establecerCargando(cargando: boolean) {
      this.cargando = cargando
    },
    /** Guarda el mensaje de error de la última operación de ingresos/bancos. */
    establecerError(error: string | null) {
      this.error = error
    },
    /** Limpia el error actual (por ejemplo, al reintentar un envío). */
    limpiarError() {
      this.error = null
    },
  },
})
