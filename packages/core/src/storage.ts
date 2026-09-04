import type { ChecklistProgress, GuideStorage, HotspotsProgress, TourProgress } from './types'

export function createMemoryStorage(
  initial: Record<string, unknown> = {},
): GuideStorage {
  const store = new Map<string, unknown>(Object.entries(initial))
  return {
    async read<T>(key: string) {
      return (store.get(key) ?? null) as T | null
    },
    async write<T>(key: string, value: T) {
      store.set(key, value)
    },
  }
}

export function createBrowserStorage(namespace = 'guide'): GuideStorage {
  const key = (storageKey: string) => `${namespace}:${storageKey}`
  const available = () => typeof window !== 'undefined' && !!window.localStorage

  return {
    async read<T>(storageKey: string) {
      if (!available()) return null
      try {
        const raw = window.localStorage.getItem(key(storageKey))
        return raw ? (JSON.parse(raw) as T) : null
      } catch {
        return null
      }
    },
    async write<T>(storageKey: string, value: T) {
      if (!available()) return
      try {
        window.localStorage.setItem(key(storageKey), JSON.stringify(value))
      } catch {
        // quota exceeded or storage blocked: persistence is optional
      }
    },
  }
}

/**
 * A stored value survives code changes, browser extensions and hand editing,
 * so nothing read back is trusted until its shape is checked.
 */
export function isTourProgress(value: unknown): value is TourProgress {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.stepIndex === 'number' &&
    Number.isInteger(candidate.stepIndex) &&
    candidate.stepIndex >= 0 &&
    (candidate.status === 'in-progress' || candidate.status === 'completed')
  )
}

/**
 * Same defensive posture as isTourProgress: a stored checklist value is
 * never trusted until its shape is checked.
 */
export function isChecklistProgress(value: unknown): value is ChecklistProgress {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    Array.isArray(candidate.completed) &&
    candidate.completed.every((entry) => typeof entry === 'string') &&
    typeof candidate.dismissed === 'boolean'
  )
}

/**
 * Same defensive posture as the two guards above: a stored hotspot value is never trusted
 * until its shape is checked.
 */
export function isHotspotsProgress(value: unknown): value is HotspotsProgress {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    Array.isArray(candidate.seen) &&
    candidate.seen.every((entry) => typeof entry === 'string')
  )
}
