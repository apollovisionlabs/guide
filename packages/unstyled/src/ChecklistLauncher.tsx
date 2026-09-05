'use client'

import { useCallback, useEffect, useState } from 'react'
import { useChecklist, useFocusTrap, type ResolvedChecklistItem } from '@apollovisionlabs/guide-core'
import { usePosition } from './usePosition'
import { Portal } from './Portal'
import { Checklist, type ChecklistLabels } from './Checklist'

export interface ChecklistLauncherLabels extends ChecklistLabels {
  fabLabel: (title: string, completedCount: number, total: number) => string
  dismissed: (title: string) => string
}

const DEFAULT_LAUNCHER_LABELS: ChecklistLauncherLabels = {
  dismiss: 'Dismiss',
  progress: (completedCount, total) => `${completedCount} of ${total}`,
  markComplete: (itemTitle) => `Mark ${itemTitle} as complete`,
  markNotComplete: (itemTitle) => `Mark ${itemTitle} as not complete`,
  fabLabel: (title, completedCount, total) => `${title}, ${completedCount} of ${total} complete`,
  dismissed: (title) => `${title} dismissed`,
}

export interface ChecklistLauncherProps {
  checklistId: string
  title?: string
  placement?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  /** Stacking level of the launcher button and its panel. Defaults to one below StepPopover
   * and Spotlight's shared 1300, the same margin the MUI layer settled on relative to its
   * modal layer, so a running tour always paints in front of the launcher. */
  zIndex?: number
  labels?: Partial<ChecklistLauncherLabels>
}

const CORNER_OFFSET = 24
const RING_SIZE = 64

// Matches StepPopover and Spotlight's DEFAULT_Z_INDEX. The launcher must stay one level below
// that so a running tour's spotlight and popover always paint in front of it, never behind it.
const DEFAULT_Z_INDEX = 1299

function cornerStyle(placement: NonNullable<ChecklistLauncherProps['placement']>): {
  top?: number
  bottom?: number
  left?: number
  right?: number
} {
  return {
    ...(placement.startsWith('bottom') ? { bottom: CORNER_OFFSET } : { top: CORNER_OFFSET }),
    ...(placement.endsWith('right') ? { right: CORNER_OFFSET } : { left: CORNER_OFFSET }),
  }
}

