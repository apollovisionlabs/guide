'use client'

import { useCallback, useEffect, useId, useState } from 'react'
import { useFocusTrap, type Placement } from '@apollovisionlabs/guide-core'
import { usePosition } from './usePosition'
import { Portal } from './Portal'

export interface StepPopoverLabels {
  next: string
  previous: string
  finish: string
  close: string
  /** Shown in place of the primary button while the step waits for a user action. */
  awaitingAction: string
}

const DEFAULT_LABELS: StepPopoverLabels = {
  next: 'Next',
  previous: 'Back',
  finish: 'Finish',
  close: 'Close',
  awaitingAction: 'Click the highlighted element to continue.',
}

// Matches Spotlight's own DEFAULT_Z_INDEX. The one added below, not this constant, is what
// keeps the popover above the spotlight: both components receive the same `zIndex` prop from
// GuideTour, so the offset has to live on whichever one needs to end up on top.
const DEFAULT_Z_INDEX = 1300

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
  /** The step advances on a user action, so the popover offers no way around it. */
  awaitsAction?: boolean
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
  awaitsAction = false,
  labels,
  onNext,
  onPrevious,
  onStop,
}: StepPopoverProps) {
  const titleId = useId()
  const bodyId = useId()
  const [container, setContainer] = useState<HTMLElement | null>(null)
  const text = { ...DEFAULT_LABELS, ...labels }

  const { x, y, placement: resolvedPlacement, ref: positionRef } = usePosition(
    open ? anchorEl : null,
    { placement },
  )

  const setRefs = useCallback(
    (node: HTMLElement | null) => {
      setContainer(node)
      positionRef(node)
    },
    [positionRef],
  )

  // Focus lands on the container, not on the close button: a reflex Enter after an arrow key must
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
        // A step that waits for an action must not be advanced from the keyboard either:
        // the arrow would be a way around the very thing the step is asking for.
        if (!awaitsAction) onNext()
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        if (!isFirst) onPrevious()
      }
    },
    [onStop, onNext, onPrevious, isFirst, awaitsAction],
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
    <Portal>
      <div
        ref={setRefs}
        className="guide-popover"
        data-guide-part="popover"
        data-guide-placement={resolvedPlacement}
        role="dialog"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        {...(modal ? { 'aria-modal': 'true' as const } : {})}
        tabIndex={-1}
        style={{ position: 'fixed', top: `${y}px`, left: `${x}px`, zIndex: (zIndex ?? DEFAULT_Z_INDEX) + 1 }}
      >
        <div className="guide-popover-header" data-guide-part="popover-header">
          <h2 id={titleId} className="guide-popover-title" data-guide-part="popover-title">
            {title}
          </h2>
          <button
            type="button"
            className="guide-button guide-button-icon"
            data-guide-part="close"
            aria-label={text.close}
            onClick={onStop}
          >
            <span aria-hidden="true">&times;</span>
          </button>
        </div>

        <p id={bodyId} className="guide-popover-body" data-guide-part="popover-body">
          {body}
        </p>

        <div className="guide-popover-footer" data-guide-part="popover-footer">
          <span className="guide-popover-count" data-guide-part="popover-count">
            {`${stepIndex + 1} / ${stepCount}`}
          </span>
          {!isFirst && (
            <button
              type="button"
              className="guide-button"
              data-guide-part="previous"
              onClick={onPrevious}
            >
              {text.previous}
            </button>
          )}
          {awaitsAction ? (
            <span className="guide-popover-awaiting" data-guide-part="popover-awaiting">
              {text.awaitingAction}
            </span>
          ) : (
            <button
              type="button"
              className="guide-button guide-button-primary"
              data-guide-part="next"
              onClick={onNext}
            >
              {isLast ? text.finish : text.next}
            </button>
          )}
        </div>
      </div>
    </Portal>
  )
}
