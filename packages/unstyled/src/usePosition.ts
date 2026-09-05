import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useElementRect, type Placement } from '@apollovisionlabs/guide-core'
import { computePosition, type Positioned, type Size } from './computePosition'

export interface UsePositionOptions {
  placement?: Placement
  /** Gap between the anchor and the floating element, in pixels. Matches the MUI layer. */
  offset?: number
  /** Smallest distance kept between the floating element and the viewport edge. Matches the MUI layer. */
  padding?: number
}

// The offset matches StepPopover's explicit 12px offset modifier. No component on this
// branch exposes a padding prop, so 8px is the default every adopter gets: enough that a
// bubble clamped to the viewport edge does not sit flush against it.
const DEFAULT_PLACEMENT: Placement = 'bottom'
const DEFAULT_OFFSET = 12
const DEFAULT_PADDING = 8

export interface UsePositionResult extends Positioned {
  /** Callback ref the floating element must carry, so its size can be measured. */
  ref: (node: HTMLElement | null) => void
}

function measure(node: HTMLElement): Size {
  const rect = node.getBoundingClientRect()
  return { width: rect.width, height: rect.height }
}

function sameSize(a: Size | null, b: Size): boolean {
  return a !== null && a.width === b.width && a.height === b.height
}

// documentElement.clientWidth/clientHeight, not window.innerWidth/innerHeight: the window
// pair includes a space-taking scrollbar, while every rect this is compared against comes from
// getBoundingClientRect, which excludes it. Clamping against the window put a right-clamped
// floating element partly underneath the scrollbar on any platform that reserves space for
// one. On a platform with overlay scrollbars the two are equal, so this costs nothing there.
function readViewport(): Size {
  return {
    width: document.documentElement.clientWidth,
    height: document.documentElement.clientHeight,
  }
}

function sameViewport(a: Size, b: Size): boolean {
  return a.width === b.width && a.height === b.height
}

const NO_POSITION: Positioned = { x: 0, y: 0, placement: DEFAULT_PLACEMENT }

export function usePosition(
  anchor: HTMLElement | null,
  options: UsePositionOptions = {},
): UsePositionResult {
  const placement = options.placement ?? DEFAULT_PLACEMENT
  const offset = options.offset ?? DEFAULT_OFFSET
  const padding = options.padding ?? DEFAULT_PADDING

  const anchorRect = useElementRect(anchor)
  const [floatingSize, setFloatingSize] = useState<Size | null>(null)
  const [viewport, setViewport] = useState<Size>(readViewport)
  const observerRef = useRef<ResizeObserver | null>(null)

  const ref = useCallback((node: HTMLElement | null) => {
    observerRef.current?.disconnect()
    observerRef.current = null

    if (!node) {
      setFloatingSize(null)
      return
    }

    setFloatingSize((previous) => {
      const next = measure(node)
      return sameSize(previous, next) ? previous : next
    })

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        setFloatingSize((previous) => {
          const next = measure(node)
          return sameSize(previous, next) ? previous : next
        })
      })
      observer.observe(node)
      observerRef.current = observer
    }
  }, [])

  useEffect(() => {
    function onViewportChange() {
      setViewport((previous) => {
        const next = readViewport()
        return sameViewport(previous, next) ? previous : next
      })
    }

    // Matches what useElementRect already listens for: scroll in the capture phase, so a
    // scroll on any ancestor is seen, and resize for the viewport itself.
    window.addEventListener('scroll', onViewportChange, true)
    window.addEventListener('resize', onViewportChange)
    return () => {
      window.removeEventListener('scroll', onViewportChange, true)
      window.removeEventListener('resize', onViewportChange)
    }
  }, [])

  const positioned = useMemo<Positioned>(() => {
    if (!anchorRect || !floatingSize) return NO_POSITION
    return computePosition(anchorRect, floatingSize, viewport, { placement, offset, padding })
  }, [anchorRect, floatingSize, viewport, placement, offset, padding])

  return useMemo(() => ({ ...positioned, ref }), [positioned, ref])
}
