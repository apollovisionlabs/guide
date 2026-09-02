'use client'

import { useContext, useMemo } from 'react'
import { GuideContext } from './GuideProvider'
import type { TourStatus } from './types'

export interface UseTourResult {
  start: (options?: { from?: number; resume?: boolean }) => Promise<void>
  next: () => void
  previous: () => void
  stop: () => void
  status: TourStatus
  stepIndex: number
}

export function useTour(tourId: string): UseTourResult {
  const context = useContext(GuideContext)
  if (!context) throw new Error('[guide] useTour must be used inside a GuideProvider')

  const { state, start, next, previous, stop } = context
  const isCurrent = state.tourId === tourId

  return useMemo(
    () => ({
      start: (options) => start(tourId, options),
      next,
      previous,
      stop,
      status: isCurrent ? state.status : 'idle',
      stepIndex: isCurrent ? state.stepIndex : 0,
    }),
    [tourId, start, next, previous, stop, isCurrent, state.status, state.stepIndex],
  )
}
