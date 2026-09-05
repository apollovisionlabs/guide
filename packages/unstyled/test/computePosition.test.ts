import { describe, expect, it } from 'vitest'
import { computePosition } from '../src/computePosition'

const viewport = { width: 1000, height: 800 }
const floating = { width: 200, height: 100 }
const options = { placement: 'bottom' as const, offset: 8, padding: 8 }

// A comfortable anchor in the middle of the viewport, so nothing collides.
const centred = { top: 400, left: 400, width: 100, height: 40 }

describe('computePosition', () => {
  it('centres on the main axis for the requested side', () => {
    const bottom = computePosition(centred, floating, viewport, options)
    expect(bottom).toEqual({ x: 350, y: 448, placement: 'bottom' })

    const right = computePosition(centred, floating, viewport, { ...options, placement: 'right' })
    expect(right).toEqual({ x: 508, y: 370, placement: 'right' })
  })

  it('flips to the opposite side when the requested one overflows', () => {
    // Its lower edge is 20px from the bottom of the viewport, so a 100px bubble plus an 8px offset
    // does not fit below it.
    const low = { top: 740, left: 400, width: 100, height: 40 }
    const result = computePosition(low, floating, viewport, options)
    expect(result.placement).toBe('top')
    expect(result.y).toBe(632)
  })

  it('flips on each of the four sides', () => {
    const near = {
      bottom: { top: 740, left: 400, width: 100, height: 40 },
      top: { top: 20, left: 400, width: 100, height: 40 },
      right: { top: 400, left: 900, width: 100, height: 40 },
      left: { top: 400, left: 20, width: 100, height: 40 },
    }
    const opposite = { bottom: 'top', top: 'bottom', right: 'left', left: 'right' } as const
    for (const side of ['bottom', 'top', 'right', 'left'] as const) {
      const result = computePosition(near[side], floating, viewport, { ...options, placement: side })
      expect(result.placement, `${side} should flip`).toBe(opposite[side])
    }
  })

  it('keeps the requested side when neither side fits', () => {
    const tall = { width: 200, height: 700 }
    const result = computePosition(centred, tall, viewport, options)
    expect(result.placement).toBe('bottom')
  })

  it('shifts along the cross axis rather than leaving the viewport', () => {
    const nearRight = { top: 400, left: 950, width: 40, height: 40 }
    const result = computePosition(nearRight, floating, viewport, options)
    expect(result.placement).toBe('bottom')
    expect(result.x).toBe(792)

    const nearLeft = { top: 400, left: 10, width: 40, height: 40 }
    expect(computePosition(nearLeft, floating, viewport, options).x).toBe(8)
  })

  it('shifts on the vertical axis for a side placement', () => {
    const low = { top: 770, left: 400, width: 40, height: 40 }
    const result = computePosition(low, floating, viewport, { ...options, placement: 'right' })
    expect(result.y).toBe(692)
  })

  it('clamps to the padding when the floating element is larger than the viewport', () => {
    const huge = { width: 1200, height: 100 }
    const result = computePosition(centred, huge, viewport, options)
    expect(result.x).toBe(8)
  })

  it('handles a zero size anchor without producing NaN', () => {
    const empty = { top: 0, left: 0, width: 0, height: 0 }
    const result = computePosition(empty, floating, viewport, options)
    expect(Number.isFinite(result.x)).toBe(true)
    expect(Number.isFinite(result.y)).toBe(true)
  })

  it('keeps the box inside the viewport on both axes when neither side fits', () => {
    const tall = { width: 200, height: 700 }
    const result = computePosition(centred, tall, viewport, options)
    expect(result).toEqual({ x: 350, y: 92, placement: 'bottom' })
    expect(result.x).toBeGreaterThanOrEqual(8)
    expect(result.x + tall.width).toBeLessThanOrEqual(992)
    expect(result.y).toBeGreaterThanOrEqual(8)
    expect(result.y + tall.height).toBeLessThanOrEqual(792)
  })

  it('composes a flip with a cross-axis shift in the same call', () => {
    // Too close to the bottom edge (indeed past it) to fit below, and too close to the right
    // edge to centre. A short floating element makes the flipped side's own far edge the thing
    // that overflows, not just the near edge that decides the flip.
    const nearBottomRight = { top: 820, left: 950, width: 40, height: 5 }
    const short = { width: 200, height: 10 }
    const result = computePosition(nearBottomRight, short, viewport, options)
    expect(result).toEqual({ x: 792, y: 782, placement: 'top' })
  })

  it('inverts the clamp bound through an extreme padding rather than an oversized floating element', () => {
    const anchor = { top: 450, left: 100, width: 100, height: 40 }
    const result = computePosition(anchor, floating, viewport, { ...options, placement: 'right', padding: 370 })
    expect(result).toEqual({ x: 370, y: 370, placement: 'right' })
  })
})
