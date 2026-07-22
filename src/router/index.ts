import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
    },
    {
      path: '/registro',
      name: 'registro',
      component: () => import('@/views/RegistroView.vue'),
    },
    {
      path: '/recuperar-password',
      name: 'recuperar-password',
      component: () => import('@/views/RecuperarPasswordView.vue'),
    },
    {
      path: '/restablecer-password',
      name: 'restablecer-password',
      component: () => import('@/views/RestablecerPasswordView.vue'),
    },
    {
      // Ruta padre del App Shell: todas las secciones privadas cuelgan de
      // aquí como rutas hijas y comparten sidebar/bottom nav (AppShellLayout).
      path: '/',
      component: () => import('@/layouts/AppShellLayout.vue'),
      meta: { requiereAuth: true },
      children: [
        {
          path: '',
          redirect: { name: 'dashboard' },
        },
        {
          path: 'dashboard',
          name: 'dashboard',
          component: () => import('@/views/DashboardView.vue'),
        },
        {
          path: 'historial',
          name: 'historial',
          component: () => import('@/views/HistorialView.vue'),
        },
        {
          path: 'bandeja',
          name: 'bandeja',
          component: () => import('@/views/BandejaView.vue'),
        },
        {
          path: 'categorias',
          name: 'categorias',
          component: () => import('@/views/CategoriasView.vue'),
        },
        {
          path: 'presupuestos',
          name: 'presupuestos',
          component: () => import('@/views/PresupuestosView.vue'),
        },
      ],
    },
  ],
})

// Guard global: cualquier ruta cuyo árbol de coincidencias tenga
// `meta.requiereAuth` (propio o heredado de un padre, como el App Shell)
// exige sesión activa; el resto es público.
router.beforeEach((destino) => {
  const store = useAuthStore()
  const requiereAuth = destino.matched.some((ruta) => ruta.meta.requiereAuth)

  if (requiereAuth && !store.estaAutenticado) {
    return { name: 'login' }
  }
})

export default router
