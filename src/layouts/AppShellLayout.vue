<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import ModalGasto from '@/components/ModalGasto.vue'
import { useAuth } from '@/composables/useAuth'
import { useVersion } from '@/composables/useVersion'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { useGastosStore } from '@/stores/gastos'

/**
 * App Shell de las secciones privadas: sidebar en escritorio (≥900px) y
 * bottom nav en móvil (<900px), ambos con acceso a Historial y a "Registrar
 * gasto" (abre el modal existente, no es una ruta). Incluye el bloque de
 * cuenta con los datos del usuario autenticado y el botón de salir.
 */
const router = useRouter()
const storeAuth = useAuthStore()
const storeUi = useUiStore()
const storeGastos = useGastosStore()
const { cerrarSesion } = useAuth()
const { textoVersion, commitCompleto } = useVersion()

const modalAbierto = ref(false)
/** Confirmación breve "Copiado" tras copiar el hash de commit al portapapeles. */
const commitCopiado = ref(false)

/** Cantidad de borradores pendientes de confirmar, para el badge del ítem "Bandeja". */
const cantidadBorradores = computed(() => storeGastos.borradores.length)

/** Correo del usuario autenticado, o cadena vacía si aún no se resolvió. */
const emailUsuario = computed(() => storeAuth.usuario?.email ?? '')

/** Nombre para mostrar: como el registro solo pide email, se deriva de su parte local. */
const nombreUsuario = computed(() => emailUsuario.value.split('@')[0] || 'Usuario')

/** Inicial para el avatar circular del bloque de cuenta. */
const inicialUsuario = computed(() => nombreUsuario.value.charAt(0).toUpperCase())

/** Abre el modal de alta de gasto desde cualquier punto del shell. */
function abrirModalRegistrar() {
  modalAbierto.value = true
}

/** Cierra el modal de alta de gasto sin guardar. */
function cerrarModal() {
  modalAbierto.value = false
}

/** Tras guardar el gasto, cierra el modal (la lista se refresca sola vía store). */
function manejarGuardado() {
  modalAbierto.value = false
}

/** Cierra la sesión del usuario y redirige al login. */
async function manejarSalir() {
  const exito = await cerrarSesion()
  if (exito) {
    router.push({ name: 'login' })
  }
}

/** Copia el hash de commit completo al portapapeles y muestra una confirmación breve. */
async function copiarCommit() {
  if (!commitCompleto) return
  await navigator.clipboard.writeText(commitCompleto)
  commitCopiado.value = true
  setTimeout(() => {
    commitCopiado.value = false
  }, 2000)
}
</script>

