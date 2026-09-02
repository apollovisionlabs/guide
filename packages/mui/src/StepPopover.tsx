'use client'

import { useCallback, useEffect, useId, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Paper from '@mui/material/Paper'
import Popper from '@mui/material/Popper'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import { useFocusTrap, type Placement } from '@guide/core'

export interface StepPopoverLabels {
  next: string
  previous: string
  finish: string
  close: string
}

const DEFAULT_LABELS: StepPopoverLabels = {
  next: 'Next',
  previous: 'Back',
  finish: 'Finish',
  close: 'Close',
}

export interface StepPopoverProps {
  anchorEl: HTMLElement | null
  open: boolean
  title: string
  body: string
  stepIndex: number
  stepCount: number
  isFirst: boolean
  isLast: boolean
  placement?: Placement
  zIndex?: number
  /** Élément mis en avant, qui reçoit une description accessible reliée au corps. */
  describeElement?: HTMLElement | null
  labels?: Partial<StepPopoverLabels>
  onNext: () => void
  onPrevious: () => void
  onStop: () => void
}

export function StepPopover({
  anchorEl,
  open,
  title,
  body,
  stepIndex,
  stepCount,
  isFirst,
  isLast,
  placement = 'bottom',
  zIndex,
  describeElement,
  labels,
  onNext,
  onPrevious,
  onStop,
}: StepPopoverProps) {
  const theme = useTheme()
  const titleId = useId()
  const bodyId = useId()
  const [container, setContainer] = useState<HTMLElement | null>(null)
  const text = { ...DEFAULT_LABELS, ...labels }

  useFocusTrap(container, open)

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onStop()
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        onNext()
      } else if (event.key === 'ArrowLeft' && !isFirst) {
        event.preventDefault()
        onPrevious()
      }
    },
    [onStop, onNext, onPrevious, isFirst],
  )

  useEffect(() => {
    if (!open) return
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onKeyDown])

  // L'élément mis en avant est décrit par le corps du popover.
  useEffect(() => {
    if (!open || !describeElement) return
    describeElement.setAttribute('aria-describedby', bodyId)
    return () => describeElement.removeAttribute('aria-describedby')
  }, [open, describeElement, bodyId])

  if (!open) return null

  return (
    <Popper
      open={open}
      anchorEl={anchorEl}
      placement={placement}
      sx={{ zIndex: (zIndex ?? theme.zIndex.modal) + 1 }}
      modifiers={[{ name: 'offset', options: { offset: [0, 12] } }]}
    >
      <Paper
        ref={setContainer}
        elevation={8}
        role="dialog"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
        sx={{ maxWidth: 340, p: 2, borderRadius: 2 }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <Typography id={titleId} variant="subtitle1" sx={{ fontWeight: 600, flexGrow: 1 }}>
            {title}
          </Typography>
          <IconButton size="small" aria-label={text.close} onClick={onStop}>
            <Box component="span" aria-hidden="true" sx={{ lineHeight: 1 }}>
              ×
            </Box>
          </IconButton>
        </Box>

        <Typography id={bodyId} variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {body}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ flexGrow: 1 }}>
            {`${stepIndex + 1} / ${stepCount}`}
          </Typography>
          {!isFirst && (
            <Button size="small" onClick={onPrevious}>
              {text.previous}
            </Button>
          )}
          <Button size="small" variant="contained" onClick={onNext}>
            {isLast ? text.finish : text.next}
          </Button>
        </Box>
      </Paper>
    </Popper>
  )
}
