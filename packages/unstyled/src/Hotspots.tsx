'use client'

import { useCallback, useContext, useEffect, useId, useRef, useState } from 'react'
import {
  GuideContext,
  useElementRect,
  useFocusTrap,
  useHotspots,
  useTargetElement,
  type Placement,
  type ResolvedHotspot,
} from '@apollovisionlabs/guide-core'
import { usePosition } from './usePosition'
import { Portal } from './Portal'

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

// Matches ChecklistLauncher's DEFAULT_Z_INDEX: one below StepPopover and Spotlight's shared
// 1300, so a running tour always paints in front of an ambient hotspot marker.
const DEFAULT_Z_INDEX = 1299

export interface HotspotsProps {
  labels?: Partial<HotspotLabels>
  placement?: Placement
  /** Stacking level of the markers. See DEFAULT_Z_INDEX. */
  zIndex?: number
}

export function Hotspots({ labels, placement = 'bottom', zIndex }: HotspotsProps = {}) {
  const { hotspots, restored } = useHotspots()
  const [openId, setOpenId] = useState<string | null>(null)

  // Read through the context rather than through useTour, and tolerating null, exactly as
  // HotspotProvider does: a project that uses hotspots and no tours at all has no
  // GuideProvider in its tree and must keep working.
  const guide = useContext(GuideContext)
  const tourIsLive = guide?.state.status === 'running' || guide?.state.status === 'paused'

  const text = { ...DEFAULT_LABELS, ...labels }

  // Nothing is drawn until the initial restore from storage has settled. Without this, a
  // hotspot already marked seen would still get a marker mounted (and its notifyShown effect
  // run) against the stale, pre-restore "unseen" state: a spurious flash on screen and a
  // spurious hotspot:show, the very thing the feature promises never happens again once a
  // hotspot has been opened.
  if (!restored) return null

  // An ambient hint must not compete with a guided flow the user is already in. A marker is
  // `position: fixed` over its target's top-right corner, so when a tour points at that same
  // element, `document.elementFromPoint` at the marker's centre returns the marker: the click
  // meant for an `advanceOn` step opens the bubble instead, the step never advances. On a
  // non-interactive step the marker is worse than wrong, it is drawn yet completely inert,
  // because the spotlight swallows the click. And a tour launched from a hotspot leaves that
  // hotspot's own marker holding keyboard focus over the step it just launched. All three are
  // one thing: while a tour is live, no markers.
  //
  // Suppression, not retirement. `paused` counts because a paused tour is waiting for its
  // target, not finished. When the tour ends the markers come back, unchanged: nothing here
  // touches `seen`, so a hotspot the user never opened still has something to say, and
  // `hotspot:show` stays deduplicated per mount, so no second impression is announced.
  if (tourIsLive) return null

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
  const titleId = useId()
  const bodyId = useId()
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

  // Deferred focus recovery/cleanup, stored so a component that unmounts mid-flight (the
  // bubble closes and the marker itself goes away in the same beat as the outside click that
  // triggered this) does not leave a stray timer to fire against a gone component.
  const outsideClickTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    return () => {
      clearTimeout(outsideClickTimeoutRef.current)
      clearTimeout(blurTimeoutRef.current)
    }
  }, [])

  useFocusTrap(bubble, isOpen)

  const { x, y, placement: resolvedPlacement, ref: positionRef } = usePosition(
    isOpen ? marker : null,
    { placement },
  )

  const setBubbleRefs = useCallback(
    (node: HTMLElement | null) => {
      setBubble(node)
      positionRef(node)
    },
    [positionRef],
  )

  // A rect exists for an element that is in the DOM but not rendered, all zeros, and all zeros
  // is truthy. That passed both this gate and the render guard below, and would put a marker
  // in the top-left corner of the viewport pointing at nothing. Size, not existence, is what
  // says the target is on screen. Either dimension will do: a rule or a divider is genuinely
  // there.
  const isMeasured = !!rect && (rect.width > 0 || rect.height > 0)

  // Gated on the marker actually being drawn, not merely on the target being measurable: a
  // hotspot already seen renders nothing, and announcing an impression for a marker nobody
  // saw would make the event a lie.
  const isDrawn = isMeasured && (!hotspot.seen || openedHere)
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
      // useFocusTrap's cleanup runs synchronously here and calls marker.focus(), but the
      // browser's own default action for this same mousedown, which blurs whatever is
      // currently focused when the click lands outside it, has not fired yet: it runs after
      // this listener returns and wins the race, leaving focus on document.body. Deferring the
      // check to after the current task lets that blur happen first. A click that landed on a
      // real, focusable control must be left alone (that control has already claimed focus,
      // and pulling it back would be focus theft), so the recovery only fires when focus would
      // otherwise have nowhere to land. This also has to run before the marker's own onBlur
      // below decides whether to let the marker go: see the comment there.
      clearTimeout(outsideClickTimeoutRef.current)
      outsideClickTimeoutRef.current = setTimeout(() => {
        if (document.activeElement === document.body) marker?.focus()
      })
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [isOpen, bubble, marker, onClose])

  if (!isMeasured || !rect) return null
  if (hotspot.seen && !openedHere) return null

  const onMarkerClick = () => {
    // A second click on a marker whose bubble is already open closes it, and announces
    // nothing. `open` emits hotspot:open before its seen check, so re-entering it here would
    // announce an opening for a bubble that never closed: the event would count clicks rather
    // than openings and over-count any funnel built on onEvent, while its sibling
    // hotspot:show is deduplicated for exactly this reason. Closing is also what the marker's
    // own aria-expanded already promises a screen reader user.
    if (isOpen) {
      onClose()
      return
    }
    setOpenedHere(true)
    open(hotspot.id)
    onOpen()
  }

  const resolvedZIndex = zIndex ?? DEFAULT_Z_INDEX

  return (
    <Portal>
      <button
        type="button"
        ref={setMarker}
        className="guide-hotspot"
        data-guide-part="hotspot"
        aria-label={labels.marker(hotspot.title)}
        aria-expanded={isOpen}
        onClick={onMarkerClick}
        onBlur={() => {
          if (isOpen) return
          // The outside-click recovery above briefly refocuses the marker while closing, and
          // the browser's own pending default action can then blur it straight back out
          // before that recovery has had its chance to run: this handler would otherwise see
          // that transient blur and let the marker go before the recovery lands. Deferring to
          // after the current task, same as the recovery, lets it run first: by the time this
          // check happens, focus is either back on the marker (nothing to do here) or it has
          // genuinely moved to something else (a real tab or click away, which does mean the
          // marker should go).
          clearTimeout(blurTimeoutRef.current)
          blurTimeoutRef.current = setTimeout(() => {
            if (document.activeElement !== marker) setOpenedHere(false)
          })
        }}
        // Position and stacking are mechanics, not appearance: the marker has to sit over the
        // target's top-right corner regardless of any stylesheet, so these are inline rather
        // than left to a class that might not be loaded yet. Follows the precedent in
        // packages/core/src/a11y.ts's announcerNode.
        style={{
          position: 'fixed',
          top: rect.top - MARKER_SIZE / 2,
          left: rect.left + rect.width - MARKER_SIZE / 2,
          zIndex: resolvedZIndex,
        }}
      >
        {/* width, height and fill are presentation attributes, not part of the style object,
        on purpose: a presentation attribute loses to any CSS declaration, so an adopter's own
        `.guide-hotspot circle { fill: ... }` (or `.guide-hotspot { width: ... }` on the svg)
        overrides these with ordinary CSS specificity. Without any stylesheet at all this still
        has to read as a small visible dot rather than an unstyled button with no size and no
        shape, which is exactly the failure a plain <button> with nothing inside it would be. */}
        <svg width={MARKER_SIZE} height={MARKER_SIZE} viewBox="0 0 14 14" aria-hidden="true">
          <circle cx={7} cy={7} r={6} fill="currentColor" />
        </svg>
      </button>

      {isOpen && (
        <div
          ref={setBubbleRefs}
          className="guide-hotspot-bubble"
          data-guide-part="hotspot-bubble"
          data-guide-placement={resolvedPlacement}
          role="dialog"
          aria-labelledby={titleId}
          aria-describedby={bodyId}
          tabIndex={-1}
          style={{ position: 'fixed', top: `${y}px`, left: `${x}px`, zIndex: resolvedZIndex + 1 }}
        >
          <h2 id={titleId} className="guide-hotspot-title" data-guide-part="hotspot-title">
            {hotspot.title}
          </h2>
          <p id={bodyId} className="guide-hotspot-body" data-guide-part="hotspot-body">
            {hotspot.body}
          </p>
          <div>
            {hotspot.tourId && (
              <button
                type="button"
                className="guide-button guide-button-primary"
                data-guide-part="hotspot-tour"
                onClick={() => {
                  onClose()
                  startTour(hotspot.id)
                }}
              >
                {labels.startTour}
              </button>
            )}
            <button
              type="button"
              className="guide-button"
              data-guide-part="hotspot-close"
              onClick={onClose}
            >
              {labels.close}
            </button>
          </div>
        </div>
      )}
    </Portal>
  )
}
