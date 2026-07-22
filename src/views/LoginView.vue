<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useAuthStore } from '@/stores/auth'

const email = ref('')
const password = ref('')
const errorValidacion = ref<string | null>(null)

const router = useRouter()
const { iniciarSesion } = useAuth()
const storeAuth = useAuthStore()

/** Valida que ambos campos estén completos antes de llamar a Supabase. */
function validarFormulario(): boolean {
  if (!email.value.trim() || !password.value) {
    errorValidacion.value = 'Completa el email y la contraseña.'
    return false
  }
  errorValidacion.value = null
  return true
}

/** Envía el formulario de login; en éxito redirige al Dashboard (home tras login). */
async function manejarEnvio() {
  storeAuth.limpiarError()
  if (!validarFormulario()) {
    return
  }
  const exito = await iniciarSesion(email.value, password.value)
  if (exito) {
    router.push({ name: 'dashboard' })
  }
}
</script>

<template>
  <div class="envoltorio-auth">
    <main class="tarjeta-auth">
      <div class="logo-auth">g</div>
      <h1>Gastorin</h1>
      <p class="subtitulo-auth">Tus gastos, claros y en orden</p>

      <form @submit.prevent="manejarEnvio">
        <div class="grupo-campo">
          <label for="email">Email</label>
          <input id="email" v-model="email" type="email" autocomplete="email" class="entrada" />
        </div>
        <div class="grupo-campo">
          <div class="fila-entre">
            <label for="password">Contraseña</label>
            <router-link :to="{ name: 'recuperar-password' }" class="enlace-secundario enlace-inline">
              ¿Olvidaste tu contraseña?
            </router-link>
          </div>
          <input
            id="password"
            v-model="password"
            type="password"
            autocomplete="current-password"
            class="entrada"
          />
        </div>

        <p v-if="errorValidacion" role="alert" class="mensaje-error">{{ errorValidacion }}</p>
        <p v-else-if="storeAuth.error" role="alert" class="mensaje-error">{{ storeAuth.error }}</p>

        <button type="submit" :disabled="storeAuth.cargando" class="boton-primario" :class="{ cargando: storeAuth.cargando }">
          Entrar
        </button>
      </form>
      <p class="pie-auth">
        ¿No tienes cuenta?
        <router-link :to="{ name: 'registro' }" class="enlace-secundario">Regístrate</router-link>
      </p>
    </main>
  </div>
</template>

<style scoped>
.enlace-inline {
  margin-top: 0;
}
</style>
