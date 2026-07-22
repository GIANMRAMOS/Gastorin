import { fileURLToPath, URL } from 'node:url'
import { execSync } from 'node:child_process'

import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolverCommitDesdeEnv, resolverCommitDesdeGit } from './scripts/resolver-version'
import pkg from './package.json'

// Épica 9 — trazabilidad build → runtime: versión de `package.json` y commit
// resuelto con precedencia Vercel env → `git rev-parse` → `null` (repo sin
// commits). Se inyectan como constantes globales vía `define`.
const esDev = process.env.NODE_ENV !== 'production'
const commit =
  resolverCommitDesdeEnv(process.env) ??
  resolverCommitDesdeGit((comando) => execSync(comando, { encoding: 'utf-8' }))

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  define: {
    __GASTORIN_VERSION__: JSON.stringify(pkg.version),
    __GASTORIN_COMMIT__: JSON.stringify(commit),
    __GASTORIN_ES_DEV__: JSON.stringify(esDev),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Evita el cuelgue detectado con el pool de threads por defecto en
    // combinación con Node 24.
    pool: 'forks',
  },
})
