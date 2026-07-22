<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from '@/composables/useAuth'
import { useAuthStore } from '@/stores/auth'

const email = ref('')
const errorValidacion = ref<string | null>(null)
const correoEnviado = ref(false)

const { recuperarPassword } = useAuth()
const storeAuth = useAuthStore()

/** Valida que se haya introducido un email antes de llamar a Supabase. */
function validarFormulario(): boolean {
  if (!email.value.trim()) {
    errorValidacion.value = 'Introduce tu email.'
    return false
  }
  errorValidacion.value = null
  return true
}

/** Dispara el envío del correo de recuperación de contraseña. */
async function manejarEnvio() {
  storeAuth.limpiarError()
  correoEnviado.value = false
  if (!validarFormulario()) {
    return
  }
  const exito = await recuperarPassword(email.value)
  if (exito) {
    correoEnviado.value = true
  }
}
</script>

<template>
  <div class="envoltorio-auth">
    <main class="tarjeta-auth">
      <div class="logo-auth">g</div>
      <h1>Recuperar contraseña</h1>
      <p class="subtitulo-auth">Te enviaremos un enlace para restablecerla</p>

      <form @submit.prevent="manejarEnvio">
        <div class="grupo-campo">
          <label for="email">Email</label>
          <input id="email" v-model="email" type="email" autocomplete="email" class="entrada" />
        </div>

        <p v-if="errorValidacion" role="alert" class="mensaje-error">{{ errorValidacion }}</p>
        <p v-else-if="storeAuth.error" role="alert" class="mensaje-error">{{ storeAuth.error }}</p>
        <p v-else-if="correoEnviado" class="mensaje-exito">
          Te hemos enviado un correo con las instrucciones para restablecer tu contraseña.
        </p>

        <button type="submit" :disabled="storeAuth.cargando" class="boton-primario" :class="{ cargando: storeAuth.cargando }">
          Enviar enlace
        </button>
      </form>
      <p class="pie-auth">
        <router-link :to="{ name: 'login' }" class="enlace-secundario">Volver a iniciar sesión</router-link>
      </p>
    </main>
  </div>
</template>
