import { beforeEach, describe, expect, it, vi } from 'vitest'

let capturedHandler: ((req: Request) => Promise<Response>) | null = null

const upsertMock = vi.fn()

function crearBuilderUpsert() {
  return {
    upsert: upsertMock,
  }
}

const fromMock = vi.fn(() => crearBuilderUpsert())

vi.mock('https://esm.sh/@supabase/supabase-js@2.45.4', () => ({
  createClient: vi.fn(() => ({ from: fromMock })),
}))

;(globalThis as any).Deno = {
  env: {
    get: (key: string) => {
      const valores: Record<string, string> = {
        IMPORTAR_BORRADOR_TOKEN: 'clave-servicio-test',
        SUPABASE_SERVICE_ROLE_KEY: 'clave-service-role-interna-test',
        GASTORIN_USUARIO_ID: 'usuario-fijo-servidor',
        SUPABASE_URL: 'https://proyecto.supabase.co',
      }
      return valores[key]
    },
  },
  serve: (handler: (req: Request) => Promise<Response>) => {
    capturedHandler = handler
  },
}

async function importarIndex() {
  await import(
    '/Users/gianmarcoramos/Documents/AppScripts/Gastorin/Gastorin/supabase/functions/registrar-ejecucion-ingesta/index.ts'
  )
}

function crearRequest(bearer = 'clave-servicio-test', metodo = 'POST') {
  return new Request('https://edge/registrar-ejecucion-ingesta', {
    method: metodo,
    headers: { Authorization: `Bearer ${bearer}` },
  })
}

describe('Edge Function registrar-ejecucion-ingesta (index.ts)', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    if (!capturedHandler) {
      await importarIndex()
    }
  })

  it('camino feliz: POST con bearer correcto responde 201 "registrado" y hace UPSERT con el usuario fijo del servidor', async () => {
    upsertMock.mockResolvedValueOnce({ data: null, error: null })

    const res = await capturedHandler!(crearRequest())
    const cuerpo = await res.json()

    expect(res.status).toBe(201)
    expect(cuerpo).toEqual({ status: 'registrado' })
    expect(fromMock).toHaveBeenCalledWith('estado_ingesta')
    const argumentoUpsert = upsertMock.mock.calls[0][0]
    expect(argumentoUpsert.usuario_id).toBe('usuario-fijo-servidor')
    expect(typeof argumentoUpsert.ultima_ejecucion_en).toBe('string')
  })

  it('rechaza con 401 si el bearer no coincide con IMPORTAR_BORRADOR_TOKEN', async () => {
    const res = await capturedHandler!(crearRequest('clave-falsa'))
    expect(res.status).toBe(401)
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('rechaza con 405 un método distinto de POST', async () => {
    const res = await capturedHandler!(crearRequest('clave-servicio-test', 'GET'))
    expect(res.status).toBe(405)
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('si el UPSERT falla, responde 500 con motivo genérico (sin filtrar el detalle interno)', async () => {
    upsertMock.mockResolvedValueOnce({
      data: null,
      error: { code: '23503', message: 'foreign key violation' },
    })

    const res = await capturedHandler!(crearRequest())
    const cuerpo = await res.json()

    expect(res.status).toBe(500)
    expect(cuerpo.status).toBe('error')
    expect(cuerpo.motivo).not.toContain('foreign key violation')
  })
})
