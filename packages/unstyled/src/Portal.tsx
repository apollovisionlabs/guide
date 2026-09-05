import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export interface PortalProps {
  children: ReactNode
}

/**
 * Renders children into `document.body`.
 *
 * Fixed positioning is relative to the nearest ancestor carrying a `transform`, `filter` or
 * `contain`. A floating part rendered in place would be positioned correctly right up until
 * someone animated an ancestor, and then silently not: rendering through `document.body`
 * avoids that ancestor entirely.
 *
 * The mounted check keeps `document` out of the first render, so server rendering never
 * touches it.
 */
export function Portal({ children }: PortalProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return createPortal(children, document.body)
}
