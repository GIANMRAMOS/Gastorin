<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import ModalGasto from '@/components/ModalGasto.vue'
import ModalIngreso from '@/components/ModalIngreso.vue'
import HojaAccionesFab from '@/components/HojaAccionesFab.vue'
import TextoVersion from '@/components/TextoVersion.vue'
import { useAuth } from '@/composables/useAuth'
import { useVersion } from '@/composables/useVersion'
import { useBancos } from '@/composables/useBancos'
import { useCategorias } from '@/composables/useCategorias'
import { usePresupuestos } from '@/composables/usePresupuestos'
import { useBandeja } from '@/composables/useBandeja'
import { cargarResumenPorMoneda, proyeccionCierreMes } from '@/composables/useDashboard'
import { useMoneda } from '@/composables/useMoneda'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { useGastosStore } from '@/stores/gastos'
import { supabase } from '@/lib/supabaseClient'
import type { Gasto } from '@/types/gasto'

/**
 * App Shell "Caudal" (Fase 1 del rediseño) de las secciones privadas: sidebar
 * en escritorio (≥900px, orden Dashboard/Ingresos/Egresos/Bandeja/Presupuesto/
 * Gráficos/Maestros + grupo transitorio Categorías/Bancos, ver GATE1-#1 de
 * `dev-plan.md`) y bottom nav en móvil (<900px). El registro de gastos/
 * ingresos sigue centralizado aquí: en móvil el FAB "+" abre la hoja de
 * acciones; en escritorio, el botón "+ Registrar" de cada vista (dentro de
 * `<main>`, ej. `DashboardView`) no puede montar `HojaAccionesFab`
 * directamente (el shell es la ruta padre), así que media por
 * `useUiStore.hojaAccionesAbierta` (GATE1-#2): cualquier vista puede abrir la
 * misma hoja sin duplicar este marcado. Incluye además el bloque de cuenta
 * del usuario autenticado y, al fondo del sidebar, la card "Proyección
 * {mes}" (GATE1-#3): visible en TODA ruta (no solo el Dashboard), por eso
 * hace su propio fetch ligero de gastos confirmados del mes + presupuestos,
 * en vez de depender de que `DashboardView` ya los haya cargado.
 */
const router = useRouter()
const storeAuth = useAuthStore()
const storeUi = useUiStore()
const storeGastos = useGastosStore()
const { cerrarSesion } = useAuth()
const { textoVersion, commitCompleto } = useVersion()
const { cargarBancos } = useBancos()
const { cargarCategorias } = useCategorias()
const { cargarPresupuestos } = usePresupuestos()
const { cargarBorradores } = useBandeja()
const { formatearMonto } = useMoneda()

const modalGastoAbierto = ref(false)
const modalIngresoAbierto = ref(false)

/**
 * Gastos confirmados del mes en curso: fetch propio y ligero del shell (GATE1-#3),
 * solo para la card "Proyección" del sidebar. NO reutiliza `useDashboard`
 * (trae una ventana de 6 meses, pensada para las tendencias del Dashboard;
 * sería un fetch mucho más pesado del que necesita esta card).
 */
const gastosDelMesShell = ref<Gasto[]>([])

/** Cantidad de borradores pendientes de confirmar, para el badge del ítem "Bandeja". */
const cantidadBorradores = computed(() => storeGastos.borradores.length)

/** Correo del usuario autenticado, o cadena vacía si aún no se resolvió. */
const emailUsuario = computed(() => storeAuth.usuario?.email ?? '')

/** Nombre para mostrar: como el registro solo pide email, se deriva de su parte local. */
const nombreUsuario = computed(() => emailUsuario.value.split('@')[0] || 'Usuario')

/** Inicial para el avatar circular del bloque de cuenta. */
const inicialUsuario = computed(() => nombreUsuario.value.charAt(0).toUpperCase())

