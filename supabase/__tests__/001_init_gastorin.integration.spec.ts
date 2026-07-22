import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Test de INTEGRACIÓN de la migración `supabase/migrations/001_init_gastorin.sql`.
 *
 * QUÉ CUBRE
 * - Que el esquema aplicado (tablas `categorias`/`gastos`/`presupuestos`, enums,
 *   checks) se comporta como se espera desde el cliente (inserts válidos pasan,
 *   inválidos son rechazados por Postgres).
 * - Que RLS está habilitado y las policies `*_por_usuario` aíslan los datos:
 *   un usuario no puede ver, editar ni borrar filas de otro usuario, y un
 *   cliente sin sesión (anon) no ve ninguna fila.
 * - Camino feliz de aislamiento entre dos usuarios reales creados en el
 *   proyecto de prueba.
 *
 * *** ESTE ARCHIVO ESTÁ ESCRITO PERO NO SE EJECUTA CONTRA NINGÚN PROYECTO ***
 * *** SUPABASE REAL. El único proyecto Supabase disponible en este repo es  ***
 * *** el personal/productivo de Gianmarco (ver `.env.local`), y correr este ***
 * *** archivo contra él crearía usuarios y filas de prueba en datos reales. ***
 *
 * La suite completa queda gateada por tres variables de entorno que deben
 * apuntar a un proyecto Supabase DEDICADO A TESTS (nunca al productivo):
 *
 *   SUPABASE_TEST_URL              -> URL del proyecto de test (https://xxxx.supabase.co)
 *   SUPABASE_TEST_ANON_KEY         -> anon/public key del proyecto de test
 *   SUPABASE_TEST_SERVICE_ROLE_KEY -> service_role key del proyecto de test
 *
 * Si no están definidas, toda la suite se marca `skip` (no se ejecuta, no
 * falla) tanto en local como en CI.
 *
 * CÓMO CORRERLO cuando exista un proyecto de test dedicado:
 *   1. Crear un proyecto Supabase nuevo exclusivo para tests (nunca el de producción).
 *   2. Aplicar la migración: `supabase db push` (o pegar el SQL de
 *      `supabase/migrations/001_init_gastorin.sql` en el SQL editor del proyecto de test).
 *   3. Exportar las variables de entorno, por ejemplo:
 *        export SUPABASE_TEST_URL="https://xxxx.supabase.co"
 *        export SUPABASE_TEST_ANON_KEY="ey..."
 *        export SUPABASE_TEST_SERVICE_ROLE_KEY="ey..."
 *   4. Ejecutar solo esta suite:
 *        npx vitest run supabase/__tests__/001_init_gastorin.integration.spec.ts
 *   5. Los usuarios de prueba se crean con `signUp` y se limpian con la
 *      service_role key en `afterAll` (borrado en cascada por `on delete cascade`
 *      en las FKs a `auth.users`). Si el proyecto de test exige confirmación
 *      de email, desactivar "Confirm email" en Auth > Providers > Email para
 *      que `signUp` deje sesión activa inmediatamente.
 */

const SUPABASE_TEST_URL = process.env.SUPABASE_TEST_URL
const SUPABASE_TEST_ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY
const SUPABASE_TEST_SERVICE_ROLE_KEY = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY

const tieneCredencialesDeTest = Boolean(
  SUPABASE_TEST_URL && SUPABASE_TEST_ANON_KEY && SUPABASE_TEST_SERVICE_ROLE_KEY,
)

/** Genera un email único por corrida para no chocar con usuarios previos del proyecto de test. */
function emailDePrueba(etiqueta: string) {
  return `gastorin-test-${etiqueta}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
}

const PASSWORD_DE_PRUEBA = 'PasswordDePrueba123!'

describe.skipIf(!tieneCredencialesDeTest)('migración 001_init_gastorin (integración real)', () => {
  let clienteAnon: SupabaseClient
  let clienteServicio: SupabaseClient
  let clienteUsuarioA: SupabaseClient
  let clienteUsuarioB: SupabaseClient
  let usuarioAId: string
  let usuarioBId: string
  const idsUsuariosCreados: string[] = []

  beforeAll(async () => {
    clienteAnon = createClient(SUPABASE_TEST_URL!, SUPABASE_TEST_ANON_KEY!)
    clienteServicio = createClient(SUPABASE_TEST_URL!, SUPABASE_TEST_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    clienteUsuarioA = createClient(SUPABASE_TEST_URL!, SUPABASE_TEST_ANON_KEY!)
    const { data: dataA, error: errorA } = await clienteUsuarioA.auth.signUp({
      email: emailDePrueba('usuario-a'),
      password: PASSWORD_DE_PRUEBA,
    })
    if (errorA || !dataA.user) {
      throw new Error(`No se pudo crear usuario A de prueba: ${errorA?.message}`)
    }
    usuarioAId = dataA.user.id
    idsUsuariosCreados.push(usuarioAId)

    clienteUsuarioB = createClient(SUPABASE_TEST_URL!, SUPABASE_TEST_ANON_KEY!)
    const { data: dataB, error: errorB } = await clienteUsuarioB.auth.signUp({
      email: emailDePrueba('usuario-b'),
      password: PASSWORD_DE_PRUEBA,
    })
    if (errorB || !dataB.user) {
      throw new Error(`No se pudo crear usuario B de prueba: ${errorB?.message}`)
    }
    usuarioBId = dataB.user.id
    idsUsuariosCreados.push(usuarioBId)
  })

  afterAll(async () => {
    // Borrado con service_role: cascada elimina categorias/gastos/presupuestos del usuario.
    for (const id of idsUsuariosCreados) {
      await clienteServicio.auth.admin.deleteUser(id)
    }
  })

  describe('RLS habilitado', () => {
    it('un cliente sin sesión (anon) no ve ninguna fila de categorias', async () => {
      const { data, error } = await clienteAnon.from('categorias').select('*')

      // Con RLS habilitado y sin `auth.uid()`, la policy `usuario_id = auth.uid()`
      // nunca matchea (auth.uid() es null): el select debe volver vacío, no un error.
      expect(error).toBeNull()
      expect(data).toEqual([])
    })

    it('un cliente sin sesión (anon) no puede insertar categorias', async () => {
      const { error } = await clienteAnon.from('categorias').insert({
        usuario_id: usuarioAId,
        nombre: 'Intento anon',
      })

      expect(error).not.toBeNull()
    })
  })

  describe('esquema y checks de negocio', () => {
    it('camino feliz: usuario A crea una categoría propia', async () => {
      const { data, error } = await clienteUsuarioA
        .from('categorias')
        .insert({ usuario_id: usuarioAId, nombre: 'Comida' })
        .select()
        .single()

      expect(error).toBeNull()
      expect(data?.usuario_id).toBe(usuarioAId)
      expect(data?.predefinida).toBe(false)
      expect(data?.activa).toBe(true)
    })

    it('borde: la migración rechaza monto <= 0 en gastos (check monto > 0)', async () => {
      const { data: categoria } = await clienteUsuarioA
        .from('categorias')
        .insert({ usuario_id: usuarioAId, nombre: `Categoria-monto-${Date.now()}` })
        .select()
        .single()

      const { error } = await clienteUsuarioA.from('gastos').insert({
        usuario_id: usuarioAId,
        categoria_id: categoria!.id,
        monto: 0,
        moneda: 'PEN',
        fecha: '2026-07-01',
      })

      expect(error).not.toBeNull()
      // Postgres: violación de check constraint.
      expect(error?.message).toMatch(/check constraint|monto/i)
    })

    it('borde: la migración rechaza gmail_message_id en un gasto con origen manual', async () => {
      const { data: categoria } = await clienteUsuarioA
        .from('categorias')
        .insert({ usuario_id: usuarioAId, nombre: `Categoria-origen-${Date.now()}` })
        .select()
        .single()

      const { error } = await clienteUsuarioA.from('gastos').insert({
        usuario_id: usuarioAId,
        categoria_id: categoria!.id,
        monto: 10,
        moneda: 'PEN',
        fecha: '2026-07-01',
        origen: 'manual',
        gmail_message_id: 'msg-123',
      })

      expect(error).not.toBeNull()
    })

    it('borde: la migración rechaza estado revision_manual cuando el origen no es correo', async () => {
      const { data: categoria } = await clienteUsuarioA
        .from('categorias')
        .insert({ usuario_id: usuarioAId, nombre: `Categoria-estado-${Date.now()}` })
        .select()
        .single()

      const { error } = await clienteUsuarioA.from('gastos').insert({
        usuario_id: usuarioAId,
        categoria_id: categoria!.id,
        monto: 10,
        moneda: 'PEN',
        fecha: '2026-07-01',
        origen: 'manual',
        estado: 'revision_manual',
      })

      expect(error).not.toBeNull()
    })

    it('borde: la migración rechaza monedas fuera del enum moneda_tipo', async () => {
      const { data: categoria } = await clienteUsuarioA
        .from('categorias')
        .insert({ usuario_id: usuarioAId, nombre: `Categoria-moneda-${Date.now()}` })
        .select()
        .single()

      const { error } = await clienteUsuarioA.from('gastos').insert({
        usuario_id: usuarioAId,
        categoria_id: categoria!.id,
        monto: 10,
        moneda: 'EUR',
        fecha: '2026-07-01',
      })

      expect(error).not.toBeNull()
    })

    it('camino feliz: presupuestos respeta unique(usuario_id, categoria_id, mes, moneda)', async () => {
      const { data: categoria } = await clienteUsuarioA
        .from('categorias')
        .insert({ usuario_id: usuarioAId, nombre: `Categoria-presupuesto-${Date.now()}` })
        .select()
        .single()

      const filaPresupuesto = {
        usuario_id: usuarioAId,
        categoria_id: categoria!.id,
        mes: '2026-07-01',
        moneda: 'PEN' as const,
        monto_limite: 500,
      }

      const primero = await clienteUsuarioA.from('presupuestos').insert(filaPresupuesto)
      expect(primero.error).toBeNull()

      const duplicado = await clienteUsuarioA.from('presupuestos').insert(filaPresupuesto)
      expect(duplicado.error).not.toBeNull()
    })
  })

  describe('aislamiento entre dos usuarios (RLS)', () => {
    let categoriaDeA: { id: string }

    it('camino feliz: usuario A crea categoría y gasto propios', async () => {
      const { data: categoria, error: errorCategoria } = await clienteUsuarioA
        .from('categorias')
        .insert({ usuario_id: usuarioAId, nombre: `Aislamiento-${Date.now()}` })
        .select()
        .single()
      expect(errorCategoria).toBeNull()
      categoriaDeA = categoria!

      const { error: errorGasto } = await clienteUsuarioA.from('gastos').insert({
        usuario_id: usuarioAId,
        categoria_id: categoriaDeA.id,
        monto: 25.5,
        moneda: 'PEN',
        fecha: '2026-07-10',
        descripcion: 'Almuerzo',
      })
      expect(errorGasto).toBeNull()
    })

    it('el usuario B no ve las categorías ni gastos del usuario A', async () => {
      const { data: categoriasVistasPorB } = await clienteUsuarioB
        .from('categorias')
        .select('*')
        .eq('usuario_id', usuarioAId)
      expect(categoriasVistasPorB).toEqual([])

      const { data: gastosVistosPorB } = await clienteUsuarioB
        .from('gastos')
        .select('*')
        .eq('usuario_id', usuarioAId)
      expect(gastosVistosPorB).toEqual([])
    })

    it('el usuario B no puede actualizar una categoría del usuario A', async () => {
      const { data, error } = await clienteUsuarioB
        .from('categorias')
        .update({ nombre: 'Hackeado' })
        .eq('id', categoriaDeA.id)
        .select()

      // RLS bloquea el update: no hay error explícito, pero tampoco filas afectadas.
      expect(error).toBeNull()
      expect(data).toEqual([])

      const { data: sigueIgual } = await clienteServicio
        .from('categorias')
        .select('nombre')
        .eq('id', categoriaDeA.id)
        .single()
      expect(sigueIgual?.nombre).not.toBe('Hackeado')
    })

    it('el usuario B no puede borrar una categoría del usuario A', async () => {
      const { data } = await clienteUsuarioB
        .from('categorias')
        .delete()
        .eq('id', categoriaDeA.id)
        .select()
      expect(data).toEqual([])

      const { data: sigueExistiendo } = await clienteServicio
        .from('categorias')
        .select('id')
        .eq('id', categoriaDeA.id)
        .single()
      expect(sigueExistiendo?.id).toBe(categoriaDeA.id)
    })

    it('el usuario A sigue viendo únicamente sus propias filas', async () => {
      const { data: propias } = await clienteUsuarioA.from('categorias').select('usuario_id')
      expect(propias!.length).toBeGreaterThan(0)
      expect(propias!.every((fila) => fila.usuario_id === usuarioAId)).toBe(true)
    })
  })
})

describe.skipIf(tieneCredencialesDeTest)('migración 001_init_gastorin (integración real)', () => {
  it.skip(
    'no ejecutado: faltan SUPABASE_TEST_URL/SUPABASE_TEST_ANON_KEY/SUPABASE_TEST_SERVICE_ROLE_KEY (ver comentario de cabecera)',
    () => {},
  )
})
