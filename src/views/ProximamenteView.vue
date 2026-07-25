<script setup lang="ts">
/**
 * Vista placeholder reutilizable ("Próximamente") para rutas cuya pantalla
 * real todavía no existe en este build (GATE1 del rediseño "Caudal", Fase 1):
 * el nav muestra 7 ítems (Dashboard, Ingresos, Egresos, Bandeja, Presupuesto,
 * Gráficos, Maestros), pero Gráficos (Fase 5) y Maestros (Fase 6) todavía no
 * tienen contenido propio. En vez de omitirlos del nav (lo que dejaría el
 * visual sin calzar con el diseño) o apuntarlos a un enlace muerto, ambas
 * rutas (`graficos`/`maestros`) renderizan esta misma vista con un `titulo`
 * propio, así el ítem del nav siempre lleva a algo real y honesto.
 */
defineProps<{
  /** Título de la sección en construcción (ej. "Gráficos", "Maestros"); opcional para un uso genérico. */
  titulo?: string
}>()
</script>

<template>
  <main class="pagina-proximamente">
    <div class="tarjeta-proximamente">
      <span class="chip-proximamente-vista">Próximamente</span>
      <h1 v-if="titulo">{{ titulo }}</h1>
      <p class="texto-proximamente-vista">
        Esta sección está en construcción y llegará en una fase posterior del rediseño.
      </p>
    </div>
  </main>
</template>

<style scoped>
.pagina-proximamente {
  max-width: 720px;
  margin: 0 auto;
  padding: var(--espacio-6) var(--espacio-4);
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
}

.tarjeta-proximamente {
  text-align: center;
  background: var(--color-fondo);
  border: 1px dashed var(--color-borde);
  border-radius: var(--radio-tarjeta);
  padding: var(--espacio-8) var(--espacio-6);
}

.chip-proximamente-vista {
  display: inline-block;
  color: var(--color-texto-terciario);
  font-style: italic;
  font-size: var(--tamano-pequeno);
  margin-bottom: var(--espacio-2);
}

.tarjeta-proximamente h1 {
  margin: 0 0 var(--espacio-2);
  font-size: clamp(20px, 4vw, 26px);
}

.texto-proximamente-vista {
  margin: 0;
  color: var(--color-texto-secundario);
  font-size: var(--tamano-pequeno);
}
</style>
