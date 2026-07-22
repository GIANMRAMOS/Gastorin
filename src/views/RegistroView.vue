<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useAuthStore } from '@/stores/auth'

const LONGITUD_MINIMA_PASSWORD = 8

const email = ref('')
const password = ref('')
const errorValidacion = ref<string | null>(null)
const mensajeConfirmacionPendiente = ref<string | null>(null)

const router = useRouter()
const { registrar } = useAuth()
const storeAuth = useAuthStore()

/** Valida los campos del formulario antes de llamar a Supabase. */
function validarFormulario(): boolean {
  if (!email.value.trim() || !password.value) {
    errorValidacion.value = 'Completa el email y la contraseña.'
    return false
  }
  if (password.value.length < LONGITUD_MINIMA_PASSWORD) {
    errorValidacion.value = `La contraseña debe tener al menos ${LONGITUD_MINIMA_PASSWORD} caracteres.`
    return false
  }
  errorValidacion.value = null
  return true
}

/** Envía el formulario de registro; bloquea antes de llamar a Supabase si la validación falla. */
async function manejarEnvio() {
  storeAuth.limpiarError()
  mensajeConfirmacionPendiente.value = null
  if (!validarFormulario()) {
    return
  }
  const exito = await registrar(email.value, password.value)
  if (!exito) {
    return
  }
  if (storeAuth.estaAutenticado) {
    router.push({ name: 'dashboard' })
  } else {
    // Email nuevo con confirmación pendiente: Supabase devuelve el usuario pero
    // sin sesión real, así que no hay que redirigir a una zona protegida.
    mensajeConfirmacionPendiente.value = 'Revisa tu correo para confirmar tu cuenta.'
  }
}
</script>

<template>
  <div class="envoltorio-auth">
    <main class="tarjeta-auth">
      <div class="logo-auth">g</div>
      <h1>Crear cuenta</h1>
      <p class="subtitulo-auth">Empieza a llevar tus gastos claros y en orden</p>

      <form @submit.prevent="manejarEnvio">
        <div class="grupo-campo">
          <label for="email">Email</label>
          <input id="email" v-model="email" type="email" autocomplete="email" class="entrada" />
        </div>
        <div class="grupo-campo">
          <label for="password">Contraseña</label>
          <input
            id="password"
            v-model="password"
            type="password"
            autocomplete="new-password"
            class="entrada"
          />
        </div>

        <p v-if="errorValidacion" role="alert" class="mensaje-error">{{ errorValidacion }}</p>
        <p v-else-if="storeAuth.error" role="alert" class="mensaje-error">{{ storeAuth.error }}</p>
        <p v-else-if="mensajeConfirmacionPendiente" role="status" class="mensaje-exito">
          {{ mensajeConfirmacionPendiente }}
        </p>

        <button type="submit" :disabled="storeAuth.cargando" class="boton-primario" :class="{ cargando: storeAuth.cargando }">
          Registrarme
        </button>
      </form>
      <p class="pie-auth">
        ¿Ya tienes cuenta?
        <router-link :to="{ name: 'login' }" class="enlace-secundario">Inicia sesión</router-link>
      </p>
    </main>
  </div>
</template>
