import type { Placement, Rect } from '@apollovisionlabs/guide-core'

export interface Size {
  width: number
  height: number
}

export interface Positioned {
  x: number
  y: number
  placement: Placement
}

export interface PositionOptions {
  placement: Placement
  /** Gap between the anchor and the floating element, in pixels. */
  offset: number
  /** Smallest distance kept between the floating element and the viewport edge. */
  padding: number
}

const OPPOSITE: Record<Placement, Placement> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
}

function coordsFor(placement: Placement, anchor: Rect, floating: Size, offset: number) {
  const centreX = anchor.left + anchor.width / 2 - floating.width / 2
  const centreY = anchor.top + anchor.height / 2 - floating.height / 2
  switch (placement) {
    case 'top':
      return { x: centreX, y: anchor.top - floating.height - offset }
    case 'bottom':
      return { x: centreX, y: anchor.top + anchor.height + offset }
    case 'left':
      return { x: anchor.left - floating.width - offset, y: centreY }
    case 'right':
      return { x: anchor.left + anchor.width + offset, y: centreY }
  }
}

/** Only the main axis decides a flip. The cross axis is what shift corrects. */
function fitsOnMainAxis(
  placement: Placement,
  coords: { x: number; y: number },
  floating: Size,
  viewport: Size,
  padding: number,
): boolean {
  switch (placement) {
    case 'top':
      return coords.y >= padding
    case 'bottom':
      return coords.y + floating.height <= viewport.height - padding
    case 'left':
      return coords.x >= padding
    case 'right':
      return coords.x + floating.width <= viewport.width - padding
  }
}

/**
 * Places a floating element against an anchor, correcting for the viewport edges.
 *
 * Pure on purpose: no DOM, no React, no clock. Flip and shift are the two rules that go
 * wrong silently in a hand written positioner, and here they are ordinary arithmetic that
 * a test can pin down exactly.
 *
 * Positions against the viewport, not against a scrolling ancestor. A target inside its own
 * scroll container, near that container's edge but not the window's, is not corrected. That
 * is a documented limit and this function is where it would be lifted.
 */
export function computePosition(
  anchor: Rect,
  floating: Size,
  viewport: Size,
  { placement, offset, padding }: PositionOptions,
): Positioned {
  let chosen = placement
  let coords = coordsFor(chosen, anchor, floating, offset)

  if (!fitsOnMainAxis(chosen, coords, floating, viewport, padding)) {
    const opposite = OPPOSITE[chosen]
    const alternative = coordsFor(opposite, anchor, floating, offset)
    // Only move if the other side is genuinely better. Flipping into a second bad fit
    // moves the bubble twice and reads as a glitch.
    if (fitsOnMainAxis(opposite, alternative, floating, viewport, padding)) {
      chosen = opposite
      coords = alternative
    }
  }

  const alongX = chosen === 'top' || chosen === 'bottom'
  if (alongX) {
    // The lower clamp wins when the floating element is wider than the viewport, which keeps
    // it at the padding rather than pushing it off the left edge.
    const furthest = viewport.width - padding - floating.width
    coords = { ...coords, x: Math.min(Math.max(coords.x, padding), Math.max(padding, furthest)) }
  } else {
    const furthest = viewport.height - padding - floating.height
    coords = { ...coords, y: Math.min(Math.max(coords.y, padding), Math.max(padding, furthest)) }
  }

  return { x: coords.x, y: coords.y, placement: chosen }
}
