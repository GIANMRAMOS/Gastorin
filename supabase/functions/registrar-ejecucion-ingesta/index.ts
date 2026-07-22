// deno-lint-ignore-file
// supabase/functions/registrar-ejecucion-ingesta/index.ts
// Edge Function que deja constancia de cada corrida de la ingesta automática
// de gastos por correo (HU-5.5), para que la Bandeja pueda avisar si la
// revisión programada dejó de ejecutarse. Calca la estructura de
// `importar-borrador/index.ts` (ver dev-plan.md):
//
// - Autenticación: bearer contra el mismo token dedicado `IMPORTAR_BORRADOR_TOKEN`
//   que usa `importar-borrador` (el `service_role` se usa igual, solo
//   internamente, para el `createClient`).
// - `usuario_id` SIEMPRE es el fijo del servidor: no depende de ningún body.
// - No requiere payload: no falla si la request llega sin body.
// - UPSERT sobre la PK `usuario_id` de `estado_ingesta` con la marca de tiempo actual.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const cabecerasJson = { 'Content-Type': 'application/json' }

function respuestaJson(cuerpo: unknown, status: number): Response {
  return new Response(JSON.stringify(cuerpo), { status, headers: cabecerasJson })
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return respuestaJson({ status: 'error', motivo: 'método no soportado' }, 405)
  }

  // --- Autenticación: el bearer debe coincidir con el token dedicado de importar-borrador. ---
  const tokenEsperado = Deno.env.get('IMPORTAR_BORRADOR_TOKEN')
  const autorizacion = req.headers.get('Authorization') ?? ''
  const bearerRecibido = autorizacion.startsWith('Bearer ') ? autorizacion.slice('Bearer '.length) : ''
  if (!tokenEsperado || bearerRecibido !== tokenEsperado) {
    return respuestaJson({ status: 'error', motivo: 'no autorizado' }, 401)
  }

  // --- usuario_id FIJO del servidor: no se lee de ningún payload (no falsificable). ---
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

  const { error: errorUpsert } = await supabase
    .from('estado_ingesta')
    .upsert({ usuario_id: usuarioId, ultima_ejecucion_en: new Date().toISOString() })

  if (errorUpsert) {
    return respuestaJson({ status: 'error', motivo: 'no se pudo registrar la ejecución' }, 500)
  }

  return respuestaJson({ status: 'registrado' }, 201)
})
