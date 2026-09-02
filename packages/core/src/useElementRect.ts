import { useEffect, useLayoutEffect, useState } from 'react'
import type { Rect } from './types'

// Mesurer avant la peinture : au changement d'etape, un useEffect laisserait passer une
// image ou le spotlight est encore sur la cible precedente.
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect

function sameRect(a: Rect, b: DOMRect): boolean {
  return a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height
}

export function useElementRect(element: HTMLElement | null): Rect | null {
  const [rect, setRect] = useState<Rect | null>(null)

  useIsomorphicLayoutEffect(() => {
    if (!element) {
      setRect(null)
      return
    }

    const measure = () => {
      const next = element.getBoundingClientRect()
      setRect((previous) =>
        previous && sameRect(previous, next)
          ? previous
          : { top: next.top, left: next.left, width: next.width, height: next.height },
      )
    }

    measure()

    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    observer?.observe(element)

    window.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)

    return () => {
      observer?.disconnect()
      window.removeEventListener('scroll', measure, true)
      window.removeEventListener('resize', measure)
    }
  }, [element])

  return rect
}
