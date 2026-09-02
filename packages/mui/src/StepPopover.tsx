'use client'

import { useCallback, useEffect, useId, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Paper from '@mui/material/Paper'
import Popper from '@mui/material/Popper'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import { useFocusTrap, type Placement } from '@apollovisionlabs/guide-core'

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

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT'
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
  /** Highlighted element, which receives an accessible description linked to the body. */
  describeElement?: HTMLElement | null
  /** A non-modal step lets the user reach the page. Defaults to true. */
  modal?: boolean
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
  modal = true,
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

  // Focus lands on the Paper, not on the close button: a reflex Enter after an arrow key must
  // not stop the tour.
  useFocusTrap(container, open && modal, { initialFocus: 'container' })

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return
      if (event.key === 'Escape') {
        event.preventDefault()
        onStop()
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        onNext()
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        if (!isFirst) onPrevious()
      }
    },
    [onStop, onNext, onPrevious, isFirst],
  )

  useEffect(() => {
    if (!open) return
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onKeyDown])

  // The highlighted element is described by the popover body.
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
        {...(modal ? { 'aria-modal': 'true' as const } : {})}
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
