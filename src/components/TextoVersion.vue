<script setup lang="ts">
import { ref } from 'vue'

/**
 * Bloque de versión/commit (HU-9.1): se usa tanto en el sidebar de escritorio
 * como en el bottom nav móvil (Épica 11, ajuste de alcance). Encapsula la
 * lógica de copiar el hash completo al portapapeles para no duplicarla en
 * `AppShellLayout`.
 */
const props = defineProps<{
  textoVersion: string
  commitCompleto: string | null
}>()

/** Confirmación breve "Copiado" tras copiar el hash de commit al portapapeles. */
const commitCopiado = ref(false)

/** Copia el hash de commit completo al portapapeles y muestra una confirmación breve. */
async function copiarCommit() {
  if (!props.commitCompleto) return
  await navigator.clipboard.writeText(props.commitCompleto)
  commitCopiado.value = true
  setTimeout(() => {
    commitCopiado.value = false
  }, 2000)
}
</script>

<template>
  <p class="texto-version">
    <template v-if="commitCompleto">
      <button type="button" class="hash-commit" title="Copiar hash de commit" @click="copiarCommit">
        {{ textoVersion }}
      </button>
      <span v-if="commitCopiado" class="confirmacion-copiado">Copiado</span>
    </template>
    <template v-else>
      {{ textoVersion }}
    </template>
  </p>
</template>

<style scoped>
.texto-version {
  margin: var(--espacio-2) 0 0;
  padding: 0 var(--espacio-3);
  font-size: var(--tamano-pequeno);
  color: var(--color-texto-terciario);
  display: flex;
  align-items: center;
  gap: var(--espacio-2);
}

.hash-commit {
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  font: inherit;
  color: inherit;
  cursor: pointer;
}

.hash-commit:hover {
  color: var(--color-texto-secundario);
}

.confirmacion-copiado {
  color: var(--color-primario);
  font-weight: 600;
}
</style>