export function ChecklistLauncher({
  checklistId,
  title,
  placement = 'bottom-right',
  zIndex,
  labels,
}: ChecklistLauncherProps) {
  const text = { ...DEFAULT_LAUNCHER_LABELS, ...labels }
  const { completedCount, total, dismissed, restored } = useChecklist(checklistId)
  const [buttonEl, setButtonEl] = useState<HTMLButtonElement | null>(null)
  const [open, setOpen] = useState(false)
  const [container, setContainer] = useState<HTMLElement | null>(null)
  // Set only when the dismissal happened here, in this session, from inside the panel. A
  // checklist that storage already reports as dismissed never sets it, so a returning user
  // gets nothing at all.
  const [dismissedHere, setDismissedHere] = useState(false)

  // Cleared when the checklist comes back, through reset or through a host that undismisses it.
  // Without this the flag outlives the dismissal it described, and a later dismissal from
  // anywhere else would drag focus out of whatever the user was typing in.
  useEffect(() => {
    if (!dismissed) setDismissedHere(false)
  }, [dismissed])

  const fromBottom = placement.startsWith('bottom')

  const { x, y, ref: positionRef } = usePosition(open ? buttonEl : null, {
    placement: fromBottom ? 'top' : 'bottom',
  })

  const setContainerRefs = useCallback(
    (node: HTMLElement | null) => {
      setContainer(node)
      positionRef(node)
    },
    [positionRef],
  )

  useFocusTrap(container, open)

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      close()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, close])

  // Nothing is drawn until the initial restore from storage has settled. Without this, a
  // checklist already dismissed, or partly completed, in storage would still get a launcher
  // mounted against the stale, pre-restore state for one paint: a dismissed launcher flashing
  // on screen before vanishing, or "0 of 4" jumping to "3 of 4".
  if (!restored) return null

  if (dismissed) {
    // Dismissing from inside the panel unmounts the launcher button and the panel in the same
    // commit, so there is no anchor left to restore focus to and a keyboard user is dropped on
    // document.body: no focus ring, no announcement, and the next Tab restarts at the top of
    // the page. The component is right to disappear, which is the whole point of a dismissal,
    // so the fix is not to keep the launcher on screen but to give focus a deliberate
    // destination at the place the launcher just left. This confirms the dismissal, then
    // removes itself the moment focus moves on, so nothing outlives the announcement.
    if (!dismissedHere) return null
    return (
      <Portal>
        <div
          // Deliberately not a live region. Focusing it is what announces it, and a polite
          // live region inserted and focused in the same commit is read twice by several
          // screen readers.
          tabIndex={-1}
          className="guide-visually-hidden"
          ref={(node: HTMLDivElement | null) => {
            node?.focus()
          }}
          onBlur={() => setDismissedHere(false)}
          style={{ position: 'fixed', top: 0, left: 0 }}
        >
          {text.dismissed(title ?? 'Checklist')}
        </div>
      </Portal>
    )
  }

  const progress = total === 0 ? 0 : Math.round((completedCount / total) * 100)
  const dialogLabel = title ?? 'Checklist'
  const fabLabel = text.fabLabel(dialogLabel, completedCount, total)
  const resolvedZIndex = zIndex ?? DEFAULT_Z_INDEX

  const onDismiss = () => {
    close()
    setDismissedHere(true)
  }

  // Ticking items one after another is the normal way to use the list, so the panel must stay
  // open for a plain tick. It only closes when the activated item hands off to something that
  // needs the screen: a tour (which would otherwise be stuck behind an aria-hidden launcher)
  // or a navigation away from the current page.
  const onActivate = (item: ResolvedChecklistItem) => {
    if (item.tourId || item.href) close()
  }

  return (
    <Portal>
      <div
        data-testid="checklist-launcher-anchor"
        className="guide-launcher-anchor"
        style={{ position: 'fixed', zIndex: resolvedZIndex, ...cornerStyle(placement) }}
      >
        <svg
          className="guide-launcher-ring"
          data-guide-part="launcher-ring"
          aria-hidden="true"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          width={RING_SIZE}
          height={RING_SIZE}
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          style={{ position: 'absolute', pointerEvents: 'none' }}
        >
          {/* stroke is a presentation attribute, not part of the style object, on purpose: a
          presentation attribute loses to any CSS declaration, so an adopter's own
          `.guide-launcher-ring circle { stroke: ... }` overrides it with ordinary CSS
          specificity. Without any stylesheet at all this still has to read as a ring rather
          than nothing at all, so the fallback here is currentColor rather than the SVG
          default of no stroke. */}
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_SIZE / 2 - 3}
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeDasharray={`${(progress / 100) * 2 * Math.PI * (RING_SIZE / 2 - 3)} ${2 * Math.PI * (RING_SIZE / 2 - 3)}`}
          />
        </svg>
        <button
          type="button"
          ref={setButtonEl}
          className="guide-launcher"
          data-guide-part="launcher"
          aria-label={fabLabel}
          onClick={() => setOpen(true)}
        >
          {`${completedCount}/${total}`}
        </button>
      </div>
      {open && (
        <div
          ref={setContainerRefs}
          className="guide-launcher-panel"
          data-guide-part="launcher-panel"
          role="dialog"
          aria-modal="true"
          aria-label={dialogLabel}
          tabIndex={-1}
          style={{ position: 'fixed', top: `${y}px`, left: `${x}px`, zIndex: resolvedZIndex + 1 }}
        >
          <Checklist
            checklistId={checklistId}
            title={title}
            onDismiss={onDismiss}
            onActivate={onActivate}
            labels={text}
          />
        </div>
      )}
    </Portal>
  )
}
