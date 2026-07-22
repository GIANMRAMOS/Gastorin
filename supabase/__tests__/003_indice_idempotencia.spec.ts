import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Prueba de guardia (no requiere una base Postgres real) para el criterio
 * crítico de idempotencia de HU-5.3: el índice único parcial
 * `gastos_gmail_message_id_unico`, definido en la migración 001 y NUNCA
 * redefinido por la 003, debe seguir bloqueando reimportes del mismo
 * `gmail_message_id` SIN IMPORTAR el `estado` de la fila existente (aunque ya
 * esté 'confirmado' o 'descartado'). Si el índice estuviera condicionado
 * también por `estado` (ej. `where gmail_message_id is not null and estado
 * in ('borrador','revision_manual')`), un correo reimportado después de que
 * el usuario confirmara o descartara el borrador original crearía un
 * DUPLICADO — el bug de negocio más caro de la Épica 5. Esta prueba falla si
 * alguien "arregla" el índice para acotarlo por estado sin darse cuenta de
 * esa implicación.
 */
// `__dirname` no existe en ESM; se resuelve la carpeta de migraciones desde
// la raíz del proyecto (cwd de Vitest), que es donde vive `supabase/`.
function leerMigracion(nombre: string): string {
  return readFileSync(path.join(process.cwd(), 'supabase', 'migrations', nombre), 'utf-8')
}

describe('Índice único parcial gastos_gmail_message_id_unico (idempotencia HU-5.3)', () => {
  it('la migración 001 crea el índice condicionado SOLO por "gmail_message_id is not null", sin filtrar por estado', () => {
    const sql001 = leerMigracion('001_init_gastorin.sql')
    const match = sql001.match(
      /create unique index gastos_gmail_message_id_unico[\s\S]*?where ([^;]+);/i,
    )
    expect(match).not.toBeNull()
    const clausulaWhere = match![1].trim()
    expect(clausulaWhere).toBe('gmail_message_id is not null')
    // Explícitamente, el WHERE no debe mencionar "estado": si lo hiciera, el
    // duplicado dejaría de bloquearse en cuanto el borrador cambiara de
    // estado (confirmado/descartado), rompiendo la idempotencia de HU-5.3.
    expect(clausulaWhere).not.toContain('estado')
  })

  it('la migración 003 (borradores) NO redefine ni elimina el índice de idempotencia', () => {
    const sql003 = leerMigracion('003_bandeja_borradores.sql')
    expect(sql003).not.toMatch(/drop index/i)
    expect(sql003).not.toMatch(/gastos_gmail_message_id_unico/i)
  })

  it('la migración 002 (estado descartado) tampoco toca el índice', () => {
    const sql002 = leerMigracion('002_estado_gasto_descartado.sql')
    expect(sql002).not.toMatch(/drop index/i)
    expect(sql002).not.toMatch(/gastos_gmail_message_id_unico/i)
  })
})
