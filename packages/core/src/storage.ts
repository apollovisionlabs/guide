import type { GuideStorage, TourProgress } from './types'

export function createMemoryStorage(
  initial: Record<string, TourProgress> = {},
): GuideStorage {
  const store = new Map<string, TourProgress>(Object.entries(initial))
  return {
    async read(tourId) {
      return store.get(tourId) ?? null
    },
    async write(tourId, progress) {
      store.set(tourId, progress)
    },
  }
}

export function createBrowserStorage(namespace = 'guide'): GuideStorage {
  const key = (tourId: string) => `${namespace}:${tourId}`
  const available = () => typeof window !== 'undefined' && !!window.localStorage

  return {
    async read(tourId) {
      if (!available()) return null
      try {
        const raw = window.localStorage.getItem(key(tourId))
        return raw ? (JSON.parse(raw) as TourProgress) : null
      } catch {
        return null
      }
    },
    async write(tourId, progress) {
      if (!available()) return
      try {
        window.localStorage.setItem(key(tourId), JSON.stringify(progress))
      } catch {
        // quota exceeded or storage blocked: persistence is optional
      }
    },
  }
}
