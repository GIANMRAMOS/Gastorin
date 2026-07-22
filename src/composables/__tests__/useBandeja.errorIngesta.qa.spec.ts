import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useBandeja } from '@/composables/useBandeja'
import { useGastosStore } from '@/stores/gastos'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/lib/supabaseClient'
import { crearConstructorConsulta } from '@/lib/__mocks__/supabaseClient'

const fromMock = supabase.from as unknown as Mock

/**
 * QA independiente (HU-5.5): `cargarEstadoIngesta` debe distinguir "la
 * ingesta nunca corrió" (PGRST116, "no rows", caso de negocio válido) de "hubo
 * un error real de conexión/consulta a la BD" (cualquier otro código). Ambos
 * casos hoy devuelven exactamente lo mismo (`null`, sin tocar el store, sin
 * log): son indistinguibles desde afuera. Esto es un riesgo real: un fallo de
 * conexión a Supabase se mostraría en la Bandeja como "Aún no se ha ejecutado
 * la revisión automática" (mensaje de negocio, no de error), ocultando que la
 * ingesta SÍ corrió pero la Bandeja no pudo confirmarlo.
 */
describe('useBandeja.cargarEstadoIngesta — QA independiente: distinción error real vs "nunca corrió"', () => {
  let spyConsoleError: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    setActivePinia(createPinia())
    useAuthStore().establecerUsuario({ id: 'u1', email: 'a@a.com' } as never)
    spyConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    spyConsoleError.mockRestore()
  })

  it('PGRST116 ("no rows"): null, sin error en el store, sin log (caso de negocio válido)', async () => {
    const builder = crearConstructorConsulta()
    fromMock.mockReturnValueOnce(builder)
    ;(builder.single as Mock).mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116', message: 'no rows' },
    })

    const store = useGastosStore()
    const { cargarEstadoIngesta } = useBandeja()
    const resultado = await cargarEstadoIngesta()

    expect(resultado).toBeNull()
    expect(store.error).toBeNull()
    expect(spyConsoleError).not.toHaveBeenCalled()
  })

  it('BUG: un error real de conexión/consulta (code distinto de PGRST116) debería ser observable y NO idéntico al caso "nunca corrió"', async () => {
    const builder = crearConstructorConsulta()
    fromMock.mockReturnValueOnce(builder)
    ;(builder.single as Mock).mockResolvedValueOnce({
      data: null,
      error: { code: 'ECONNREFUSED', message: 'conexión rechazada' },
    })

    const store = useGastosStore()
    const { cargarEstadoIngesta } = useBandeja()
    const resultado = await cargarEstadoIngesta()

    // El resultado visible (null) es indistinguible de "nunca corrió", lo cual
    // es aceptable para no romper el render de la Bandeja (así lo definió
    // Data en el micro-plan). Pero, a diferencia del caso "no rows", un error
    // real SÍ debería dejar constancia de que algo falló (store.error o un
    // log), para no confundir "nunca corrió" con "no se pudo confirmar si
    // corrió". Hoy la implementación NO deja ninguna constancia: se comporta
    // exactamente igual que PGRST116.
    expect(resultado).toBeNull()
    expect(store.error !== null || spyConsoleError.mock.calls.length > 0).toBe(true)
  })
})