<template>
  <div class="shell">
    <aside class="barra-lateral">
      <div class="logo-marca">
        <span class="logo-cuadro">g</span>
        <span class="logo-texto">Gastorin</span>
      </div>

      <nav class="navegacion">
        <router-link :to="{ name: 'dashboard' }" class="item-nav">
          <svg class="icono-nav" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="8" height="8" rx="1.5" />
            <rect x="13" y="3" width="8" height="5" rx="1.5" />
            <rect x="13" y="10" width="8" height="11" rx="1.5" />
            <rect x="3" y="13" width="8" height="8" rx="1.5" />
          </svg>
          Dashboard
        </router-link>
        <router-link :to="{ name: 'historial' }" class="item-nav">
          <svg class="icono-nav" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
          </svg>
          Historial
        </router-link>
        <router-link :to="{ name: 'bandeja' }" class="item-nav">
          <svg class="icono-nav" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 12h-6l-2 3h-4l-2-3H2" />
            <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" />
          </svg>
          Bandeja
          <span v-if="cantidadBorradores > 0" class="insignia-nav">{{ cantidadBorradores }}</span>
        </router-link>
        <router-link :to="{ name: 'categorias' }" class="item-nav">
          <svg class="icono-nav" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20.59 13.41 12 22 2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z" />
            <circle cx="7" cy="7" r="1.5" fill="currentColor" stroke="none" />
          </svg>
          Categorías
        </router-link>
        <router-link :to="{ name: 'presupuestos' }" class="item-nav">
          <svg class="icono-nav" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M3 10h18" />
            <path d="M8 15h4" />
          </svg>
          Presupuestos
        </router-link>
        <button type="button" class="item-nav item-nav-boton" @click="abrirModalRegistrar">
          <svg class="icono-nav" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Registrar gasto
        </button>
      </nav>

      <div class="bloque-cuenta">
        <div class="avatar">{{ inicialUsuario }}</div>
        <div class="datos-cuenta">
          <p class="nombre-cuenta">{{ nombreUsuario }}</p>
          <p class="email-cuenta">{{ emailUsuario }}</p>
        </div>
        <button type="button" class="boton-salir" title="Cerrar sesión" @click="manejarSalir">
          <svg class="icono-nav" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
        </button>
      </div>

      <p class="texto-version">
        <template v-if="commitCompleto">
          <button type="button" class="hash-commit" title="Copiar hash de commit" @click="copiarCommit">
            {{ textoVersion }}
          </button>
          <span v-if="commitCopiado" class="confirmacion-copiado">Copiado</span>
        </template>
        <template v-else>
          {{ textoVersion }}
        </template>
      </p>
    </aside>

    <main class="contenido">
      <router-view />
    </main>

    <nav class="navegacion-inferior" v-show="!storeUi.modalAbierto">
      <router-link :to="{ name: 'dashboard' }" class="item-nav-movil">
        <svg class="icono-nav" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="8" height="8" rx="1.5" />
          <rect x="13" y="3" width="8" height="5" rx="1.5" />
          <rect x="13" y="10" width="8" height="11" rx="1.5" />
          <rect x="3" y="13" width="8" height="8" rx="1.5" />
        </svg>
        Dashboard
      </router-link>
      <router-link :to="{ name: 'historial' }" class="item-nav-movil">
        <svg class="icono-nav" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
        </svg>
        Historial
      </router-link>
      <router-link :to="{ name: 'bandeja' }" class="item-nav-movil">
        <span class="envoltorio-icono-movil">
          <svg class="icono-nav" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 12h-6l-2 3h-4l-2-3H2" />
            <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" />
          </svg>
          <span v-if="cantidadBorradores > 0" class="insignia-nav insignia-nav-movil">{{ cantidadBorradores }}</span>
        </span>
        Bandeja
      </router-link>
      <router-link :to="{ name: 'categorias' }" class="item-nav-movil">
        <svg class="icono-nav" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20.59 13.41 12 22 2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z" />
          <circle cx="7" cy="7" r="1.5" fill="currentColor" stroke="none" />
        </svg>
        Categorías
      </router-link>
      <router-link :to="{ name: 'presupuestos' }" class="item-nav-movil">
        <svg class="icono-nav" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 10h18" />
          <path d="M8 15h4" />
        </svg>
        Presupuestos
      </router-link>
      <button type="button" class="boton-fab" title="Registrar gasto" @click="abrirModalRegistrar">
        <svg class="icono-fab" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
      <button type="button" class="item-nav-movil" @click="manejarSalir">
        <svg class="icono-nav" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
        </svg>
        Salir
      </button>
    </nav>

    <ModalGasto v-if="modalAbierto" @cerrar="cerrarModal" @guardado="manejarGuardado" />
  </div>
</template>

<style scoped>
.shell {
  min-height: 100vh;
  background: var(--color-fondo-app);
  display: flex;
}

.barra-lateral {
  display: none;
}

.logo-marca {
  display: flex;
  align-items: center;
  gap: var(--espacio-3);
  padding: 0 var(--espacio-2);
}

.logo-cuadro {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--color-primario);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 1.1rem;
}

.logo-texto {
  font-weight: 700;
  font-size: 1.1rem;
  color: var(--color-texto);
}

