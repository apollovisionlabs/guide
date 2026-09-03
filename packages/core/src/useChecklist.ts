'use client'

import { useContext, useMemo } from 'react'
import { ChecklistContext } from './ChecklistProvider'
import { resolveText } from './resolveText'
import type { ResolvedChecklistItem } from './types'

export interface UseChecklistResult {
  items: ResolvedChecklistItem[]
  completedCount: number
  total: number
  isComplete: boolean
  dismissed: boolean
  activate: (itemId: string) => void
  toggle: (itemId: string) => void
  complete: (itemId: string) => void
  dismiss: () => void
  reset: () => void
}

export function useChecklist(checklistId: string): UseChecklistResult {
  const context = useContext(ChecklistContext)
  if (!context)
    throw new Error('[guide] useChecklist must be used inside a ChecklistProvider')

  const checklist = context.checklists.find((entry) => entry.id === checklistId)
  if (!checklist) throw new Error(`[guide] unknown checklist "${checklistId}"`)

  const progress = context.progress[checklistId]
  const completed = progress?.completed ?? []
  const dismissed = progress?.dismissed ?? false
  const translate = context.translate

  const items = useMemo<ResolvedChecklistItem[]>(
    () =>
      checklist.items.map((item) => ({
        id: item.id,
        title: resolveText(item.title, item.titleKey, translate),
        body: resolveText(item.body, item.bodyKey, translate),
        completed: completed.includes(item.id),
        tourId: item.tourId,
        href: item.href,
      })),
    [checklist, completed, translate],
  )

  const total = checklist.items.length
  const completedCount = items.filter((item) => item.completed).length
  const isComplete = total > 0 && completedCount === total

  const { activate, toggle, complete, dismiss, reset } = context

  return useMemo(
    () => ({
      items,
      completedCount,
      total,
      isComplete,
      dismissed,
      activate: (itemId: string) => activate(checklistId, itemId),
      toggle: (itemId: string) => toggle(checklistId, itemId),
      complete: (itemId: string) => complete(checklistId, itemId),
      dismiss: () => dismiss(checklistId),
      reset: () => reset(checklistId),
    }),
    [
      items,
      completedCount,
      total,
      isComplete,
      dismissed,
      activate,
      toggle,
      complete,
      dismiss,
      reset,
      checklistId,
    ],
  )
}
