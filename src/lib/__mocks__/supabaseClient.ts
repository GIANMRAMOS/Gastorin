import { vi } from 'vitest'

/**
 * Crea un constructor de consultas (`.from(tabla)`) encadenable y mockeable.
 * Cada método (`select`, `insert`, `update`, `delete`, `eq`, `gte`, `lte`,
 * `lt`, `order`, `single`) devuelve el mismo builder por defecto para
 * permitir encadenar llamadas al estilo de `supabase-js` (ej.
 * `select().eq(...).gte(...).order(...)`). Como cada método es un `vi.fn()`,
 * un test puede sobreescribir cualquiera de ellos con
 * `mockResolvedValueOnce({ data, error })` para que ese punto de la cadena
 * sea el que finalmente se "resuelve" (termina la promesa).
 */
export function crearConstructorConsulta() {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {}
  const metodos = [
    'select',
    'insert',
    'update',
    'delete',
    'eq',
    'in',
    'gte',
    'lte',
    'lt',
    'order',
    'single',
  ]
  for (const metodo of metodos) {
    builder[metodo] = vi.fn(() => builder)
  }
  return builder
}

/**
 * Mock manual del cliente único de Supabase (`src/lib/supabaseClient.ts`).
 * Vitest lo usa automáticamente cuando algún test hace `vi.mock('@/lib/supabaseClient')`
 * (ver `src/test/setup.ts`), evitando así ejecutar el módulo real (que exige
 * variables de entorno `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`).
 */
export const supabase = {
  auth: {
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updateUser: vi.fn(),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    })),
    getSession: vi.fn(),
  },
  from: vi.fn(() => crearConstructorConsulta()),
}
