'use client'

import { useId, type MouseEvent } from 'react'
import { alpha, useTheme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import { usePrefersReducedMotion, type Rect } from '@apollovisionlabs/guide-core'

export interface SpotlightProps {
  rect: Rect | null
  padding?: number
  radius?: number
  interactive?: boolean
  zIndex?: number
  onDismiss?: () => void
}

export function Spotlight({
  rect,
  padding = 8,
  radius = 8,
  interactive = false,
  zIndex,
  onDismiss,
}: SpotlightProps) {
  const theme = useTheme()
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

  const overlay = alpha(theme.palette.common.black, theme.palette.mode === 'dark' ? 0.7 : 0.55)
  const transition = reducedMotion ? 'none' : 'all 200ms ease'

  return (
    <Box
      component="svg"
      data-testid="guide-spotlight"
      aria-hidden="true"
      onClick={interactive ? undefined : onClick}
      sx={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: zIndex ?? theme.zIndex.modal,
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
      <rect width="100%" height="100%" fill={overlay} mask={`url(#${maskId})`} />
    </Box>
  )
}
