import { createApp } from 'vue'
import { createPinia } from 'pinia'

// Fuentes "Caudal" (self-hosted vía @fontsource, sin depender de un CDN
// externo): pesos exactamente iguales a los que ya usa la hoja de estilos
// (400/600/700/800 para texto, 400/600/700 para montos en fuente mono).
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/600.css'
import '@fontsource/dm-sans/700.css'
import '@fontsource/dm-sans/800.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/600.css'
import '@fontsource/ibm-plex-mono/700.css'
import '@/assets/estilos-base.css'
import App from './App.vue'
import router from './router'
import { supabase } from '@/lib/supabaseClient'
import { useAuthStore } from '@/stores/auth'

const app = createApp(App)

app.use(createPinia())
app.use(router)

const storeAuth = useAuthStore()

/**
 * Resuelve la sesión inicial antes de montar la app: el guard del router lee
 * el store de forma síncrona en la primera navegación, y `onAuthStateChange`
 * la hidrata de forma asíncrona. Si montamos antes de resolver la sesión,
 * un refresh sobre una ruta protegida rebota al usuario a /login aunque
 * tenga una sesión válida guardada por Supabase.
 */
async function iniciarApp() {
  const { data } = await supabase.auth.getSession()
  storeAuth.establecerUsuario(data.session?.user ?? null)
  storeAuth.establecerSesion(data.session ?? null)

  // Sincronización continua de la sesión de Supabase con el store para
  // cambios posteriores (login, logout, refresh de token, etc.).
  supabase.auth.onAuthStateChange((_evento, sesion) => {
    storeAuth.establecerUsuario(sesion?.user ?? null)
    storeAuth.establecerSesion(sesion ?? null)
  })

  app.mount('#app')
}

iniciarApp()
