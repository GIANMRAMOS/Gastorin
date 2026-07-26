<script setup lang="ts">
import { computed } from 'vue'
import { useMoneda } from '@/composables/useMoneda'
import type { SaldoCuenta } from '@/composables/useDashboard'
import type { Moneda } from '@/types/gasto'

/**
 * Strip "Saldo por cuenta" del Dashboard "Caudal". Reemplaza el placeholder
 * "Próximamente" (Fase 1): ahora muestra el saldo neto real (ingresos −
 * gastos) de las cuentas BCP/IBK, calculado por `calcularSaldoNetoPorCuenta`
 * (ver `useDashboard.ts`). Presentacional puro: recibe ya calculado el
 * arreglo de `cuentas`, una fila por `bancoId` real — nunca inventa cuentas
 * ni divide el saldo de una cuenta en dos.
 */
const props = defineProps<{
  cuentas: SaldoCuenta[]
}>()

const emit = defineEmits<{
  /** El usuario tocó una cuenta para setear su saldo (abre `ModalAjusteSaldo` en `DashboardView`). */
  'editar-cuenta': [{ bancoId: string; moneda: Moneda; etiqueta: string }]
}>()

const { formatearMonto } = useMoneda()

const sinCuentas = computed(() => props.cuentas.length === 0)

interface TileCuenta {
  key: string
  bancoId: string
  etiqueta: string
  monto: number
  moneda: Moneda
  secundario?: { monto: number; moneda: Moneda }
}

/**
 * "IBK US$" es un banco REAL y separado de "IBK" (no una moneda secundaria
 * de la misma cuenta) — así lo creó la ingesta automática para transacciones
 * en dólares. Se detecta por nombre para mostrar su saldo en USD como monto
 * PRINCIPAL (no en PEN, que para esta cuenta siempre es 0 y no dice nada).
 */
function esCuentaEnDolares(nombreBanco: string): boolean {
  return /us\$|usd\b/i.test(nombreBanco)
}

/** Etiqueta de despliegue: "IBK" se lee "IBK S/." y "IBK US$" se lee "IBK $"; el resto (ej. "BCP") tal cual. */
function etiquetaCuenta(nombreBanco: string): string {
  const normalizado = nombreBanco.trim().toUpperCase()
  if (normalizado === 'IBK') return 'IBK S/.'
  if (normalizado === 'IBK US$') return 'IBK $'
  return nombreBanco
}

const tiles = computed<TileCuenta[]>(() =>
  props.cuentas.map((cuenta) => {
    if (esCuentaEnDolares(cuenta.nombreBanco)) {
      return {
        key: cuenta.bancoId,
        bancoId: cuenta.bancoId,
        etiqueta: etiquetaCuenta(cuenta.nombreBanco),
        monto: cuenta.saldoUsd ?? 0,
        moneda: 'USD' as Moneda,
        secundario: cuenta.saldoPen !== 0 ? { monto: cuenta.saldoPen, moneda: 'PEN' as Moneda } : undefined,
      }
    }
    return {
      key: cuenta.bancoId,
      bancoId: cuenta.bancoId,
      etiqueta: etiquetaCuenta(cuenta.nombreBanco),
      monto: cuenta.saldoPen,
      moneda: 'PEN' as Moneda,
      secundario: cuenta.saldoUsd !== null ? { monto: cuenta.saldoUsd, moneda: 'USD' as Moneda } : undefined,
    }
  }),
)
</script>

<template>
  <article class="tarjeta-saldos-cuenta">
    <div class="cabecera-saldos-cuenta">
      <p class="titulo-saldos-cuenta">Saldo por cuenta</p>
      <p v-if="!sinCuentas" class="pista-saldos-cuenta">Toca una cuenta para setear su saldo</p>
    </div>

    <p v-if="sinCuentas" class="mensaje-sin-cuentas">
      Aún no tienes las cuentas BCP o IBK creadas en Bancos.
    </p>

    <div v-else class="grid-saldos-cuenta">
      <button
        v-for="tile in tiles"
        :key="tile.key"
        type="button"
        class="tile-saldo-cuenta"
        :title="`Setear saldo de ${tile.etiqueta}`"
        @click="emit('editar-cuenta', { bancoId: tile.bancoId, moneda: tile.moneda, etiqueta: tile.etiqueta })"
      >
        <svg class="icono-editar-cuenta" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
        <p class="nombre-cuenta">{{ tile.etiqueta }}</p>
        <p class="monto-saldo-cuenta" :class="tile.monto < 0 ? 'saldo-negativo' : 'saldo-positivo'">
          {{ formatearMonto(tile.monto, tile.moneda) }}
        </p>
        <p v-if="tile.secundario" class="saldo-secundario-cuenta">
          {{ formatearMonto(tile.secundario.monto, tile.secundario.moneda) }}
        </p>
      </button>
    </div>
  </article>
</template>

<style scoped>
.tarjeta-saldos-cuenta {
  background: var(--color-fondo);
  border: 1px solid var(--color-borde-tarjeta);
  border-radius: var(--radio-tarjeta);
  padding: var(--espacio-4);
}

.cabecera-saldos-cuenta {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--espacio-2);
  margin-bottom: var(--espacio-3);
}

.titulo-saldos-cuenta {
  margin: 0;
  font-size: var(--tamano-pequeno);
  font-weight: 600;
  color: var(--color-texto-secundario);
}

.pista-saldos-cuenta {
  margin: 0;
  font-size: 0.7rem;
  color: var(--color-texto-terciario);
  white-space: nowrap;
}

.mensaje-sin-cuentas {
  margin: 0;
  font-size: var(--tamano-pequeno);
  color: var(--color-texto-terciario);
}

/* Las 3 cuentas (BCP/IBK S/.//IBK $) siempre en una sola fila, a pedido
   explícito — a diferencia de otras grillas de la app, esta no colapsa a
   una columna en móvil: son 3 tiles cortos (nombre + un monto), caben sin
   apretar incluso a ~375px. */
.grid-saldos-cuenta {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--espacio-2);
}

.tile-saldo-cuenta {
  position: relative;
  background: var(--color-fondo-app);
  border: none;
  border-radius: 10px;
  padding: var(--espacio-3) var(--espacio-2);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  min-width: 0;
  width: 100%;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
}
.tile-saldo-cuenta:hover {
  background: var(--color-borde-tarjeta);
}
.tile-saldo-cuenta:focus-visible {
  outline: 2px solid var(--color-borde-foco);
  outline-offset: 2px;
}

.icono-editar-cuenta {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 13px;
  height: 13px;
  color: var(--color-texto-terciario);
}

.nombre-cuenta {
  margin: 0;
  font-size: var(--tamano-pequeno);
  font-weight: 600;
  color: var(--color-texto-secundario);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.monto-saldo-cuenta {
  margin: 0;
  font-family: var(--fuente-mono);
  font-weight: 700;
  font-size: 1.05rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.saldo-positivo {
  color: var(--color-texto);
}

.saldo-negativo {
  color: var(--color-error);
}

.saldo-secundario-cuenta {
  margin: 0;
  font-size: var(--tamano-pequeno);
  color: var(--color-texto-terciario);
  font-family: var(--fuente-mono);
}

@media (max-width: 375px) {
  .monto-saldo-cuenta {
    font-size: 0.9rem;
  }
}
</style>
