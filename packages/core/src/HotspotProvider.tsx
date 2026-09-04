'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { GuideEvent, GuideStorage, Hotspot, Translate } from './types'
import { GuideContext } from './GuideProvider'
import { isHotspotsProgress } from './storage'

const STORAGE_KEY = 'hotspots:seen'

export interface HotspotContextValue {
  hotspots: Hotspot[]
  seen: string[]
  translate?: Translate
  /**
   * Whether the initial restore from storage has settled: true immediately when no `storage`
   * prop was given (there is nothing to wait for), and true once the read resolves or
   * rejects, so a renderer can wait for it without a broken backend hiding hotspots forever.
   */
  restored: boolean
  open: (hotspotId: string) => void
  startTour: (hotspotId: string) => void
  reset: () => void
  notifyShown: (hotspotId: string) => void
}

export const HotspotContext = createContext<HotspotContextValue | null>(null)

export interface HotspotProviderProps {
  hotspots: Hotspot[]
  children: ReactNode
  storage?: GuideStorage
  translate?: Translate
  onEvent?: (event: GuideEvent) => void
}

export function HotspotProvider({
  hotspots,
  children,
  storage,
  translate,
  onEvent,
}: HotspotProviderProps) {
  const hotspotsById = useMemo(() => {
    const map = new Map<string, Hotspot>()
    for (const candidate of hotspots) {
      // Silence here would hide a wiring mistake until production, the same way a duplicate
      // tour id would.
      if (map.has(candidate.id)) {
        throw new Error(`[guide] duplicate hotspot id: ${candidate.id}`)
      }
      map.set(candidate.id, candidate)
    }
    return map
  }, [hotspots])

  const [seen, setSeen] = useState<string[]>([])

  // No storage means nothing to wait for. With storage, this flips once the read settles,
  // one way or the other: see the restore effect below.
  const [restored, setRestored] = useState(() => !storage)

  // Synchronous mirror of `seen`, for the same reason ChecklistProvider keeps one (see
  // progressRef there): two calls in a single tick would otherwise both compute their next
  // value from the same stale render-time closure, and the first write would be dropped.
  const seenRef = useRef(seen)

  const guide = useContext(GuideContext)

  const storageWarnedRef = useRef(false)
  const warnStorageFailure = useCallback((error: unknown) => {
    if (storageWarnedRef.current) return
    storageWarnedRef.current = true
    console.warn('[guide] storage failed; hotspot state will not be persisted', error)
  }, [])

  const noGuideWarnedRef = useRef(false)
  const warnNoGuide = useCallback(() => {
    if (noGuideWarnedRef.current) return
    noGuideWarnedRef.current = true
    console.warn('[guide] a hotspot needs a GuideProvider to launch a tour')
  }, [])

  const tourStartFailedWarnedRef = useRef(false)
  const warnTourStartFailure = useCallback((error: unknown) => {
    if (tourStartFailedWarnedRef.current) return
    tourStartFailedWarnedRef.current = true
    console.warn('[guide] starting a tour for a hotspot failed', error)
  }, [])

  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent
  const emit = useCallback((event: GuideEvent) => onEventRef.current?.(event), [])

  // Restore once on mount. `seen` only ever grows, so merging by union is correct even when a
  // slow read lands after the user has already opened a hotspot: nothing the union does can
  // un-see one. `reset` is the single move that subtracts and therefore loses that race, the
  // same bounded window ChecklistProvider documents at the same place.
  useEffect(() => {
    if (!storage) return
    let cancelled = false
    void (async () => {
      let stored: unknown = null
      try {
        stored = await storage.read<unknown>(STORAGE_KEY)
      } catch (error) {
        warnStorageFailure(error)
        // A broken read must degrade to showing hotspots, not hiding them forever.
        if (!cancelled) setRestored(true)
        return
      }
      if (cancelled) return
      if (isHotspotsProgress(stored)) {
        const merged = seenRef.current.concat(
          stored.seen.filter((id) => !seenRef.current.includes(id)),
        )
        seenRef.current = merged
        setSeen(merged)
      }
      setRestored(true)
    })()
    return () => {
      cancelled = true
    }
  }, [storage, warnStorageFailure])

  const applySeen = useCallback(
    (next: string[]) => {
      seenRef.current = next
      setSeen(next)
      if (!storage) return
      try {
        void Promise.resolve(storage.write(STORAGE_KEY, { seen: next })).catch(
          warnStorageFailure,
        )
      } catch (error) {
        warnStorageFailure(error)
      }
    },
    [storage, warnStorageFailure],
  )

  const resolve = useCallback(
    (hotspotId: string): Hotspot | null => {
      const hotspot = hotspotsById.get(hotspotId)
      if (!hotspot) {
        console.warn(`[guide] unknown hotspot "${hotspotId}"`)
        return null
      }
      return hotspot
    },
    [hotspotsById],
  )

  const open = useCallback(
    (hotspotId: string) => {
      if (!resolve(hotspotId)) return
      emit({ type: 'hotspot:open', hotspotId })
      if (seenRef.current.includes(hotspotId)) return
      applySeen([...seenRef.current, hotspotId])
    },
    [resolve, applySeen, emit],
  )

  const startTour = useCallback(
    (hotspotId: string) => {
      const hotspot = resolve(hotspotId)
      if (!hotspot?.tourId) return
      if (!guide) {
        warnNoGuide()
        return
      }
      void guide.start(hotspot.tourId).catch(warnTourStartFailure)
    },
    [resolve, guide, warnNoGuide, warnTourStartFailure],
  )

  const reset = useCallback(() => applySeen([]), [applySeen])

  // Emitted by the renderer, which is the only layer that knows whether a marker is actually
  // on screen. Once per hotspot per mount: a scroll that re-measures must not re-announce.
  const shownRef = useRef<Set<string>>(new Set())
  const notifyShown = useCallback(
    (hotspotId: string) => {
      if (shownRef.current.has(hotspotId)) return
      shownRef.current.add(hotspotId)
      emit({ type: 'hotspot:show', hotspotId })
    },
    [emit],
  )

  const value = useMemo<HotspotContextValue>(
    () => ({ hotspots, seen, translate, restored, open, startTour, reset, notifyShown }),
    [hotspots, seen, translate, restored, open, startTour, reset, notifyShown],
  )

  return <HotspotContext.Provider value={value}>{children}</HotspotContext.Provider>
}