/**
 * Primer día del mes actual (`YYYY-MM-01`), acota el fetch ligero de la card
 * "Proyección". Aritmética local a este shell: cada composable/vista que
 * necesita esta fecha calcula la suya (ver nota equivalente en
 * `useDashboard.ts`/`usePresupuestos.ts`); no se extrae un helper compartido
 * en este build (ver "Sugerencias fuera de alcance" de `dev-plan.md`).
 */
function primerDiaMesActual(): string {
  const ahora = new Date()
  const anio = ahora.getFullYear()
  const mes = String(ahora.getMonth() + 1).padStart(2, '0')
  return `${anio}-${mes}-01`
}

/** Día del mes actual (1-31), base de la proyección de cierre de mes. */
const diaActual = computed(() => new Date().getDate())

/** Cantidad de días del mes actual (28-31), base de la proyección de cierre de mes. */
const diasDelMes = computed(() => {
  const ahora = new Date()
  return new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0).getDate()
})

/** Nombre del mes actual, capitalizado, para el título "Proyección {mes}" de la card. */
const nombreMesActual = computed(() => {
  const nombre = new Intl.DateTimeFormat('es-PE', { month: 'long' }).format(new Date())
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)}`
})

/**
 * Gastado del mes en PEN: el sidebar no tiene selector de moneda propio (se
 * ve en toda ruta, no solo el Dashboard), así que PEN se asume como moneda
 * base de esta card (supuesto honesto, ver `dev-plan.md`).
 */
const gastadoMesPEN = computed(
  () => cargarResumenPorMoneda(gastosDelMesShell.value, primerDiaMesActual()).PEN.total,
)

/** Límite total de presupuesto del mes en PEN (hidratado por `cargarPresupuestos` en el `onMounted` de este shell). */
const limitePresupuestoPEN = computed(() =>
  storeGastos.presupuestos
    .filter((presupuesto) => presupuesto.moneda === 'PEN')
    .reduce((total, presupuesto) => total + presupuesto.monto_limite, 0),
)

/** Proyección de cierre de mes (extrapolación lineal), misma función pura que usa `DashboardView`. */
const proyeccionMesPEN = computed(() =>
  proyeccionCierreMes(gastadoMesPEN.value, diaActual.value, diasDelMes.value),
)

const proyeccionMesFormateada = computed(() => formatearMonto(proyeccionMesPEN.value, 'PEN'))

/**
 * Nota bajo el monto proyectado: % sobre el presupuesto configurado (mismo
 * criterio "sin límite → sin %" que `TarjetaPresupuestoResumen`), o un texto
 * genérico si el usuario no tiene presupuesto configurado este mes.
 */
const notaProyeccionMes = computed(() => {
  if (limitePresupuestoPEN.value <= 0) return 'Estimado de cierre de mes'
  const porcentaje = Math.round((proyeccionMesPEN.value / limitePresupuestoPEN.value) * 100)
  return `${porcentaje}% de tu presupuesto de este mes`
})

/** Cierra el modal de alta de gasto sin guardar. */
function cerrarModalGasto() {
  modalGastoAbierto.value = false
}

/** Tras guardar el gasto, cierra el modal (la lista se refresca sola vía store). */
function manejarGuardadoGasto() {
  modalGastoAbierto.value = false
}

/** Cierra el modal de alta de ingreso sin guardar. */
function cerrarModalIngreso() {
  modalIngresoAbierto.value = false
}

/** Tras guardar el ingreso, cierra el modal (la lista se refresca sola vía store). */
function manejarGuardadoIngreso() {
  modalIngresoAbierto.value = false
}

/** Abre la hoja de acciones (FAB móvil o "+ Registrar" de cualquier vista, vía `useUiStore`). */
function abrirHoja() {
  storeUi.abrirHojaAcciones()
}

/** Cierra la hoja de acciones sin abrir ningún modal. */
function cerrarHoja() {
  storeUi.cerrarHojaAcciones()
}

/** La hoja pidió registrar un gasto: la cierra y abre `ModalGasto`. */
function elegirRegistrarGastoDesdeHoja() {
  storeUi.cerrarHojaAcciones()
  modalGastoAbierto.value = true
}

/** La hoja pidió registrar un ingreso: la cierra y abre `ModalIngreso`. */
function elegirRegistrarIngresoDesdeHoja() {
  storeUi.cerrarHojaAcciones()
  modalIngresoAbierto.value = true
}

/** Cierra la sesión del usuario y redirige al login. */
async function manejarSalir() {
  const exito = await cerrarSesion()
  if (exito) {
    router.push({ name: 'login' })
  }
}

/** Carga liviana de los gastos confirmados del mes en curso, solo para la card "Proyección" (GATE1-#3). */
async function cargarGastosDelMesShell() {
  const { data, error } = await supabase
    .from('gastos')
    .select()
    .eq('estado', 'confirmado')
    .gte('fecha', primerDiaMesActual())
    .order('fecha', { ascending: false })
  if (!error) {
    gastosDelMesShell.value = (data ?? []) as Gasto[]
  }
}

/**
 * Hidrata el catálogo compartido de bancos y categorías, los borradores
 * pendientes (para el badge de "Bandeja", visible en TODA ruta) y los datos
 * de la card "Proyección" (gastos del mes + presupuestos), apenas se monta
 * el shell. Este es el único componente garantizado activo antes de que
 * cualquier modal (gasto/ingreso) pueda abrirse o cualquier ruta hija se
 * muestre: si esa carga viviera solo en el `onMounted` de cada vista, abrir
 * "Nuevo gasto" desde una vista que no cargó bancos/categorías (p. ej. el
 * Dashboard, sin haber visitado antes Historial/Bancos) mostraba "No hay
 * bancos/categorías; créalos primero." aunque sí existieran en BD — el mismo
 * problema aplicaba al badge de borradores: entrar por deep-link/refresh a
 * una ruta que no fuera Dashboard/Bandeja lo mostraba en 0 aunque hubiera
 * borradores reales en BD. Las llamadas equivalentes en las vistas se
 * mantienen (son fire-and-forget y baratas): sirven como refresh de sesión
 * al navegar. `cargarPresupuestos`/`cargarBorradores` pueden repetirse si el
 * usuario está en el propio Dashboard/Bandeja (que también los llaman):
 * mismo store, costo de fetch duplicado aceptado (GATE1-#3).
 */
onMounted(() => {
  cargarBancos()
  cargarCategorias()
  cargarGastosDelMesShell()
  cargarPresupuestos()
  cargarBorradores()
})
</script>

<template>
  <div class="shell">
    <aside class="barra-lateral">
      <div class="logo-marca">
        <span class="logo-cuadro">G</span>
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
        <router-link :to="{ name: 'ingresos' }" class="item-nav">
          <svg class="icono-nav" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
          Ingresos
        </router-link>
        <!-- "Egresos" es el texto visible para la ruta `historial` (gasto histórico); el name de ruta no cambia. -->
        <router-link :to="{ name: 'historial' }" class="item-nav">
          <svg class="icono-nav" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
          </svg>
          Egresos
        </router-link>
        <router-link :to="{ name: 'bandeja' }" class="item-nav">
          <svg class="icono-nav" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 12h-6l-2 3h-4l-2-3H2" />
            <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" />
          </svg>
          Bandeja
          <span v-if="cantidadBorradores > 0" class="insignia-nav">{{ cantidadBorradores }}</span>
        </router-link>
        <!-- El name de ruta sigue siendo "presupuestos"; el texto visible pasa a singular ("Presupuesto", orden Caudal). -->
        <router-link :to="{ name: 'presupuestos' }" class="item-nav">
          <svg class="icono-nav" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M3 10h18" />
            <path d="M8 15h4" />
          </svg>
          Presupuesto
        </router-link>
        <!-- Fase 5 del rediseño "Caudal": ruta stub a `ProximamenteView` (ver GATE1-#1 de dev-plan.md). -->
        <router-link :to="{ name: 'graficos' }" class="item-nav">
          <svg class="icono-nav" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 3v18h18" />
            <path d="m19 9-5 5-4-4-3 3" />
          </svg>
          Gráficos
        </router-link>
        <!-- Fase 6 del rediseño "Caudal": absorberá Categorías/Bancos (ver GATE1-#1 de dev-plan.md). -->
        <router-link :to="{ name: 'maestros' }" class="item-nav">
          <svg class="icono-nav" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m12 2 9 5-9 5-9-5 9-5Z" />
            <path d="m3 12 9 5 9-5" />
            <path d="m3 17 9 5 9-5" />
          </svg>
          Maestros
        </router-link>

        <!-- Grupo transitorio: Categorías/Bancos se absorberán en Maestros (Fase 6). Divisor sutil, no un enlace muerto. -->
        <div class="separador-nav" role="separator" />

        <router-link :to="{ name: 'categorias' }" class="item-nav">
          <svg class="icono-nav" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20.59 13.41 12 22 2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z" />
            <circle cx="7" cy="7" r="1.5" fill="currentColor" stroke="none" />
          </svg>
          Categorías
        </router-link>
        <router-link :to="{ name: 'bancos' }" class="item-nav">
          <svg class="icono-nav" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="6" width="18" height="14" rx="2" />
            <path d="M3 10h18" />
          </svg>
          Bancos
        </router-link>
      </nav>

      <div class="tarjeta-proyeccion">
        <p class="etiqueta-proyeccion">Proyección {{ nombreMesActual }}</p>
        <p class="monto-proyeccion">{{ proyeccionMesFormateada }}</p>
        <p class="nota-proyeccion">{{ notaProyeccionMes }}</p>
      </div>

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

      <TextoVersion :texto-version="textoVersion" :commit-completo="commitCompleto" />
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
      <router-link :to="{ name: 'ingresos' }" class="item-nav-movil">
        <svg class="icono-nav" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
        Ingresos
      </router-link>
      <!-- "Egresos" es el texto visible para la ruta `historial`; el name de ruta no cambia. -->
      <router-link :to="{ name: 'historial' }" class="item-nav-movil">
        <svg class="icono-nav" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
        </svg>
        Egresos
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
      <router-link :to="{ name: 'presupuestos' }" class="item-nav-movil">
        <svg class="icono-nav" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 10h18" />
          <path d="M8 15h4" />
        </svg>
        Presupuesto
      </router-link>
      <router-link :to="{ name: 'graficos' }" class="item-nav-movil">
        <svg class="icono-nav" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 3v18h18" />
          <path d="m19 9-5 5-4-4-3 3" />
        </svg>
        Gráficos
      </router-link>
      <router-link :to="{ name: 'maestros' }" class="item-nav-movil">
        <svg class="icono-nav" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m12 2 9 5-9 5-9-5 9-5Z" />
          <path d="m3 12 9 5 9-5" />
          <path d="m3 17 9 5 9-5" />
        </svg>
        Maestros
      </router-link>
      <router-link :to="{ name: 'categorias' }" class="item-nav-movil">
        <svg class="icono-nav" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20.59 13.41 12 22 2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z" />
          <circle cx="7" cy="7" r="1.5" fill="currentColor" stroke="none" />
        </svg>
        Categorías
      </router-link>
      <router-link :to="{ name: 'bancos' }" class="item-nav-movil">
        <svg class="icono-nav" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="6" width="18" height="14" rx="2" />
          <path d="M3 10h18" />
        </svg>
        Bancos
      </router-link>
      <button type="button" class="boton-fab" title="Registrar" @click="abrirHoja">
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
      <TextoVersion :texto-version="textoVersion" :commit-completo="commitCompleto" class="texto-version-movil" />
    </nav>

    <ModalGasto
      v-if="modalGastoAbierto"
      @cerrar="cerrarModalGasto"
      @guardado="manejarGuardadoGasto"
    />
    <ModalIngreso
      v-if="modalIngresoAbierto"
      @cerrar="cerrarModalIngreso"
      @guardado="manejarGuardadoIngreso"
    />
    <HojaAccionesFab
      v-if="storeUi.hojaAccionesAbierta"
      @cerrar="cerrarHoja"
      @registrar-gasto="elegirRegistrarGastoDesdeHoja"
      @registrar-ingreso="elegirRegistrarIngresoDesdeHoja"
    />
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
  gap: var(--espacio-2);
  padding: 0 var(--espacio-1);
}

.logo-cuadro {
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  border-radius: 8px;
  background: #1a1a18;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 0.85rem;
}

.logo-texto {
  font-weight: 700;
  font-size: 1rem;
  color: var(--color-texto);
}

.navegacion {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.separador-nav {
  height: 1px;
  background: rgba(0, 0, 0, 0.07);
  margin: var(--espacio-2) var(--espacio-1);
}

.item-nav {
  display: flex;
  align-items: center;
  gap: var(--espacio-3);
  padding: 9px 10px;
  border-radius: 8px;
  color: rgba(0, 0, 0, 0.62);
  text-decoration: none;
  font-weight: 500;
  font-size: 0.9rem;
  border: none;
  background: none;
  width: 100%;
  text-align: left;
  cursor: pointer;
  font-family: var(--fuente-base);
}

.item-nav:hover {
  background: rgba(0, 0, 0, 0.04);
}

.item-nav.router-link-active {
  background: #fff;
  color: var(--color-texto);
  font-weight: 500;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}

.icono-nav {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.insignia-nav {
  margin-left: auto;
  background: oklch(0.58 0.13 25);
  color: #fff;
  font-family: var(--fuente-mono);
  font-size: 0.625rem;
  font-weight: 600;
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

.tarjeta-proyeccion {
  margin-top: auto;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.07);
  border-radius: 12px;
  padding: var(--espacio-3);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.etiqueta-proyeccion {
  margin: 0;
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--color-texto-secundario);
}

.monto-proyeccion {
  margin: 0;
  font-family: var(--fuente-mono);
  font-weight: 700;
  font-size: 1.1rem;
  color: var(--color-texto);
}

.nota-proyeccion {
  margin: 0;
  font-size: 0.7rem;
  color: var(--color-texto-terciario);
}

.bloque-cuenta {
  display: flex;
  align-items: center;
  gap: var(--espacio-3);
  padding: var(--espacio-3) var(--espacio-1);
  border-top: 1px solid rgba(0, 0, 0, 0.07);
}

.avatar {
  width: 36px;
  height: 36px;
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
  font-size: 0.85rem;
  color: var(--color-texto);
  text-transform: capitalize;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.email-cuenta {
  margin: 0;
  font-size: 0.75rem;
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
  gap: var(--espacio-2);
  background: var(--color-fondo);
  border-top: 1px solid var(--color-borde-tarjeta);
  padding: var(--espacio-2) var(--espacio-4);
  padding-bottom: calc(var(--espacio-2) + env(safe-area-inset-bottom));
  z-index: 50;
  /* Con 9 rutas + Salir + FAB + versión, el bottom nav no entra en pantallas
     angostas: se permite scroll horizontal contenido en vez de recortar ítems. */
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
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
  flex-shrink: 0;
}

.item-nav-movil.router-link-active {
  color: var(--color-primario);
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
  box-shadow: 0 4px 12px rgba(26, 26, 24, 0.35);
  flex-shrink: 0;
}
.boton-fab:hover {
  background: var(--color-primario-hover);
}

.texto-version-movil {
  flex-shrink: 0;
  padding: 0;
  margin: 0;
  font-size: 0.65rem;
  white-space: nowrap;
}

.icono-fab {
  width: 24px;
  height: 24px;
}

@media (min-width: 900px) {
  .barra-lateral {
    display: flex;
    flex-direction: column;
    width: 212px;
    flex-shrink: 0;
    padding: 20px 14px;
    gap: 26px;
    background: #f4f2ee;
    border-right: 1px solid rgba(0, 0, 0, 0.07);
    position: sticky;
    top: 0;
    height: 100vh;
    box-sizing: border-box;
  }

  .navegacion-inferior {
    display: none;
  }

  .contenido {
    padding-bottom: 0;
  }
}
</style>
