import { beforeEach, describe, expect, it, vi } from 'vitest'

let capturedHandler: ((req: Request) => Promise<Response>) | null = null

const insertMock = vi.fn()
const selectSingleMock = vi.fn()

function crearBuilderInsert() {
  return {
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: insertMock,
      })),
    })),
  }
}

function crearBuilderSelectCategoria() {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: selectSingleMock,
        })),
      })),
    })),
  }
}

const fromMock = vi.fn((tabla: string) => {
  if (tabla === 'categorias') return crearBuilderSelectCategoria()
  return crearBuilderInsert()
})

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
  await import('/Users/gianmarcoramos/Documents/AppScripts/Gastorin/Gastorin/supabase/functions/importar-borrador/index.ts')
}

function crearRequest(body: unknown, bearer = 'clave-servicio-test') {
  return new Request('https://edge/importar-borrador', {
    method: 'POST',
    headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('Edge Function importar-borrador (index.ts) — validación independiente', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    if (!capturedHandler) {
      await importarIndex()
    }
  })

  it('usuario_id del payload se IGNORA: el insert siempre usa el usuario_id fijo del servidor', async () => {
    insertMock.mockResolvedValueOnce({ data: { id: 'g1' }, error: null })

    const req = crearRequest({
      gmail_message_id: 'msg-atacante',
      fecha: '2026-07-20',
      monto: 10,
      moneda: 'PEN',
      categoria_id: 'cat-1',
      usuario_id: 'usuario-atacante-malicioso',
    })
    const res = await capturedHandler!(req)
    const cuerpo = await res.json()

    expect(res.status).toBe(201)
    expect(cuerpo.status).toBe('creado')

    // Verifica el payload REAL enviado al insert de "gastos".
    const llamadaGastos = fromMock.mock.results.find(
      (r, i) => fromMock.mock.calls[i][0] === 'gastos',
    )
    expect(llamadaGastos).toBeTruthy()
    const insertArg = (llamadaGastos!.value as any).insert.mock.calls[0][0]
    expect(insertArg.usuario_id).toBe('usuario-fijo-servidor')
    expect(insertArg.usuario_id).not.toBe('usuario-atacante-malicioso')
  })

  it('idempotencia: reimporte del mismo gmail_message_id responde 200 "omitido" (no un segundo insert lógico)', async () => {
    // El índice único parcial haría fallar el segundo INSERT con 23505;
    // simulamos esa respuesta de Postgres.
    insertMock.mockResolvedValueOnce({
      data: null,
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    })

    const req = crearRequest({
      gmail_message_id: 'msg-repetido',
      fecha: '2026-07-20',
      monto: 10,
      moneda: 'PEN',
      categoria_id: 'cat-1',
    })
    const res = await capturedHandler!(req)
    const cuerpo = await res.json()

    expect(res.status).toBe(200)
    expect(cuerpo).toEqual({ status: 'omitido', motivo: 'ya existe' })
  })

  it('un error de Postgres que NO es 23505 (unicidad) se propaga como error 500, no como "omitido"', async () => {
    insertMock.mockResolvedValueOnce({
      data: null,
      error: { code: '23503', message: 'foreign key violation' },
    })

    const req = crearRequest({
      gmail_message_id: 'msg-otro-error',
      fecha: '2026-07-20',
      monto: 10,
      moneda: 'PEN',
      categoria_id: 'cat-inexistente',
    })
    const res = await capturedHandler!(req)
    const cuerpo = await res.json()

    expect(res.status).toBe(500)
    expect(cuerpo.status).toBe('error')
  })

  it('sin categoria_id, resuelve la categoría "Otros" del usuario FIJO (no del payload)', async () => {
    selectSingleMock.mockResolvedValueOnce({ data: { id: 'cat-otros-id' }, error: null })
    insertMock.mockResolvedValueOnce({ data: { id: 'g2' }, error: null })

    const req = crearRequest({
      gmail_message_id: 'msg-sin-categoria',
      fecha: '2026-07-20',
      monto: 10,
      moneda: 'PEN',
      usuario_id: 'usuario-atacante-malicioso',
    })
    const res = await capturedHandler!(req)
    await res.json()

    expect(res.status).toBe(201)
    const llamadaCategorias = fromMock.mock.calls.find((c) => c[0] === 'categorias')
    expect(llamadaCategorias).toBeTruthy()

    const llamadaGastos = fromMock.mock.results.find(
      (r, i) => fromMock.mock.calls[i][0] === 'gastos',
    )
    const insertArg = (llamadaGastos!.value as any).insert.mock.calls[0][0]
    expect(insertArg.categoria_id).toBe('cat-otros-id')
  })

  it('borrador ambiguo/incompleto se inserta con estado revision_manual, monto y moneda nulos', async () => {
    insertMock.mockResolvedValueOnce({ data: { id: 'g3' }, error: null })

    const req = crearRequest({
      gmail_message_id: 'msg-ambiguo',
      fecha: '2026-07-20',
      categoria_id: 'cat-1',
      ambiguo: true,
    })
    const res = await capturedHandler!(req)
    expect(res.status).toBe(201)

    const llamadaGastos = fromMock.mock.results.find(
      (r, i) => fromMock.mock.calls[i][0] === 'gastos',
    )
    const insertArg = (llamadaGastos!.value as any).insert.mock.calls[0][0]
    expect(insertArg.estado).toBe('revision_manual')
    expect(insertArg.monto).toBeNull()
    expect(insertArg.moneda).toBeNull()
  })

  it('rechaza con 401 si el bearer no coincide con el token dedicado IMPORTAR_BORRADOR_TOKEN', async () => {
    const req = crearRequest({ gmail_message_id: 'msg-x', fecha: '2026-07-20' }, 'clave-falsa')
    const res = await capturedHandler!(req)
    expect(res.status).toBe(401)
  })

  it('rechaza con 400 un payload inválido (sin gmail_message_id)', async () => {
    const req = crearRequest({ fecha: '2026-07-20' })
    const res = await capturedHandler!(req)
    expect(res.status).toBe(400)
    expect(insertMock).not.toHaveBeenCalled()
  })
})
