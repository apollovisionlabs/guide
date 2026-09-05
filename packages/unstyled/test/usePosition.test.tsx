import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { usePosition } from '../src/usePosition'
import { computePosition } from '../src/computePosition'
import { triggerResizeObserver } from './setup'

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height })
}

function elementWithRect(rect: { top: number; left: number; width: number; height: number }) {
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

const anchorRect = { top: 100, left: 200, width: 80, height: 30 }
const floatingSize = { width: 150, height: 60 }

describe('usePosition', () => {
  it('returns the same numbers computePosition gives for the measured anchor and floating size', () => {
    setViewport(1024, 768)
    const anchor = elementWithRect(anchorRect)
    const floating = elementWithRect({ top: 0, left: 0, ...floatingSize })

    const { result } = renderHook(() => usePosition(anchor, {}))
    act(() => {
      result.current.ref(floating)
    })

    const expected = computePosition(
      anchorRect,
      floatingSize,
      { width: 1024, height: 768 },
      { placement: 'bottom', offset: 12, padding: 8 },
    )

    expect(result.current.x).toBe(expected.x)
    expect(result.current.y).toBe(expected.y)
    expect(result.current.placement).toBe(expected.placement)
  })

  it('produces no position for a null anchor and does not throw', () => {
    setViewport(1024, 768)
    const floating = elementWithRect({ top: 0, left: 0, ...floatingSize })

    expect(() => {
      const { result } = renderHook(() => usePosition(null, {}))
      act(() => {
        result.current.ref(floating)
      })
    }).not.toThrow()

    const { result } = renderHook(() => usePosition(null, {}))
    expect(result.current.x).toBe(0)
    expect(result.current.y).toBe(0)
  })

  it('recomputes on resize', () => {
    setViewport(1024, 768)
    const anchor = elementWithRect(anchorRect)
    const floating = elementWithRect({ top: 0, left: 0, ...floatingSize })

    const { result } = renderHook(() => usePosition(anchor, {}))
    act(() => {
      result.current.ref(floating)
    })
    const before = { x: result.current.x, y: result.current.y }

    // Shrink the viewport so the anchor, centred before, now sits close enough to the right
    // edge that the floating element must shift on the cross axis to stay clamped inside it.
    setViewport(260, 768)
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })

    const expected = computePosition(
      anchorRect,
      floatingSize,
      { width: 260, height: 768 },
      { placement: 'bottom', offset: 12, padding: 8 },
    )

    expect(result.current.x).toBe(expected.x)
    expect(result.current.x).not.toBe(before.x)
  })

  it('recomputes when the floating element resizes after mount', () => {
    setViewport(1024, 768)
    const anchor = elementWithRect(anchorRect)
    const floating = elementWithRect({ top: 0, left: 0, ...floatingSize })

    const { result } = renderHook(() => usePosition(anchor, {}))
    act(() => {
      result.current.ref(floating)
    })
    const before = { x: result.current.x, y: result.current.y }

    // The body text wraps to a wider box: the ordinary case for a tour popover whose content
    // changes after the first paint, without the floating element ever unmounting.
    const grown = { width: 250, height: 60 }
    floating.getBoundingClientRect = vi.fn(() => ({
      top: 0,
      left: 0,
      ...grown,
      right: grown.width,
      bottom: grown.height,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })) as unknown as HTMLElement['getBoundingClientRect']

    act(() => {
      triggerResizeObserver(floating)
    })

    const expected = computePosition(
      anchorRect,
      grown,
      { width: 1024, height: 768 },
      { placement: 'bottom', offset: 12, padding: 8 },
    )

    expect(result.current.x).toBe(expected.x)
    expect(result.current.y).toBe(expected.y)
    expect(result.current.x).not.toBe(before.x)
  })
})
