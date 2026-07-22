// deno-lint-ignore-file
// supabase/functions/importar-borrador/index.ts
// Edge Function de ingesta de gastos por correo (HU-5.1). Contrato definido
// por Architect en Fase 0, aplicado tal cual (ver dev-plan.md):
//
// - Autenticación: bearer contra el secreto dedicado `IMPORTAR_BORRADOR_TOKEN`
//   (nunca se expone en frontend; solo la llama el proceso backend que lee el
//   correo). Se usa un token dedicado, distinto del `service_role`, siguiendo
//   el hallazgo de auditoría AUD-SOD-01: el `service_role` sigue empleándose
//   igual, pero solo internamente, para el `createClient`.
// - `usuario_id` SIEMPRE es el fijo del servidor: el del payload, si viene,
//   se ignora (no falsificable).
// - `estado='revision_manual'` si `ambiguo:true` o falta `monto`/`moneda`
//   (permitido desde la migración 003, que hace esas columnas nullable).
// - Sin `categoria_id`: se asigna la categoría "Otros" del usuario fijo
//   (sembrada por la migración 003).
// - Idempotencia: el índice único parcial `(usuario_id, gmail_message_id)`
//   produce el código Postgres 23505 en reimportes; se captura y responde
//   200 {status:"omitido"} en vez de propagar el error.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { resolverEstado, validarPayload, type PayloadImportarBorrador } from './logica.ts'

/** Código de error de Postgres para violación de restricción `unique`. */
const CODIGO_POSTGRES_UNICIDAD = '23505'
/** Nombre de la categoría de respaldo cuando el payload no trae `categoria_id`. */
const NOMBRE_CATEGORIA_OTROS = 'Otros'

const cabecerasJson = { 'Content-Type': 'application/json' }

function respuestaJson(cuerpo: unknown, status: number): Response {
  return new Response(JSON.stringify(cuerpo), { status, headers: cabecerasJson })
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return respuestaJson({ status: 'error', motivo: 'método no soportado' }, 405)
  }

  // --- Autenticación: el bearer debe coincidir con el token dedicado de esta función. ---
  const tokenEsperado = Deno.env.get('IMPORTAR_BORRADOR_TOKEN')
  const autorizacion = req.headers.get('Authorization') ?? ''
  const bearerRecibido = autorizacion.startsWith('Bearer ') ? autorizacion.slice('Bearer '.length) : ''
  if (!tokenEsperado || bearerRecibido !== tokenEsperado) {
    return respuestaJson({ status: 'error', motivo: 'no autorizado' }, 401)
  }

  // --- Parseo del body. ---
  let payload: PayloadImportarBorrador
  try {
    payload = await req.json()
  } catch {
    return respuestaJson({ status: 'error', motivo: 'validación' }, 400)
  }

  // --- Validación de negocio (siempre en el servidor, nunca confiada al cliente). ---
  const validacion = validarPayload(payload)
  if (!validacion.valido) {
    return respuestaJson({ status: 'error', motivo: validacion.motivo }, 400)
  }

  // --- usuario_id FIJO del servidor: el del payload (si viene) se ignora. ---
  const usuarioId = Deno.env.get('GASTORIN_USUARIO_ID')
  if (!usuarioId) {
    return respuestaJson({ status: 'error', motivo: 'usuario fijo no configurado' }, 500)
  }

  const urlSupabase = Deno.env.get('SUPABASE_URL')
  if (!urlSupabase) {
    return respuestaJson({ status: 'error', motivo: 'configuración de Supabase ausente' }, 500)
  }

  // El `service_role` sigue usándose igual, pero solo internamente, para el
  // `createClient` (nunca se compara contra el bearer recibido).
  const claveServicio = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!claveServicio) {
    return respuestaJson({ status: 'error', motivo: 'configuración de Supabase ausente' }, 500)
  }

  const supabase = createClient(urlSupabase, claveServicio)

  // --- Resuelve la categoría: la del payload, o "Otros" del usuario fijo. ---
  let categoriaId = typeof payload.categoria_id === 'string' ? payload.categoria_id : null
  if (!categoriaId) {
    const { data: categoriaOtros, error: errorCategoria } = await supabase
      .from('categorias')
      .select('id')
      .eq('usuario_id', usuarioId)
      .eq('nombre', NOMBRE_CATEGORIA_OTROS)
      .single()
    if (errorCategoria || !categoriaOtros) {
      return respuestaJson(
        { status: 'error', motivo: 'no existe la categoría "Otros" para el usuario' },
        400,
      )
    }
    categoriaId = categoriaOtros.id as string
  }

  const estado = resolverEstado(payload)

  const { data: gastoInsertado, error: errorInsercion } = await supabase
    .from('gastos')
    .insert({
      usuario_id: usuarioId,
      categoria_id: categoriaId,
      monto: typeof payload.monto === 'number' ? payload.monto : null,
      moneda: payload.moneda === 'PEN' || payload.moneda === 'USD' ? payload.moneda : null,
      fecha: payload.fecha,
      descripcion: typeof payload.descripcion === 'string' ? payload.descripcion : null,
      origen: 'correo',
      estado,
      gmail_message_id: payload.gmail_message_id,
      gmail_fragmento: typeof payload.gmail_fragmento === 'string' ? payload.gmail_fragmento : null,
    })
    .select('id')
    .single()

  if (errorInsercion) {
    // Reimporte del mismo correo: el índice único parcial captura la
    // violación y se responde "omitido" en vez de propagar el error.
    if (errorInsercion.code === CODIGO_POSTGRES_UNICIDAD) {
      return respuestaJson({ status: 'omitido', motivo: 'ya existe' }, 200)
    }
    return respuestaJson({ status: 'error', motivo: 'no se pudo guardar el gasto' }, 500)
  }

  return respuestaJson({ status: 'creado', gasto_id: gastoInsertado.id }, 201)
})
