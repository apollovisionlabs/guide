'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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

// The inset an adopter most often needs to change, to clear a fixed cookie banner or a mobile
// tab bar. It has to be inline, because the anchor's `position: fixed` is mechanics the
// component owns, but a flat `24` inline would beat any rule an adopter writes and leave
// `!important` as the only way out. Through a custom property, setting
// `--guide-launcher-offset` on any ancestor moves it with ordinary CSS.
const CORNER_INSET = 'var(--guide-launcher-offset, 24px)'
const RING_SIZE = 64

// Matches StepPopover and Spotlight's DEFAULT_Z_INDEX. The launcher must stay one level below
// that so a running tour's spotlight and popover always paint in front of it, never behind it.
const DEFAULT_Z_INDEX = 1299

function cornerStyle(placement: NonNullable<ChecklistLauncherProps['placement']>): {
  top?: string
  bottom?: string
  left?: string
  right?: string
} {
  return {
    ...(placement.startsWith('bottom') ? { bottom: CORNER_INSET } : { top: CORNER_INSET }),
    ...(placement.endsWith('right') ? { right: CORNER_INSET } : { left: CORNER_INSET }),
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

  // Deferred focus recovery, stored so a component that unmounts mid-flight leaves no stray
  // timer to fire against a gone component. Same reason as Hotspots.tsx's.
  const outsideClickTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(outsideClickTimeoutRef.current), [])

  // Mirrors the hotspot bubble's own outside-click close in this same package (see
  // Hotspots.tsx), rather than inventing a second mechanism: mousedown, ignoring the panel and
  // the launcher button, so clicking the page dismisses the panel instead of leaving it open
  // while the click lands on the content underneath.
  useEffect(() => {
    if (!open || !container) return
    const onPointerDown = (event: MouseEvent) => {
      const node = event.target as Node
      if (container.contains(node)) return
      if (buttonEl?.contains(node)) return
      close()
      // useFocusTrap's cleanup runs synchronously here and restores focus to the launcher
      // button, but the browser's own default action for this same mousedown, which blurs
      // whatever is focused when the click lands outside it, has not fired yet: it runs after
      // this listener returns and wins the race, leaving focus on document.body. Deferring the
      // check to after the current task lets that blur happen first. A click that landed on a
      // real, focusable control is left alone: that control has already claimed focus, and
      // pulling it back would be focus theft.
      clearTimeout(outsideClickTimeoutRef.current)
      outsideClickTimeoutRef.current = setTimeout(() => {
        if (document.activeElement === document.body) buttonEl?.focus()
      })
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open, container, buttonEl, close])

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
          // This element exists only as a focus destination: nobody, styled or not, is meant
          // to see it, so hiding it is mechanics rather than appearance the styling contract
          // reserves to a class. `announcerNode` in packages/core/src/a11y.ts settles the same
          // question the same way, setting these properties directly on the node it creates;
          // this mirrors that precedent rather than leaving the sink plainly visible until a
          // stylesheet happens to be loaded, the same failure the spotlight shipped with.
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: 1,
            height: 1,
            overflow: 'hidden',
            clip: 'rect(0 0 0 0)',
            whiteSpace: 'nowrap',
          }}
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
  // needs the screen: a tour, whose spotlight and popover paint above the panel and whose focus
  // trap would fight this one, or a navigation away from the current page.
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
          // Deliberately no aria-modal. This layer traps focus but applies neither aria-hidden
          // nor inert to the rest of the application, so aria-modal="true" promised a screen
          // reader an inertness that is not there: its virtual cursor can still read the page
          // behind the panel. Making the claim true would mean marking every sibling of the
          // portal inert, a whole mechanism this package does not have and the hotspot bubble
          // in the same package does not claim either. Dropping the claim is the honest half.
          aria-label={dialogLabel}
          tabIndex={-1}
          // background and color are inline for legibility, not appearance: with no stylesheet
          // loaded the panel's background computes to rgba(0, 0, 0, 0) and the checklist's text
          // prints straight over the page copy behind it. They are var() references rather than
          // flat colours so an adopter still rethemes them by setting one custom property.
          style={{
            position: 'fixed',
            top: `${y}px`,
            left: `${x}px`,
            zIndex: resolvedZIndex + 1,
            background: 'var(--guide-surface, #ffffff)',
            color: 'var(--guide-ink, #111111)',
          }}
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
