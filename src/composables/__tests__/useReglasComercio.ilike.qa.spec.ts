import { beforeEach, describe, expect, it, type Mock } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useReglasComercio } from '@/composables/useReglasComercio'
import { supabase } from '@/lib/supabaseClient'
import { crearConstructorConsulta } from '@/lib/__mocks__/supabaseClient'

const fromMock = supabase.from as unknown as Mock

/**
 * QA independiente de HU-14.1 (bug encontrado y corregido): `contarCargosComercio`
 * armaba el patrón de `ilike` con `normalizarComercio(comercio)` SIN escapar
 * los caracteres especiales de `LIKE`/`ILIKE` en Postgres (`%` = cualquier
 * secuencia, `_` = cualquier carácter individual). Si el nombre real de un
 * comercio contenía alguno de esos caracteres (ej. una promo "Farmacia
 * 100%_Salud"), el patrón enviado a Supabase dejaba de ser una comparación
 * literal y pasaba a comportarse como un patrón con comodines, produciendo un
 * conteo potencialmente incorrecto (de más o de menos) sin ningún error
 * visible para el usuario. Corregido con `escaparPatronLike` en
 * `useReglasComercio.ts`.
 */
describe('useReglasComercio.contarCargosComercio — QA independiente: caracteres especiales de LIKE', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('regresión (corregido): un comercio con "%" y "_" literales se envía a ilike ESCAPADO, como comparación literal', async () => {
    const builder = crearConstructorConsulta()
    fromMock.mockReturnValueOnce(builder)
    ;(builder.ilike as Mock).mockResolvedValueOnce({ count: 1, error: null })

    const { contarCargosComercio } = useReglasComercio()
    await contarCargosComercio('Farmacia 100%_Salud')

    const patronEnviado = (builder.ilike as Mock).mock.calls[0][1] as string

    // Comportamiento esperado: el patrón literal debe llegar escapado, de
    // forma que Postgres lo trate como texto exacto y no como comodines.
    const estaEscapado = patronEnviado.includes('\\%') && patronEnviado.includes('\\_')
    expect(estaEscapado).toBe(true)
  })

  it('`normalizarComercio` en sí NO escapa (correcto: también la usan `buscarReglaPorComercio`/`guardarRegla` con `.eq()`, donde escapar sería incorrecto); el escape vive solo en `contarCargosComercio`, justo antes del `ilike`', async () => {
    const { normalizarComercio } = useReglasComercio()

    const sinEscapar = normalizarComercio('Farmacia 1_0')

    expect(sinEscapar.includes('_')).toBe(true)
    expect(sinEscapar.includes('\\_')).toBe(false)
  })
})