.navegacion {
  display: flex;
  flex-direction: column;
  gap: var(--espacio-1);
  margin-top: var(--espacio-8);
}

.item-nav {
  display: flex;
  align-items: center;
  gap: var(--espacio-3);
  padding: var(--espacio-3);
  border-radius: var(--radio-borde);
  color: var(--color-texto-secundario);
  text-decoration: none;
  font-weight: 600;
  font-size: 0.95rem;
  border: none;
  background: none;
  width: 100%;
  text-align: left;
  cursor: pointer;
  font-family: var(--fuente-base);
}

.item-nav:hover {
  background: #f1f3f2;
}

.item-nav.router-link-active {
  background: #e2f4f1;
  color: #0b7a6e;
}

.icono-nav {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.insignia-nav {
  margin-left: auto;
  background: var(--color-error);
  color: #fff;
  font-size: 0.7rem;
  font-weight: 700;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.envoltorio-icono-movil {
  position: relative;
  display: inline-flex;
}

.insignia-nav-movil {
  position: absolute;
  top: -6px;
  right: -8px;
  margin-left: 0;
}

.bloque-cuenta {
  margin-top: auto;
  display: flex;
  align-items: center;
  gap: var(--espacio-3);
  padding: var(--espacio-3);
  border-top: 1px solid var(--color-borde-tarjeta);
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--color-primario);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  flex-shrink: 0;
}

.datos-cuenta {
  flex: 1;
  min-width: 0;
}

.nombre-cuenta {
  margin: 0;
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--color-texto);
  text-transform: capitalize;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.email-cuenta {
  margin: 0;
  font-size: 0.8rem;
  color: var(--color-texto-terciario);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.boton-salir {
  background: none;
  border: none;
  color: var(--color-texto-terciario);
  cursor: pointer;
  padding: var(--espacio-2);
  border-radius: 10px;
}
.boton-salir:hover {
  background: #f1f3f2;
  color: var(--color-error);
}

.texto-version {
  margin: var(--espacio-2) 0 0;
  padding: 0 var(--espacio-3);
  font-size: var(--tamano-pequeno);
  color: var(--color-texto-terciario);
  display: flex;
  align-items: center;
  gap: var(--espacio-2);
}

.hash-commit {
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  font: inherit;
  color: inherit;
  cursor: pointer;
}

.hash-commit:hover {
  color: var(--color-texto-secundario);
}

.confirmacion-copiado {
  color: var(--color-primario);
  font-weight: 600;
}

.contenido {
  flex: 1;
  min-width: 0;
  padding-bottom: 88px;
}

.navegacion-inferior {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: space-around;
  background: var(--color-fondo);
  border-top: 1px solid var(--color-borde-tarjeta);
  padding: var(--espacio-2) var(--espacio-4);
  z-index: 50;
}

.item-nav-movil {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  font-size: 0.7rem;
  color: var(--color-texto-secundario);
  text-decoration: none;
  background: none;
  border: none;
  cursor: pointer;
  font-family: var(--fuente-base);
}

.item-nav-movil.router-link-active {
  color: #0b7a6e;
}

.boton-fab {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--color-primario);
  color: #fff;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  margin-top: -24px;
  box-shadow: 0 4px 12px rgba(14, 147, 132, 0.35);
}
.boton-fab:hover {
  background: var(--color-primario-hover);
}

.icono-fab {
  width: 24px;
  height: 24px;
}

@media (min-width: 900px) {
  .barra-lateral {
    display: flex;
    flex-direction: column;
    width: 252px;
    flex-shrink: 0;
    padding: var(--espacio-6) var(--espacio-4);
    background: var(--color-fondo);
    border-right: 1px solid var(--color-borde-tarjeta);
    position: sticky;
    top: 0;
    height: 100vh;
  }

  .navegacion-inferior {
    display: none;
  }

  .contenido {
    padding-bottom: 0;
  }
}
</style>
