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
import type {
  Checklist,
  ChecklistProgress,
  GuideEvent,
  GuideStorage,
  Translate,
} from './types'
import { GuideContext } from './GuideProvider'
import { isChecklistProgress } from './storage'

export interface ChecklistContextValue {
  checklists: Checklist[]
  progress: Record<string, ChecklistProgress>
  translate?: Translate
  activate: (checklistId: string, itemId: string) => void
  toggle: (checklistId: string, itemId: string) => void
  complete: (checklistId: string, itemId: string) => void
  dismiss: (checklistId: string) => void
  reset: (checklistId: string) => void
}

export const ChecklistContext = createContext<ChecklistContextValue | null>(null)

export interface ChecklistProviderProps {
  checklists: Checklist[]
  children: ReactNode
  storage?: GuideStorage
  translate?: Translate
  navigate?: (path: string) => void
  onEvent?: (event: GuideEvent) => void
}

const emptyProgress: ChecklistProgress = { completed: [], dismissed: false }

export function ChecklistProvider({
  checklists,
  children,
  storage,
  translate,
  navigate,
  onEvent,
}: ChecklistProviderProps) {
  const checklistsById = useMemo(() => {
    const map = new Map<string, Checklist>()
    for (const candidate of checklists) map.set(candidate.id, candidate)
    return map
  }, [checklists])

  const [progress, setProgress] = useState<Record<string, ChecklistProgress>>(() => {
    const initial: Record<string, ChecklistProgress> = {}
    for (const candidate of checklists) initial[candidate.id] = emptyProgress
    return initial
  })

  // Synchronous mirror of `progress`, used by complete/toggle/dismiss/reset to read the current
  // state instead of the render-time `progress` closure. Two of those calls can happen back to
  // back in the same tick with no render in between (completeItemsForTour ticking two items that
  // share a tourId is the case that surfaced this): reading the stale closure would make the
  // second call compute its next value from a snapshot that does not include the first call's
  // write, silently dropping it. progressRef is updated synchronously by applyProgress below, so
  // consecutive calls compose correctly.
  const progressRef = useRef(progress)

  const guide = useContext(GuideContext)

  const storageWarnedRef = useRef(false)
  const warnStorageFailure = useCallback((error: unknown) => {
    if (storageWarnedRef.current) return
    storageWarnedRef.current = true
    console.warn('[guide] storage failed; checklist progress will not be persisted', error)
  }, [])

  const noGuideWarnedRef = useRef(false)
  const warnNoGuide = useCallback(() => {
    if (noGuideWarnedRef.current) return
    noGuideWarnedRef.current = true
    console.warn('[guide] a checklist item needs a GuideProvider to launch a tour')
  }, [])

  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent
  const emit = useCallback((event: GuideEvent) => onEventRef.current?.(event), [])

  // Restore persisted progress once on mount: later checklist prop changes are not re-read.
  useEffect(() => {
    if (!storage) return
    let cancelled = false
    void (async () => {
      const restored: Record<string, ChecklistProgress> = {}
      for (const candidate of checklists) {
        try {
          const stored = await storage.read<unknown>(`checklist:${candidate.id}`)
          if (isChecklistProgress(stored)) restored[candidate.id] = stored
        } catch (error) {
          warnStorageFailure(error)
        }
      }
      if (!cancelled && Object.keys(restored).length > 0) {
        const merged = { ...progressRef.current, ...restored }
        progressRef.current = merged
        setProgress(merged)
      }
    })()
    return () => {
      cancelled = true
    }
    // Reads only on mount and when storage itself changes: the checklists prop is not
    // watched, so a later change to it does not trigger a re-read of persisted progress.
  }, [storage])

  // Applies one checklist's next progress. Reads and writes go through progressRef, not a
  // setProgress updater function, so this composes correctly across synchronous calls (see
  // progressRef above) without ever putting decision logic or emit calls inside a React updater:
  // Strict Mode invokes updater functions passed to setState twice to catch impurities, and an
  // emit inside one would double-fire.
  const applyProgress = useCallback(
    (checklistId: string, next: ChecklistProgress) => {
      const merged = { ...progressRef.current, [checklistId]: next }
      progressRef.current = merged
      setProgress(merged)
      if (!storage) return
      try {
        void Promise.resolve(storage.write(`checklist:${checklistId}`, next)).catch(
          warnStorageFailure,
        )
      } catch (error) {
        warnStorageFailure(error)
      }
    },
    [storage, warnStorageFailure],
  )

  // Shared lookup for every action below: one place to warn on an unknown checklist or item id,
  // so toggle, complete, activate, dismiss and reset all reject bad ids the same way.
  const resolveChecklist = useCallback(
    (checklistId: string): Checklist | null => {
      const checklist = checklistsById.get(checklistId)
      if (!checklist) {
        console.warn(`[guide] unknown checklist "${checklistId}"`)
        return null
      }
      return checklist
    },
    [checklistsById],
  )

  const resolveItem = useCallback(
    (checklistId: string, itemId: string) => {
      const checklist = resolveChecklist(checklistId)
      if (!checklist) return null
      const item = checklist.items.find((candidate) => candidate.id === itemId)
      if (!item) {
        console.warn(`[guide] unknown checklist item "${itemId}"`)
        return null
      }
      return { checklist, item }
    },
    [resolveChecklist],
  )

  // Idempotent: ticking an item that is already ticked does nothing and emits nothing. This is
  // the one place item-complete and checklist-complete are emitted, so toggle's ticking half and
  // activate's plain-item branch both delegate here rather than duplicating that logic.
  const complete = useCallback(
    (checklistId: string, itemId: string) => {
      const resolved = resolveItem(checklistId, itemId)
      if (!resolved) return
      const { checklist } = resolved

      const current = progressRef.current[checklistId] ?? emptyProgress
      if (current.completed.includes(itemId)) return

      const wasComplete =
        checklist.items.length > 0 &&
        checklist.items.every((candidate) => current.completed.includes(candidate.id))

      const nextCompleted = [...current.completed, itemId]
      applyProgress(checklistId, { ...current, completed: nextCompleted })
      emit({ type: 'checklist:item-complete', checklistId, itemId })

      const isNowComplete =
        checklist.items.length > 0 &&
        checklist.items.every((candidate) => nextCompleted.includes(candidate.id))
      if (isNowComplete && !wasComplete) emit({ type: 'checklist:complete', checklistId })
    },
    [resolveItem, applyProgress, emit],
  )

  // Marks every item across every checklist whose tourId matches the finished tour. Delegates to
  // complete, which is idempotent, so an item already ticked produces no event.
  const completeItemsForTour = useCallback(
    (tourId: string) => {
      for (const candidate of checklists) {
        for (const item of candidate.items) {
          if (item.tourId === tourId) complete(candidate.id, item.id)
        }
      }
    },
    [checklists, complete],
  )

  // Watches the tour state for a finished run and ticks the matching item once. The guard is
  // keyed by tourId rather than a plain boolean: leaving the completed state (STOP, or starting
  // another tour) clears it, so running the same tour again after a reset can tick it again.
  const handledCompletionRef = useRef<string | null>(null)
  useEffect(() => {
    const state = guide?.state
    if (!state || state.status !== 'completed' || !state.tourId) {
      handledCompletionRef.current = null
      return
    }
    if (handledCompletionRef.current === state.tourId) return
    handledCompletionRef.current = state.tourId
    completeItemsForTour(state.tourId)
  }, [guide?.state, completeItemsForTour])

  const toggle = useCallback(
    (checklistId: string, itemId: string) => {
      const resolved = resolveItem(checklistId, itemId)
      if (!resolved) return

      const current = progressRef.current[checklistId] ?? emptyProgress
      if (current.completed.includes(itemId)) {
        const nextCompleted = current.completed.filter((id) => id !== itemId)
        applyProgress(checklistId, { ...current, completed: nextCompleted })
        return
      }

      complete(checklistId, itemId)
    },
    [resolveItem, applyProgress, complete],
  )

  const dismiss = useCallback(
    (checklistId: string) => {
      if (!resolveChecklist(checklistId)) return
      const current = progressRef.current[checklistId] ?? emptyProgress
      applyProgress(checklistId, { ...current, dismissed: true })
      emit({ type: 'checklist:dismiss', checklistId })
    },
    [resolveChecklist, applyProgress, emit],
  )

  const reset = useCallback(
    (checklistId: string) => {
      if (!resolveChecklist(checklistId)) return
      applyProgress(checklistId, { completed: [], dismissed: false })
    },
    [resolveChecklist, applyProgress],
  )

  const activate = useCallback(
    (checklistId: string, itemId: string) => {
      const resolved = resolveItem(checklistId, itemId)
      if (!resolved) return
      const { item } = resolved

      if (item.tourId) {
        if (!guide) {
          warnNoGuide()
          return
        }
        void guide.start(item.tourId)
        return
      }

      if (item.href) {
        if (!navigate) {
          console.warn('[guide] a checklist item declares an href but no navigate function was provided')
          return
        }
        navigate(item.href)
        return
      }

      toggle(checklistId, itemId)
    },
    [resolveItem, guide, navigate, toggle, warnNoGuide],
  )

  const value = useMemo<ChecklistContextValue>(
    () => ({ checklists, progress, translate, activate, toggle, complete, dismiss, reset }),
    [checklists, progress, translate, activate, toggle, complete, dismiss, reset],
  )

  return <ChecklistContext.Provider value={value}>{children}</ChecklistContext.Provider>
}
