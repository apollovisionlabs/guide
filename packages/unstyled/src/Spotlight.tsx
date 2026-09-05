'use client'

import { useId, type MouseEvent } from 'react'
import { usePrefersReducedMotion, type Rect } from '@apollovisionlabs/guide-core'
import { Portal } from './Portal'

export interface SpotlightProps {
  rect: Rect | null
  padding?: number
  radius?: number
  interactive?: boolean
  zIndex?: number
  onDismiss?: () => void
}

// Matches MUI's theme.zIndex.modal default, so the two layers sit at the same stacking level
// out of the box.
const DEFAULT_Z_INDEX = 1300

export function Spotlight({
  rect,
  padding = 8,
  radius = 8,
  interactive = false,
  zIndex,
  onDismiss,
}: SpotlightProps) {
  const maskId = useId()
  const reducedMotion = usePrefersReducedMotion()

  if (!rect) return null

  // The SVG mask only cuts the rendering, not the clickable area: without this test, a click in
  // the highlighted hole would stop the tour instead of reaching the element it points at.
  const onClick = (event: MouseEvent) => {
    const insideHole =
      event.clientX >= rect.left - padding &&
      event.clientX <= rect.left + rect.width + padding &&
      event.clientY >= rect.top - padding &&
      event.clientY <= rect.top + rect.height + padding
    if (!insideHole) onDismiss?.()
  }

  const transition = reducedMotion ? 'none' : 'all 200ms ease'

  return (
    <Portal>
      <svg
        data-testid="guide-spotlight"
        className="guide-spotlight"
        data-guide-part="spotlight"
        aria-hidden="true"
        onClick={interactive ? undefined : onClick}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: zIndex ?? DEFAULT_Z_INDEX,
          pointerEvents: interactive ? 'none' : 'auto',
        }}
      >
        <defs>
          <mask id={maskId}>
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect
              x={rect.left - padding}
              y={rect.top - padding}
              width={rect.width + padding * 2}
              height={rect.height + padding * 2}
              rx={radius}
              fill="black"
              style={{ transition }}
            />
          </mask>
        </defs>
        {/* fill is a presentation attribute, not part of the style object, on purpose: a
        presentation attribute loses to any CSS declaration, so an adopter's own
        `.guide-spotlight rect { fill: ... }` (or the shipped stylesheet) overrides it with
        ordinary CSS specificity. Putting this colour in the inline style object instead would
        make it win over any such rule and be unoverridable, which is the opposite of what an
        unstyled package promises. Without any stylesheet at all this still has to read as a
        dimmed overlay rather than a black screen blocking the whole application, so the
        fallback here is a translucent black rather than the SVG default opaque fill. */}
        <rect width="100%" height="100%" fill="rgba(0, 0, 0, 0.5)" mask={`url(#${maskId})`} />
      </svg>
    </Portal>
  )
}
