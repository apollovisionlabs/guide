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
        setProgress((current) => ({ ...current, ...restored }))
      }
    })()
    return () => {
      cancelled = true
    }
    // Reads only on mount and when storage itself changes: the checklists prop is not
    // watched, so a later change to it does not trigger a re-read of persisted progress.
  }, [storage])

  const writeProgress = useCallback(
    (checklistId: string, next: ChecklistProgress) => {
      setProgress((current) => ({ ...current, [checklistId]: next }))
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

  const toggle = useCallback(
    (checklistId: string, itemId: string) => {
      const checklist = checklistsById.get(checklistId)
      if (!checklist) {
        console.warn(`[guide] unknown checklist "${checklistId}"`)
        return
      }
      const item = checklist.items.find((candidate) => candidate.id === itemId)
      if (!item) {
        console.warn(`[guide] unknown checklist item "${itemId}"`)
        return
      }

      const current = progress[checklistId] ?? emptyProgress
      const wasComplete =
        checklist.items.length > 0 &&
        checklist.items.every((candidate) => current.completed.includes(candidate.id))

      const isTicked = current.completed.includes(itemId)
      const nextCompleted = isTicked
        ? current.completed.filter((id) => id !== itemId)
        : [...current.completed, itemId]
      const next: ChecklistProgress = { ...current, completed: nextCompleted }

      writeProgress(checklistId, next)

      if (!isTicked) {
        emit({ type: 'checklist:item-complete', checklistId, itemId })
        const isNowComplete =
          checklist.items.length > 0 &&
          checklist.items.every((candidate) => nextCompleted.includes(candidate.id))
        if (isNowComplete && !wasComplete) emit({ type: 'checklist:complete', checklistId })
      }
    },
    [checklistsById, progress, writeProgress, emit],
  )

  const dismiss = useCallback(
    (checklistId: string) => {
      const checklist = checklistsById.get(checklistId)
      if (!checklist) {
        console.warn(`[guide] unknown checklist "${checklistId}"`)
        return
      }
      const current = progress[checklistId] ?? emptyProgress
      writeProgress(checklistId, { ...current, dismissed: true })
      emit({ type: 'checklist:dismiss', checklistId })
    },
    [checklistsById, progress, writeProgress, emit],
  )

  const reset = useCallback(
    (checklistId: string) => {
      const checklist = checklistsById.get(checklistId)
      if (!checklist) {
        console.warn(`[guide] unknown checklist "${checklistId}"`)
        return
      }
      writeProgress(checklistId, { completed: [], dismissed: false })
    },
    [checklistsById, writeProgress],
  )

  const activate = useCallback(
    (checklistId: string, itemId: string) => {
      const checklist = checklistsById.get(checklistId)
      if (!checklist) {
        console.warn(`[guide] unknown checklist "${checklistId}"`)
        return
      }
      const item = checklist.items.find((candidate) => candidate.id === itemId)
      if (!item) {
        console.warn(`[guide] unknown checklist item "${itemId}"`)
        return
      }

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
    [checklistsById, guide, navigate, toggle, warnNoGuide],
  )

  const value = useMemo<ChecklistContextValue>(
    () => ({ checklists, progress, translate, activate, toggle, dismiss, reset }),
    [checklists, progress, translate, activate, toggle, dismiss, reset],
  )

  return <ChecklistContext.Provider value={value}>{children}</ChecklistContext.Provider>
}
