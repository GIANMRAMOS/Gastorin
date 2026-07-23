import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import TextoVersion from '@/components/TextoVersion.vue'

/**
 * Prueba AISLADA de `TextoVersion.vue` (componente extraído en el retrofit de
 * la Épica 11 para reutilizar la lógica de versión/commit entre el sidebar y
 * el bottom nav móvil). No monta `AppShellLayout`: solo ejercita el
 * componente vía sus props (`textoVersion`/`commitCompleto`), sin depender de
 * `useVersion` real ni de constantes de build.
 */
describe('TextoVersion.vue (componente extraído, aislado)', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('camino feliz: con commitCompleto presente, muestra un botón con el texto de versión y permite copiar', async () => {
    const escribirEnPortapapeles = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: escribirEnPortapapeles },
      configurable: true,
    })

    const wrapper = mount(TextoVersion, {
      props: { textoVersion: 'v1.2.3 · abc1234', commitCompleto: 'abc1234' },
    })

    const boton = wrapper.find('.hash-commit')
    expect(boton.exists()).toBe(true)
    expect(boton.text()).toBe('v1.2.3 · abc1234')
    expect(wrapper.find('.confirmacion-copiado').exists()).toBe(false)

    await boton.trigger('click')
    await wrapper.vm.$nextTick()

    expect(escribirEnPortapapeles).toHaveBeenCalledWith('abc1234')
    expect(wrapper.find('.confirmacion-copiado').exists()).toBe(true)
    expect(wrapper.find('.confirmacion-copiado').text()).toBe('Copiado')
  })

  it('borde: con commitCompleto null, no renderiza botón clicable y muestra solo el texto plano', async () => {
    const escribirEnPortapapeles = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: escribirEnPortapapeles },
      configurable: true,
    })

    const wrapper = mount(TextoVersion, {
      props: { textoVersion: 'v1.2.3 · sin commit', commitCompleto: null },
    })

    expect(wrapper.find('.hash-commit').exists()).toBe(false)
    expect(wrapper.find('.texto-version').text()).toBe('v1.2.3 · sin commit')
    expect(escribirEnPortapapeles).not.toHaveBeenCalled()
  })

  it('borde: la confirmación "Copiado" desaparece sola pasados 2 segundos', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    })

    const wrapper = mount(TextoVersion, {
      props: { textoVersion: 'v1.0.0 · deadbee', commitCompleto: 'deadbee' },
    })

    await wrapper.find('.hash-commit').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.confirmacion-copiado').exists()).toBe(true)

    vi.advanceTimersByTime(2000)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.confirmacion-copiado').exists()).toBe(false)

    vi.useRealTimers()
  })

  it('reutilización: dos instancias independientes con distintas props no comparten estado de "Copiado"', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    })

    const wrapperSidebar = mount(TextoVersion, {
      props: { textoVersion: 'v1.0.0 · aaa1111', commitCompleto: 'aaa1111' },
    })
    const wrapperMovil = mount(TextoVersion, {
      props: { textoVersion: 'v1.0.0 · aaa1111', commitCompleto: 'aaa1111' },
    })

    await wrapperSidebar.find('.hash-commit').trigger('click')
    await wrapperSidebar.vm.$nextTick()

    expect(wrapperSidebar.find('.confirmacion-copiado').exists()).toBe(true)
    expect(wrapperMovil.find('.confirmacion-copiado').exists()).toBe(false)
  })
})
