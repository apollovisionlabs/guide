'use client'

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type {
  GuideEvent,
  GuideStorage,
  MissingTargetPolicy,
  Rect,
  Step,
  Tour,
  TourProgress,
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

  // Élément qui avait le focus au démarrage du tour : le popover se démonte et se remonte à
  // chaque étape, donc son propre piège à focus ne peut pas rendre le focus à cette origine.
  const focusOriginRef = useRef<HTMLElement | null>(null)
  const storageWarnedRef = useRef(false)

  const warnStorageFailure = useCallback((error: unknown) => {
    if (storageWarnedRef.current) return
    storageWarnedRef.current = true
    console.warn('[guide] storage failed; tour progress will not be persisted', error)
  }, [])

  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent
  const emit = useCallback((event: GuideEvent) => onEventRef.current?.(event), [])

  const tour = state.tourId ? (toursById.get(state.tourId) ?? null) : null
  const step = tour ? (tour.steps[state.stepIndex] ?? null) : null
  const isActive = state.status === 'running' || state.status === 'paused'

  const routeMatches =
    !step?.route || location === undefined || matchRoute(step.route, location)

  const { element, timedOut: targetTimedOut } = useTargetElement(
    isActive && routeMatches && step ? step.target : null,
    { timeoutMs: targetTimeoutMs },
  )
  const rect = useElementRect(element)

  // Une étape dont la route ne correspond jamais ne demande aucune cible, donc aucun délai ne
  // court : sans ce compteur, un motif de route erroné ou une navigation qui échoue laisserait
  // le tour en cours, invisible et sans issue. Le délai armé ici fait s'appliquer la politique.
  const waitingForRoute = isActive && !!step && !routeMatches
  // On retient l'étape expirée plutôt qu'un booléen : sinon, l'étape suivante hériterait de
  // l'expiration de la précédente le temps d'un rendu et la politique s'appliquerait deux fois.
  const [routeTimeoutStep, setRouteTimeoutStep] = useState<Step | null>(null)

  useEffect(() => {
    if (!waitingForRoute) {
      setRouteTimeoutStep(null)
      return
    }
    const timer = setTimeout(() => setRouteTimeoutStep(step), targetTimeoutMs)
    return () => clearTimeout(timer)
  }, [waitingForRoute, step, targetTimeoutMs])

  const timedOut = targetTimedOut || (waitingForRoute && routeTimeoutStep === step)

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

  // Navigation déléguée : l'étape vit ailleurs, on demande le déplacement.
  // La destination déjà demandée pour l'étape courante est conservée dans une ref : sans
  // ça, si la route ne correspond jamais, cet effet rappellerait navigate a chaque rendu.
  const navigationRef = useRef<{ step: Step | null; destination: string | null }>({
    step: null,
    destination: null,
  })

  const start = useCallback(
    async (tourId: string, options?: { from?: number; resume?: boolean }) => {
      // Reentrance : un second appel pendant que ce meme tour tourne relirait la
      // persistance et pourrait faire reculer la progression. Changer de tour reste permis.
      if (state.tourId === tourId && state.status === 'running') return

      const target = toursById.get(tourId)
      if (!target) throw new Error(`[guide] unknown tour: ${tourId}`)
      if (target.steps.length === 0) {
        throw new Error(`[guide] tour has no steps: ${tourId}`)
      }

      if (typeof document !== 'undefined') {
        focusOriginRef.current = document.activeElement as HTMLElement | null
      }

      let stepIndex = options?.from ?? 0
      if (options?.from === undefined && options?.resume !== false && storage) {
        // Une persistance qui échoue ne doit pas empêcher le tour : on repart du début.
        let progress: TourProgress | null = null
        try {
          progress = await storage.read(tourId)
        } catch (error) {
          warnStorageFailure(error)
        }
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

      // Redémarrer le même tour sur la même étape doit renaviguer : sans cette remise à zéro,
      // la destination déjà demandée resterait mémorisée et l'effet ne rappellerait pas navigate.
      navigationRef.current = { step: null, destination: null }

      dispatch({ type: 'START', tourId, stepIndex })
      emit({ type: 'tour:start', tourId, stepIndex })
    },
    [toursById, storage, location, emit, state.tourId, state.status, warnStorageFailure],
  )

  useEffect(() => {
    if (!isActive || !step || routeMatches) return

    if (navigationRef.current.step !== step) {
      navigationRef.current = { step, destination: null }
    }

    const destination =
      step.navigateTo ?? (step.route && isLiteralRoute(step.route) ? step.route : null)

    if (!destination) return
    if (navigationRef.current.destination === destination) return
    if (!navigate) {
      console.warn('[guide] a step declares a route but no navigate function was provided')
      return
    }
    navigationRef.current.destination = destination
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

  // Persistance de la progression. Une écriture qui échoue ne casse rien : la progression
  // n'est simplement pas retenue.
  useEffect(() => {
    if (!storage || !state.tourId) return
    const status =
      state.status === 'running'
        ? 'in-progress'
        : state.status === 'completed'
          ? 'completed'
          : null
    if (!status) return
    try {
      void Promise.resolve(
        storage.write(state.tourId, { status, stepIndex: state.stepIndex }),
      ).catch(warnStorageFailure)
    } catch (error) {
      warnStorageFailure(error)
    }
  }, [storage, state.tourId, state.status, state.stepIndex, warnStorageFailure])

  // Retour du focus à son origine, une fois le tour arrêté ou terminé.
  useEffect(() => {
    if (state.status !== 'idle' && state.status !== 'completed') return
    const origin = focusOriginRef.current
    if (!origin) return
    focusOriginRef.current = null
    if (typeof document !== 'undefined' && document.contains(origin)) origin.focus()
  }, [state.status])

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
