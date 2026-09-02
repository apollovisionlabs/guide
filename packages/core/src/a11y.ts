import { useCallback, useEffect, useState } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export interface UseFocusTrapOptions {
  /**
   * Element that receives focus on entry. 'first' takes the first focusable element; 'container'
   * takes the container itself, which must then carry tabIndex={-1}. Defaults to 'first'.
   */
  initialFocus?: 'first' | 'container'
}

export function useFocusTrap(
  container: HTMLElement | null,
  active: boolean,
  options: UseFocusTrapOptions = {},
): void {
  const { initialFocus = 'first' } = options

  useEffect(() => {
    if (!container || !active) return

    const previouslyFocused = document.activeElement as HTMLElement | null
    // No visibility filter: the selector already excludes disabled elements and elements out of
    // the tab order, and the popover mounts or unmounts its controls rather than hiding them.
    const focusable = () => Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE))

    // 'container' avoids putting focus on an actionable button: a reflex Enter after an arrow
    // key must not close the tour.
    const first = initialFocus === 'container' ? undefined : focusable()[0]
    if (first) first.focus()
    else container.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const elements = focusable()
      if (elements.length === 0) return

      const firstElement = elements[0]!
      const lastElement = elements[elements.length - 1]!

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)

    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      previouslyFocused?.focus?.()
    }
  }, [container, active, initialFocus])
}

function announcerNode(): HTMLElement {
  const existing = document.querySelector<HTMLElement>('[data-guide-announcer]')
  if (existing) return existing

  const node = document.createElement('div')
  node.setAttribute('data-guide-announcer', '')
  node.setAttribute('aria-live', 'polite')
  node.setAttribute('aria-atomic', 'true')
  node.style.position = 'absolute'
  node.style.width = '1px'
  node.style.height = '1px'
  node.style.overflow = 'hidden'
  node.style.clip = 'rect(0 0 0 0)'
  node.style.whiteSpace = 'nowrap'
  document.body.appendChild(node)
  return node
}

export function useAnnouncer(): (message: string) => void {
  return useCallback((message: string) => {
    if (typeof document === 'undefined') return
    announcerNode().textContent = message
  }, [])
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(query.matches)
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return reduced
}
