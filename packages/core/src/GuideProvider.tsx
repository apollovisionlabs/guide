'use client'

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react'
import type {
  GuideEvent,
  GuideStorage,
  MissingTargetPolicy,
  Rect,
  Step,
  Tour,
  TourStatus,
  Translate,
} from './types'
import { initialTourState, tourReducer, type TourState } from './tourMachine'
import { isLiteralRoute, matchRoute } from './matchRoute'
import { useTargetElement } from './useTargetElement'
import { useElementRect } from './useElementRect'
import { useAnnouncer } from './a11y'
import { findMissingTargets } from './validateTour'

export interface ActiveStep {
  tourId: string
  step: Step
  stepIndex: number
  stepCount: number
  element: HTMLElement | null
  rect: Rect | null
  title: string
  body: string
  isFirst: boolean
  isLast: boolean
  next: () => void
  previous: () => void
  stop: () => void
}

export interface GuideContextValue {
  state: TourState
  activeStep: ActiveStep | null
  start: (tourId: string, options?: { from?: number; resume?: boolean }) => Promise<void>
  next: () => void
  previous: () => void
  stop: () => void
}

export const GuideContext = createContext<GuideContextValue | null>(null)

export interface GuideProviderProps {
  tours: Tour[]
  children: ReactNode
  navigate?: (path: string) => void
  location?: string
  storage?: GuideStorage
  translate?: Translate
  onEvent?: (event: GuideEvent) => void
  onMissingTarget?: MissingTargetPolicy
  targetTimeoutMs?: number
}

function resolveText(
  value: string | undefined,
  key: string | undefined,
  translate: Translate | undefined,
): string {
  if (value !== undefined) return value
  if (key === undefined) return ''
  return translate ? translate(key) : key
}

export function GuideProvider({
  tours,
  children,
  navigate,
  location,
  storage,
  translate,
  onEvent,
  onMissingTarget = 'wait',
  targetTimeoutMs = 5000,
}: GuideProviderProps) {
  const toursById = useMemo(() => {
    const map = new Map<string, Tour>()
    for (const candidate of tours) {
      if (map.has(candidate.id)) {
        throw new Error(`[guide] duplicate tour id: ${candidate.id}`)
      }
      map.set(candidate.id, candidate)
    }
    return map
  }, [tours])

  const [state, dispatch] = useReducer(tourReducer, initialTourState)
  const announce = useAnnouncer()

  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent
  const emit = useCallback((event: GuideEvent) => onEventRef.current?.(event), [])

  const tour = state.tourId ? (toursById.get(state.tourId) ?? null) : null
  const step = tour ? (tour.steps[state.stepIndex] ?? null) : null
  const isActive = state.status === 'running' || state.status === 'paused'

  const routeMatches =
    !step?.route || location === undefined || matchRoute(step.route, location)

  const { element, timedOut } = useTargetElement(
    isActive && routeMatches && step ? step.target : null,
    { timeoutMs: targetTimeoutMs },
  )
  const rect = useElementRect(element)

  const next = useCallback(() => {
    if (!tour) return
    const isLast = state.stepIndex >= tour.steps.length - 1
    dispatch({ type: 'NEXT', stepCount: tour.steps.length })
    if (isLast) emit({ type: 'tour:complete', tourId: tour.id })
  }, [tour, state.stepIndex, emit])

  const previous = useCallback(() => dispatch({ type: 'PREVIOUS' }), [])

  const stop = useCallback(() => {
    if (tour) emit({ type: 'tour:stop', tourId: tour.id, stepIndex: state.stepIndex })
    dispatch({ type: 'STOP' })
  }, [tour, state.stepIndex, emit])

  const start = useCallback(
    async (tourId: string, options?: { from?: number; resume?: boolean }) => {
      const target = toursById.get(tourId)
      if (!target) throw new Error(`[guide] unknown tour: ${tourId}`)

      let stepIndex = options?.from ?? 0
      if (options?.from === undefined && options?.resume !== false && storage) {
        const progress = await storage.read(tourId)
        if (progress?.status === 'in-progress') stepIndex = progress.stepIndex
      }

      if (process.env.NODE_ENV !== 'production') {
        const missing = findMissingTargets(target, location)
        if (missing.length > 0) {
          console.warn(
            `[guide] tour "${tourId}" declares targets that are not present on this page: ${missing.join(', ')}`,
          )
        }
      }

      dispatch({ type: 'START', tourId, stepIndex })
      emit({ type: 'tour:start', tourId, stepIndex })
    },
    [toursById, storage, location, emit],
  )

  // Navigation déléguée : l'étape vit ailleurs, on demande le déplacement.
  useEffect(() => {
    if (!isActive || !step || routeMatches) return

    const destination =
      step.navigateTo ?? (step.route && isLiteralRoute(step.route) ? step.route : null)

    if (!destination) return
    if (!navigate) {
      console.warn('[guide] a step declares a route but no navigate function was provided')
      return
    }
    navigate(destination)
  }, [isActive, step, routeMatches, navigate])

  // Cible introuvable : application de la politique.
  useEffect(() => {
    if (!timedOut || !tour || !step) return

    emit({
      type: 'target:missing',
      tourId: tour.id,
      stepIndex: state.stepIndex,
      target: step.target,
    })

    const policy = step.onMissingTarget ?? onMissingTarget
    if (policy === 'skip') dispatch({ type: 'NEXT', stepCount: tour.steps.length })
    else if (policy === 'error') dispatch({ type: 'STOP' })
    else dispatch({ type: 'PAUSE' })
  }, [timedOut, tour, step, state.stepIndex, onMissingTarget, emit])

  // Reprise automatique quand la cible réapparaît après une pause.
  useEffect(() => {
    if (state.status === 'paused' && element) dispatch({ type: 'RESUME' })
  }, [state.status, element])

  // Étape effectivement affichée.
  useEffect(() => {
    if (state.status !== 'running' || !tour || !step || !element) return
    emit({
      type: 'step:show',
      tourId: tour.id,
      stepIndex: state.stepIndex,
      target: step.target,
    })
    announce(`${state.stepIndex + 1} / ${tour.steps.length}`)
  }, [state.status, state.stepIndex, tour, step, element, emit, announce])

  // Persistance de la progression.
  useEffect(() => {
    if (!storage || !state.tourId) return
    if (state.status === 'running') {
      void storage.write(state.tourId, { status: 'in-progress', stepIndex: state.stepIndex })
    } else if (state.status === 'completed') {
      void storage.write(state.tourId, { status: 'completed', stepIndex: state.stepIndex })
    }
  }, [storage, state.tourId, state.status, state.stepIndex])

  const activeStep = useMemo<ActiveStep | null>(() => {
    if (!tour || !step || !isActive) return null
    return {
      tourId: tour.id,
      step,
      stepIndex: state.stepIndex,
      stepCount: tour.steps.length,
      element,
      rect,
      title: resolveText(step.title, step.titleKey, translate),
      body: resolveText(step.body, step.bodyKey, translate),
      isFirst: state.stepIndex === 0,
      isLast: state.stepIndex === tour.steps.length - 1,
      next,
      previous,
      stop,
    }
  }, [tour, step, isActive, state.stepIndex, element, rect, translate, next, previous, stop])

  const value = useMemo<GuideContextValue>(
    () => ({ state, activeStep, start, next, previous, stop }),
    [state, activeStep, start, next, previous, stop],
  )

  return <GuideContext.Provider value={value}>{children}</GuideContext.Provider>
}
