import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useElementRect } from '../src/useElementRect'

function anchorWithRect(rect: { top: number; left: number; width: number; height: number }) {
  const element = document.createElement('div')
  document.body.appendChild(element)
  element.getBoundingClientRect = vi.fn(() => ({
    ...rect,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    x: rect.left,
    y: rect.top,
    toJSON: () => ({}),
  })) as unknown as HTMLElement['getBoundingClientRect']
  return element
}

describe('useElementRect', () => {
  it('renvoie null sans élément', () => {
    const { result } = renderHook(() => useElementRect(null))
    expect(result.current).toBeNull()
  })

  it('mesure l élément au montage', () => {
    const element = anchorWithRect({ top: 10, left: 20, width: 100, height: 40 })
    const { result } = renderHook(() => useElementRect(element))
    expect(result.current).toEqual({ top: 10, left: 20, width: 100, height: 40 })
  })

  it('remesure au défilement', () => {
    const element = anchorWithRect({ top: 10, left: 20, width: 100, height: 40 })
    const { result } = renderHook(() => useElementRect(element))

    element.getBoundingClientRect = vi.fn(() => ({
      top: 0, left: 20, width: 100, height: 40,
      right: 120, bottom: 40, x: 20, y: 0, toJSON: () => ({}),
    })) as unknown as HTMLElement['getBoundingClientRect']

    act(() => {
      window.dispatchEvent(new Event('scroll'))
    })
    expect(result.current?.top).toBe(0)
  })

  it('garde la même référence quand rien ne change', () => {
    const element = anchorWithRect({ top: 10, left: 20, width: 100, height: 40 })
    const { result } = renderHook(() => useElementRect(element))
    const first = result.current
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })
    expect(result.current).toBe(first)
  })

  it('mesure le nouvel élément sans image intermédiaire au changement de cible', () => {
    const first = anchorWithRect({ top: 10, left: 20, width: 100, height: 40 })
    const second = anchorWithRect({ top: 200, left: 5, width: 60, height: 30 })
    const { result, rerender } = renderHook(
      ({ element }) => useElementRect(element),
      { initialProps: { element: first as HTMLElement | null } },
    )
    expect(result.current).toEqual({ top: 10, left: 20, width: 100, height: 40 })

    rerender({ element: second })

    expect(result.current).toEqual({ top: 200, left: 5, width: 60, height: 30 })
  })
})
