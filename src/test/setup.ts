import { afterEach, vi } from 'vitest'

/**
 * Setup global de Vitest.
 *
 * Se mockea `src/lib/supabaseClient.ts` para TODA la suite (usando el mock
 * manual en `src/lib/__mocks__/supabaseClient.ts`). Así ninguna prueba llama
 * jamás a la red ni requiere variables de entorno reales de Supabase; cada
 * spec importa `{ supabase }` desde `@/lib/supabaseClient` (ya mockeado) y
 * configura el comportamiento de sus funciones (`signUp`, `signInWithPassword`,
 * etc.) con `mockResolvedValueOnce` / `mockResolvedValue` según el caso.
 */
vi.mock('@/lib/supabaseClient')

afterEach(() => {
  vi.clearAllMocks()
})
