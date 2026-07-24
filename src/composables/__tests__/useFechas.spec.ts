import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { agruparPorFecha, etiquetaFecha } from '@/composables/useFechas'

describe('useFechas', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 20)) // "hoy" fijo: 20 jul 2026
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('etiquetaFecha', () => {
    it('camino feliz: la fecha de hoy devuelve "Hoy"', () => {
      expect(etiquetaFecha('2026-07-20')).toBe('Hoy')
    })

    it('camino feliz: la fecha de ayer devuelve "Ayer"', () => {
      expect(etiquetaFecha('2026-07-19')).toBe('Ayer')
    })

    it('borde: "ayer" cruzando de mes (hoy = día 1) sigue devolviendo "Ayer"', () => {
      vi.setSystemTime(new Date(2026, 7, 1)) // hoy = 1 ago 2026
      expect(etiquetaFecha('2026-07-31')).toBe('Ayer')
    })

    it('mayoría: fecha antigua del mismo año no incluye el año', () => {
      expect(etiquetaFecha('2026-07-10')).toBe('10 de julio')
    })

    it('mayoría: fecha antigua de otro año incluye el año', () => {
      expect(etiquetaFecha('2024-07-20')).toBe('20 de julio de 2024')
    })

    it('robustez de zona horaria: "2026-07-20" no cae al día 19', () => {
      const etiqueta = etiquetaFecha('2026-07-20')
      expect(etiqueta).toBe('Hoy') // si hubiera desfase a UTC, dejaría de coincidir con "hoy"
    })

    it('borde: son las 23:50 de "hoy" -> sigue siendo "Hoy" y "ayer" sigue siendo "Ayer"', () => {
      vi.setSystemTime(new Date(2026, 6, 20, 23, 50, 0)) // 20 jul 2026, 11:50pm
      expect(etiquetaFecha('2026-07-20')).toBe('Hoy')
      expect(etiquetaFecha('2026-07-19')).toBe('Ayer')
    })
  })

  describe('agruparPorFecha', () => {
    it('camino feliz: 3 días distintos ya ordenados desc -> 3 grupos, etiquetas correctas, mismo orden', () => {
      const items = [
        { fecha: '2026-07-20', nombre: 'a' },
        { fecha: '2026-07-19', nombre: 'b' },
        { fecha: '2026-07-10', nombre: 'c' },
      ]

      const grupos = agruparPorFecha(items, (item) => item.fecha)

      expect(grupos).toHaveLength(3)
      expect(grupos[0]).toEqual({ etiqueta: 'Hoy', items: [items[0]] })
      expect(grupos[1]).toEqual({ etiqueta: 'Ayer', items: [items[1]] })
      expect(grupos[2]).toEqual({ etiqueta: '10 de julio', items: [items[2]] })
    })

    it('borde: todos los items el mismo día -> 1 solo grupo con todos', () => {
      const items = [
        { fecha: '2026-07-20', nombre: 'a' },
        { fecha: '2026-07-20', nombre: 'b' },
        { fecha: '2026-07-20', nombre: 'c' },
      ]

      const grupos = agruparPorFecha(items, (item) => item.fecha)

      expect(grupos).toHaveLength(1)
      expect(grupos[0].etiqueta).toBe('Hoy')
      expect(grupos[0].items).toEqual(items)
    })

    it('borde: lista vacía devuelve []', () => {
      expect(agruparPorFecha([], (item: { fecha: string }) => item.fecha)).toEqual([])
    })

    it('no reordena: agrupa consecutivos tal cual los recibe, sin reordenar por fecha', () => {
      const items = [
        { fecha: '2026-07-10', nombre: 'antiguo' },
        { fecha: '2026-07-20', nombre: 'hoy' },
        { fecha: '2026-07-10', nombre: 'antiguo-de-nuevo' },
      ]

      const grupos = agruparPorFecha(items, (item) => item.fecha)

      // Mismo día '2026-07-10' aparece en dos grupos separados porque no son consecutivos.
      expect(grupos).toHaveLength(3)
      expect(grupos[0].items).toEqual([items[0]])
      expect(grupos[1].items).toEqual([items[1]])
      expect(grupos[2].items).toEqual([items[2]])
    })

    it('genérico: funciona con un obtenerFecha distinto y con fechas que traen hora', () => {
      const items = [
        { creadoEn: '2026-07-20T14:30:00Z', nombre: 'a' },
        { creadoEn: '2026-07-20T08:00:00Z', nombre: 'b' },
      ]

      const grupos = agruparPorFecha(items, (item) => item.creadoEn)

      expect(grupos).toHaveLength(1)
      expect(grupos[0].etiqueta).toBe('Hoy')
      expect(grupos[0].items).toEqual(items)
    })
  })
})
