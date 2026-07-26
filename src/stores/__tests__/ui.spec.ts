import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useUiStore } from '@/stores/ui'

/**
 * Pruebas del store `ui`: gobierna si hay un modal abierto, para que el
 * bottom nav del App Shell (HU-8.5) pueda reaccionar sin acoplarse al
 * componente que abre el modal.
 */
describe('store ui', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('estado inicial: modalAbierto es false', () => {
    const store = useUiStore()

    expect(store.modalAbierto).toBe(false)
  })

  it('camino feliz: abrirModal() pone modalAbierto en true', () => {
    const store = useUiStore()

    store.abrirModal()

    expect(store.modalAbierto).toBe(true)
  })

  it('camino feliz: cerrarModal() pone modalAbierto en false', () => {
    const store = useUiStore()
    store.abrirModal()

    store.cerrarModal()

    expect(store.modalAbierto).toBe(false)
  })

  it('estado inicial: contadorRegistro es 0', () => {
    const store = useUiStore()

    expect(store.contadorRegistro).toBe(0)
  })

  it('camino feliz: notificarRegistro() incrementa contadorRegistro en 1 cada vez', () => {
    const store = useUiStore()

    store.notificarRegistro()
    expect(store.contadorRegistro).toBe(1)

    store.notificarRegistro()
    expect(store.contadorRegistro).toBe(2)
  })
})
