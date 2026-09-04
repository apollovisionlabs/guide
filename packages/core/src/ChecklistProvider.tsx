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
  /**
   * Whether each checklist's initial restore from storage has settled, keyed by checklist id:
   * true immediately for a checklist when no `storage` prop was given (there is nothing to
   * wait for), and true once that checklist's own read has resolved or rejected. Settled
   * independently per checklist, so a slow or hung read for one checklist never holds another
   * checklist's rendering hostage, and a renderer can wait for its own entry without a broken
   * backend hiding it forever.
   */
  restored: Record<string, boolean>
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

  // No storage means nothing to wait for a checklist. With storage, each checklist's own entry
  // flips once its own read has settled, one way or the other: see the restore effect below.
  const [restoredById, setRestoredById] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    for (const candidate of checklists) initial[candidate.id] = !storage
    return initial
  })

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

  // guide.start rejects for a tour id the GuideProvider does not hold (a typo in an item's
  // tourId being the obvious way to hit this). Without a catch here that rejection is
  // unhandled: nothing warns and the failure is invisible. Same once-only shape as
  // warnNoGuide and warnStorageFailure above.
  const tourStartFailedWarnedRef = useRef(false)
  const warnTourStartFailure = useCallback((error: unknown) => {
    if (tourStartFailedWarnedRef.current) return
    tourStartFailedWarnedRef.current = true
    console.warn('[guide] starting a tour for a checklist item failed', error)
  }, [])

  // Same once-only shape as warnNoGuide and warnTourStartFailure: a missing navigate function
  // is a host wiring mistake, so repeating the warning on every activation only buries it.
  const noNavigateWarnedRef = useRef(false)
  const warnNoNavigate = useCallback(() => {
    if (noNavigateWarnedRef.current) return
    noNavigateWarnedRef.current = true
    console.warn('[guide] a checklist item declares an href but no navigate function was provided')
  }, [])

  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent
  const emit = useCallback((event: GuideEvent) => onEventRef.current?.(event), [])

  // Restore persisted progress once on mount: later checklist prop changes are not re-read.
  // Every checklist's read runs concurrently, not in sequence, and each one applies its own
  // progress and settles its own `restoredById` entry as soon as it lands: a hung read for one
  // checklist must never hold up another checklist's read, its progress, or its `restored` flag.
  // A single shared flag that only flipped once every read had settled tried this once and got
  // it backwards, trading a wrong-but-visible render for one that hides a working checklist
  // behind a different checklist's stuck I/O forever, exactly the outcome the "degrade to
  // showing, never hide forever" rule below exists to rule out.
  useEffect(() => {
    if (!storage) return
    let cancelled = false
    for (const candidate of checklists) {
      void (async () => {
        try {
          const stored = await storage.read<unknown>(`checklist:${candidate.id}`)
          if (!cancelled && isChecklistProgress(stored)) {
            // A read that was already in flight must never undo something the user did while it
            // was running. With a server-backed storage the read can take hundreds of
            // milliseconds, and the list is on screen and interactive for all of it.
            //
            // Merging into the live entry rather than replacing it is what makes that true. Every
            // checklist starts empty at mount, so the moves a user makes before the read lands are
            // one-way in practice: ticking an item and dismissing the list. The union of the stored
            // completions with the live ones, dismissed if either side says so, keeps both.
            // Replacing the live entry instead erased a tick the user could see on screen, and the
            // next toggle persisted the erased state.
            //
            // The union cannot subtract, so the two moves that do subtract lose against a read
            // still in flight: unticking an item the stored value has ticked, and reset. Both come
            // back when the read lands. That window is bounded by one read at mount and it is
            // strictly better than the replace it replaced, which lost these too and lost ticks
            // besides. If a deliberate clearing ever has to survive the window, it needs to be
            // sequenced against the read rather than merged with it.
            const live = progressRef.current[candidate.id] ?? emptyProgress
            const merged = {
              ...progressRef.current,
              [candidate.id]: {
                completed: live.completed.concat(
                  stored.completed.filter((id) => !live.completed.includes(id)),
                ),
                dismissed: live.dismissed || stored.dismissed,
              },
            }
            progressRef.current = merged
            setProgress(merged)
          }
        } catch (error) {
          warnStorageFailure(error)
        } finally {
          if (!cancelled) {
            setRestoredById((current) => ({ ...current, [candidate.id]: true }))
          }
        }
      })()
    }
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

  // Watches the tour state for a finished run and ticks the matching item. The guard is keyed by
  // tourId rather than a plain boolean: leaving the completed state (STOP, or starting another
  // tour) clears it, so running the same tour again after a reset can tick it again.
  //
  // Correctness does not depend on this guard. `complete` is idempotent, so deleting the ref
  // entirely leaves every test green; it only saves a repeated walk of the checklists while a
  // completed tour stays on screen. Do not read it as the thing that prevents a double tick.
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
        void guide.start(item.tourId).catch(warnTourStartFailure)
        return
      }

      if (item.href) {
        if (!navigate) {
          warnNoNavigate()
          return
        }
        navigate(item.href)
        return
      }

      toggle(checklistId, itemId)
    },
    [resolveItem, guide, navigate, toggle, warnNoGuide, warnNoNavigate, warnTourStartFailure],
  )

  const value = useMemo<ChecklistContextValue>(
    () => ({
      checklists,
      progress,
      translate,
      restored: restoredById,
      activate,
      toggle,
      complete,
      dismiss,
      reset,
    }),
    [checklists, progress, translate, restoredById, activate, toggle, complete, dismiss, reset],
  )

  return <ChecklistContext.Provider value={value}>{children}</ChecklistContext.Provider>
}
