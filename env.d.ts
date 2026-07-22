/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Constantes de build inyectadas por `vite.config.ts` (bloque `define`),
// Épica 9 — versionado y trazabilidad.
declare const __GASTORIN_VERSION__: string
declare const __GASTORIN_COMMIT__: string | null
declare const __GASTORIN_ES_DEV__: boolean
