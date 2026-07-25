<script setup lang="ts">
/**
 * Tarjeta de conteo para las stat cards de la Fase 4 "Caudal" que NO son un
 * monto (a diferencia de `TarjetaKpi`, reusada para "Proyección de cierre" y
 * "Ahorro comprometido"): "Categorías excedidas" y "Días sin gasto" (Épica
 * 15). Presentacional puro: recibe el valor y la nota ya calculados por
 * `PresupuestosView`.
 */
withDefaults(
  defineProps<{
    label: string
    valor: number
    nota?: string
    /** Nombres a listar debajo del valor (solo "Categorías excedidas"), pintados en `--color-error`. */
    items?: string[]
    /** Cuando es `true`, el valor y los `items` se pintan en `--color-error` (hay algo que atender). */
    conAlerta?: boolean
  }>(),
  { nota: undefined, items: () => [], conAlerta: false },
)
</script>

<template>
  <article class="tarjeta-stat-presupuesto">
    <p class="etiqueta-stat">{{ label }}</p>
    <p class="valor-stat" :class="{ 'valor-stat-alerta': conAlerta }">{{ valor }}</p>
    <p v-if="nota" class="nota-stat">{{ nota }}</p>
    <ul v-if="items.length > 0" class="lista-items-stat">
      <li v-for="item in items" :key="item" class="item-stat">{{ item }}</li>
    </ul>
  </article>
</template>

<style scoped>
.tarjeta-stat-presupuesto {
  background: var(--color-fondo);
  border: 1px solid var(--color-borde-tarjeta);
  border-radius: var(--radio-tarjeta);
  padding: var(--espacio-4);
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.etiqueta-stat {
  margin: 0;
  font-size: var(--tamano-pequeno);
  font-weight: 600;
  color: var(--color-texto-secundario);
}

.valor-stat {
  margin: 0;
  font-family: var(--fuente-mono);
  font-weight: 700;
  font-size: clamp(19px, 3.2vw, 25px);
  color: var(--color-texto);
}

.valor-stat-alerta {
  color: var(--color-error);
}

.nota-stat {
  margin: 0;
  font-size: 0.75rem;
  color: var(--color-texto-terciario);
}

.lista-items-stat {
  margin: var(--espacio-1) 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.item-stat {
  font-size: 0.75rem;
  color: var(--color-error);
}
</style>
