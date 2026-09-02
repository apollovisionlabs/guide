import { useEffect, useState } from 'react'

const DEFAULT_TIMEOUT_MS = 5000

function escapeAttributeValue(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value)
  }
  return value.replace(/["\\]/g, '\\$&')
}

export interface UseTargetElementOptions {
  timeoutMs?: number
  attribute?: string
}

export function useTargetElement(
  target: string | null,
  options: UseTargetElementOptions = {},
): { element: HTMLElement | null; timedOut: boolean } {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, attribute = 'data-guide' } = options
  const [element, setElement] = useState<HTMLElement | null>(null)
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    setElement(null)
    setTimedOut(false)
    if (!target || typeof document === 'undefined') return

    const selector = `[${attribute}="${escapeAttributeValue(target)}"]`
    const find = () => document.querySelector<HTMLElement>(selector)

    const found = find()
    if (found) {
      setElement(found)
      return
    }

    let timer: ReturnType<typeof setTimeout> | undefined

    const observer = new MutationObserver(() => {
      const candidate = find()
      if (!candidate) return
      observer.disconnect()
      if (timer) clearTimeout(timer)
      setElement(candidate)
    })

    observer.observe(document.body, { childList: true, subtree: true, attributes: true })

    timer = setTimeout(() => {
      observer.disconnect()
      setTimedOut(true)
    }, timeoutMs)

    return () => {
      observer.disconnect()
      if (timer) clearTimeout(timer)
    }
  }, [target, timeoutMs, attribute])

  return { element, timedOut }
}
