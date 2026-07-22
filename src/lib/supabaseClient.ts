import { createClient } from '@supabase/supabase-js'

const urlSupabase = import.meta.env.VITE_SUPABASE_URL
const claveAnonSupabase = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!urlSupabase || !claveAnonSupabase) {
  throw new Error(
    'Faltan las variables de entorno VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY. Revisa tu archivo .env.local.',
  )
}

// Instancia única del cliente de Supabase. Todo el resto del código debe importar esta instancia.
export const supabase = createClient(urlSupabase, claveAnonSupabase)
