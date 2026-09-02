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

    const selector = `[${attribute}="${escapeAttributeValue(target)}"]`
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
      observer.disconnect()
      setState({ target, element: null, timedOut: true })
    }, timeoutMs)

    return () => {
      observer.disconnect()
      if (timer) clearTimeout(timer)
    }
  }, [target, timeoutMs, attribute])

  // N'exposer l'etat que s'il concerne la cible demandee : sinon l'appelant lirait celui
  // de l'etape precedente jusqu'a l'execution de l'effet, et sauterait deux fois.
  const current = state.target === target ? state : EMPTY
  return { element: current.element, timedOut: current.timedOut }
}
