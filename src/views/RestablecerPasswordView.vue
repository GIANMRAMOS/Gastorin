<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useAuthStore } from '@/stores/auth'

const LONGITUD_MINIMA_PASSWORD = 8

const nuevaPassword = ref('')
const errorValidacion = ref<string | null>(null)
const passwordActualizada = ref(false)

const router = useRouter()
const { restablecerPassword } = useAuth()
const storeAuth = useAuthStore()

/** Valida la nueva contraseña antes de llamar a Supabase (misma regla que el registro). */
function validarFormulario(): boolean {
  if (nuevaPassword.value.length < LONGITUD_MINIMA_PASSWORD) {
    errorValidacion.value = `La contraseña debe tener al menos ${LONGITUD_MINIMA_PASSWORD} caracteres.`
    return false
  }
  errorValidacion.value = null
  return true
}

/** Envía la nueva contraseña. Si el enlace expiró, el composable ya normaliza el mensaje. */
async function manejarEnvio() {
  storeAuth.limpiarError()
  passwordActualizada.value = false
  if (!validarFormulario()) {
    return
  }
  const exito = await restablecerPassword(nuevaPassword.value)
  if (exito) {
    passwordActualizada.value = true
    router.push({ name: 'login' })
  }
}
</script>

<template>
  <div class="envoltorio-auth">
    <main class="tarjeta-auth">
      <div class="logo-auth">g</div>
      <h1>Restablecer contraseña</h1>
      <p class="subtitulo-auth">Elige una nueva contraseña para tu cuenta</p>

      <form @submit.prevent="manejarEnvio">
        <div class="grupo-campo">
          <label for="nueva-password">Nueva contraseña</label>
          <input
            id="nueva-password"
            v-model="nuevaPassword"
            type="password"
            autocomplete="new-password"
            class="entrada"
          />
        </div>

        <p v-if="errorValidacion" role="alert" class="mensaje-error">{{ errorValidacion }}</p>
        <p v-else-if="storeAuth.error" role="alert" class="mensaje-error">{{ storeAuth.error }}</p>
        <p v-else-if="passwordActualizada" class="mensaje-exito">
          Tu contraseña se ha actualizado correctamente.
        </p>

        <button type="submit" :disabled="storeAuth.cargando" class="boton-primario" :class="{ cargando: storeAuth.cargando }">
          Actualizar contraseña
        </button>
      </form>
    </main>
  </div>
</template>
