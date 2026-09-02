import type { TourStatus } from './types'

export interface TourState {
  tourId: string | null
  stepIndex: number
  status: TourStatus
}

export type TourAction =
  | { type: 'START'; tourId: string; stepIndex: number }
  | { type: 'NEXT'; stepCount: number }
  | { type: 'PREVIOUS' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'STOP' }

export const initialTourState: TourState = {
  tourId: null,
  stepIndex: 0,
  status: 'idle',
}

export function tourReducer(state: TourState, action: TourAction): TourState {
  switch (action.type) {
    case 'START':
      return { tourId: action.tourId, stepIndex: action.stepIndex, status: 'running' }

    // Navigating away from a paused tour resumes it: next() and previous() are public API, and calling them is an explicit request to move on.
    case 'NEXT': {
      if (state.status !== 'running' && state.status !== 'paused') return state
      const isLast = state.stepIndex >= action.stepCount - 1
      return isLast
        ? { ...state, status: 'completed' }
        : { ...state, stepIndex: state.stepIndex + 1, status: 'running' }
    }

    case 'PREVIOUS':
      if (state.status !== 'running' && state.status !== 'paused') return state
      return { ...state, stepIndex: Math.max(0, state.stepIndex - 1), status: 'running' }

    case 'PAUSE':
      return state.status === 'running' ? { ...state, status: 'paused' } : state

    case 'RESUME':
      return state.status === 'paused' ? { ...state, status: 'running' } : state

    case 'STOP':
      return initialTourState

    default:
      return state
  }
}
