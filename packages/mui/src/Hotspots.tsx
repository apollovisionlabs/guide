'use client'

import { useCallback, useEffect, useId, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Popper from '@mui/material/Popper'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import {
  useElementRect,
  useFocusTrap,
  useHotspots,
  usePrefersReducedMotion,
  useTargetElement,
  type Placement,
  type ResolvedHotspot,
} from '@apollovisionlabs/guide-core'

export interface HotspotLabels {
  /** Accessible name of the marker. A function, because word order varies by language. */
  marker: (title: string) => string
  startTour: string
  close: string
}

const DEFAULT_LABELS: HotspotLabels = {
  marker: (title) => `Show what is new: ${title}`,
  startTour: 'Show me',
  close: 'Close',
}

const MARKER_SIZE = 14

export interface HotspotsProps {
  labels?: Partial<HotspotLabels>
  placement?: Placement
  /**
   * Stacking level of the markers. The default sits above the app bar, since the element a
   * hotspot points at is often in one, and below a running tour's spotlight, which is at
   * `theme.zIndex.modal`. A hotspot whose target lives inside a modal dialog is therefore
   * covered; raise this to bring it out.
   */
  zIndex?: number
}

export function Hotspots({ labels, placement = 'bottom', zIndex }: HotspotsProps = {}) {
  const { hotspots } = useHotspots()
  const [openId, setOpenId] = useState<string | null>(null)

  const text = { ...DEFAULT_LABELS, ...labels }

  return (
    <>
      {hotspots.map((hotspot) => (
        <HotspotMarker
          key={hotspot.id}
          hotspot={hotspot}
          labels={text}
          placement={hotspot.placement ?? placement}
          zIndex={zIndex}
          isOpen={openId === hotspot.id}
          onOpen={() => setOpenId(hotspot.id)}
          onClose={() => setOpenId((current) => (current === hotspot.id ? null : current))}
        />
      ))}
    </>
  )
}

interface HotspotMarkerProps {
  hotspot: ResolvedHotspot
  labels: HotspotLabels
  placement: Placement
  zIndex?: number
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
}

function HotspotMarker({
  hotspot,
  labels,
  placement,
  zIndex,
  isOpen,
  onOpen,
  onClose,
}: HotspotMarkerProps) {
  const theme = useTheme()
  const titleId = useId()
  const bodyId = useId()
  const reducedMotion = usePrefersReducedMotion()
  const { open, startTour, notifyShown } = useHotspots()

  const { element } = useTargetElement(hotspot.target)
  const rect = useElementRect(element)

  const [marker, setMarker] = useState<HTMLButtonElement | null>(null)
  const [bubble, setBubble] = useState<HTMLElement | null>(null)

  // Opening marks the hotspot seen, so the provider stops listing it as unseen. Without this
  // local flag the marker would unmount at that instant and the bubble would lose its anchor.
  // It is cleared on blur rather than on close, so focus, which the trap returns to the
  // marker, never falls through to document.body.
  const [openedHere, setOpenedHere] = useState(false)

  useFocusTrap(bubble, isOpen)

  // Gated on the marker actually being drawn, not merely on the target being measurable: a
  // hotspot already seen renders nothing, and announcing an impression for a marker nobody
  // saw would make the event a lie.
  const isDrawn = !!rect && (!hotspot.seen || openedHere)
  useEffect(() => {
    if (isDrawn) notifyShown(hotspot.id)
  }, [isDrawn, hotspot.id, notifyShown])

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onClose()
    },
    [onClose],
  )

  useEffect(() => {
    if (!isOpen) return
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onKeyDown])

  useEffect(() => {
    if (!isOpen || !bubble) return
    const onPointerDown = (event: MouseEvent) => {
      const node = event.target as Node
      if (bubble.contains(node)) return
      if (marker?.contains(node)) return
      onClose()
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [isOpen, bubble, marker, onClose])

  if (!rect) return null
  if (hotspot.seen && !openedHere) return null

  const onMarkerClick = () => {
    setOpenedHere(true)
    open(hotspot.id)
    onOpen()
  }

  return (
    <>
      <Box
        component="button"
        type="button"
        ref={setMarker}
        aria-label={labels.marker(hotspot.title)}
        aria-expanded={isOpen}
        onClick={onMarkerClick}
        onBlur={() => {
          if (!isOpen) setOpenedHere(false)
        }}
        sx={{
          position: 'fixed',
          top: rect.top - MARKER_SIZE / 2,
          left: rect.left + rect.width - MARKER_SIZE / 2,
          width: MARKER_SIZE,
          height: MARKER_SIZE,
          p: 0,
          border: 0,
          borderRadius: '50%',
          cursor: 'pointer',
          backgroundColor: theme.palette.primary.main,
          zIndex: zIndex ?? theme.zIndex.drawer + 1,
          '&::after': {
            content: '""',
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            backgroundColor: theme.palette.primary.main,
            animation: reducedMotion ? 'none' : 'guide-hotspot-pulse 1800ms ease-out infinite',
          },
          '@keyframes guide-hotspot-pulse': {
            '0%': { transform: 'scale(1)', opacity: 0.6 },
            '100%': { transform: 'scale(2.4)', opacity: 0 },
          },
        }}
      />

      {isOpen && (
        <Popper
          open
          anchorEl={marker}
          placement={placement}
          sx={{ zIndex: (zIndex ?? theme.zIndex.drawer + 1) + 1 }}
          modifiers={[{ name: 'offset', options: { offset: [0, 12] } }]}
        >
          <Paper
            ref={setBubble}
            elevation={8}
            role="dialog"
            aria-labelledby={titleId}
            aria-describedby={bodyId}
            sx={{ maxWidth: 300, p: 2, borderRadius: 2 }}
          >
            <Typography id={titleId} variant="subtitle2" sx={{ fontWeight: 600 }}>
              {hotspot.title}
            </Typography>
            <Typography id={bodyId} variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {hotspot.body}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 2, justifyContent: 'flex-end' }}>
              {hotspot.tourId && (
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => {
                    onClose()
                    startTour(hotspot.id)
                  }}
                >
                  {labels.startTour}
                </Button>
              )}
              <Button size="small" onClick={onClose}>
                {labels.close}
              </Button>
            </Box>
          </Paper>
        </Popper>
      )}
    </>
  )
}
