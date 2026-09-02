import { useEffect, useState } from 'react'
import { targetSelector } from './selector'

const DEFAULT_TIMEOUT_MS = 5000

export interface UseTargetElementOptions {
  timeoutMs?: number
  attribute?: string
}

interface TargetState {
  target: string | null
  element: HTMLElement | null
  timedOut: boolean
}

const EMPTY: TargetState = { target: null, element: null, timedOut: false }

export function useTargetElement(
  target: string | null,
  options: UseTargetElementOptions = {},
): { element: HTMLElement | null; timedOut: boolean } {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, attribute = 'data-guide' } = options
  const [state, setState] = useState<TargetState>(EMPTY)

  useEffect(() => {
    if (!target || typeof document === 'undefined') {
      setState({ target, element: null, timedOut: false })
      return
    }

    const selector = targetSelector(target, attribute)
    const find = () => document.querySelector<HTMLElement>(selector)

    const found = find()
    if (found) {
      setState({ target, element: found, timedOut: false })
      return
    }

    setState({ target, element: null, timedOut: false })

    let timer: ReturnType<typeof setTimeout> | undefined

    const observer = new MutationObserver(() => {
      const candidate = find()
      if (!candidate) return
      observer.disconnect()
      if (timer) clearTimeout(timer)
      setState({ target, element: candidate, timedOut: false })
    })

    observer.observe(document.body, { childList: true, subtree: true, attributes: true })

    timer = setTimeout(() => {
      // Do not disconnect: the wait policy must be able to resume if the target appears later.
      // The observer callback and the cleanup take care of disconnecting.
      setState({ target, element: null, timedOut: true })
    }, timeoutMs)

    return () => {
      observer.disconnect()
      if (timer) clearTimeout(timer)
    }
  }, [target, timeoutMs, attribute])

  // Only expose the state when it matches the requested target: otherwise the caller would read
  // the previous step's state until the effect runs, and would skip twice.
  const current = state.target === target ? state : EMPTY
  return { element: current.element, timedOut: current.timedOut }
}
