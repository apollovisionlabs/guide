'use client'

import { useContext, useMemo } from 'react'
import { HotspotContext } from './HotspotProvider'
import { resolveText } from './resolveText'
import type { ResolvedHotspot } from './types'

export interface UseHotspotsResult {
  /**
   * Every hotspot, each carrying its own `seen`, rather than the unseen ones alone. A
   * renderer has to keep a marker mounted while its own bubble closes, so it needs the seen
   * one too; filtering is one line at the call site.
   */
  hotspots: ResolvedHotspot[]
  /**
   * Whether the initial restore from storage has settled. A renderer should wait for this
   * before drawing any marker, or a hotspot already seen in storage can flash on screen once
   * before the restore lands.
   */
  restored: boolean
  open: (hotspotId: string) => void
  startTour: (hotspotId: string) => void
  reset: () => void
  notifyShown: (hotspotId: string) => void
}

export function useHotspots(): UseHotspotsResult {
  const context = useContext(HotspotContext)
  if (!context)
    throw new Error('[guide] useHotspots must be used inside a HotspotProvider')

  const { seen, translate, restored, open, startTour, reset, notifyShown } = context

  const hotspots = useMemo<ResolvedHotspot[]>(
    () =>
      context.hotspots.map((hotspot) => ({
        id: hotspot.id,
        target: hotspot.target,
        title: resolveText(hotspot.title, hotspot.titleKey, translate),
        body: resolveText(hotspot.body, hotspot.bodyKey, translate),
        seen: seen.includes(hotspot.id),
        tourId: hotspot.tourId,
        placement: hotspot.placement,
      })),
    [context.hotspots, seen, translate],
  )

  return useMemo(
    () => ({ hotspots, restored, open, startTour, reset, notifyShown }),
    [hotspots, restored, open, startTour, reset, notifyShown],
  )
}
