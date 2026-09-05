'use client'

import { useEffect, useRef } from 'react'
import { useAnnouncer, useChecklist, type ResolvedChecklistItem } from '@apollovisionlabs/guide-core'

export interface ChecklistLabels {
  dismiss: string
  progress: (completedCount: number, total: number) => string
  markComplete: (itemTitle: string) => string
  markNotComplete: (itemTitle: string) => string
}

const DEFAULT_LABELS: ChecklistLabels = {
  dismiss: 'Dismiss',
  progress: (completedCount, total) => `${completedCount} of ${total}`,
  markComplete: (itemTitle) => `Mark ${itemTitle} as complete`,
  markNotComplete: (itemTitle) => `Mark ${itemTitle} as not complete`,
}

export interface ChecklistProps {
  checklistId: string
  title?: string
  onDismiss?: () => void
  /** Called after an item is activated, with the resolved item that was activated. */
  onActivate?: (item: ResolvedChecklistItem) => void
  labels?: Partial<ChecklistLabels>
}

export function Checklist({ checklistId, title, onDismiss, onActivate, labels }: ChecklistProps) {
  const { items, completedCount, total, dismissed, restored, activate, toggle, dismiss } =
    useChecklist(checklistId)
  const announce = useAnnouncer()
  const text = { ...DEFAULT_LABELS, ...labels }
  const progressText = text.progress(completedCount, total)

  // Announces the progress whenever it changes, once restore has settled: a screen reader
  // user ticking items hears "2 of 4" the same way a sighted user reads it off the bar. The
  // ring on the launcher is invisible to them, so this is the only place progress is spoken.
  const lastAnnouncedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!restored) return
    if (lastAnnouncedRef.current === progressText) return
    lastAnnouncedRef.current = progressText
    announce(progressText)
  }, [restored, progressText, announce])

  // Nothing is drawn until the initial restore from storage has settled. Without this, a
  // checklist already dismissed, or partly completed, in storage would still render its
  // stale, pre-restore empty state for one paint: a dismissed list flashing its launcher, or
  // "0 of 4" jumping to "3 of 4".
  if (!restored) return null

  if (dismissed) return null

  const progress = total === 0 ? 0 : Math.round((completedCount / total) * 100)

  return (
    <div className="guide-checklist" data-guide-part="checklist">
      <div className="guide-checklist-header">
        {title && (
          <h2 className="guide-checklist-title" data-guide-part="checklist-title">
            {title}
          </h2>
        )}
        <span className="guide-checklist-progress" data-guide-part="checklist-progress">
          {progressText}
        </span>
        <button
          type="button"
          className="guide-button"
          data-guide-part="checklist-dismiss"
          onClick={() => {
            dismiss()
            onDismiss?.()
          }}
        >
          {text.dismiss}
        </button>
      </div>
      <div
        className="guide-checklist-bar"
        data-guide-part="checklist-bar"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        // A bar that draws nothing at all is not plain, it is absent: with these left to the
        // stylesheet the track had height 0 and the fill no colour, so a component that says it
        // renders a progress bar rendered literally nothing without CSS. Same indirection as
        // every other legibility default in this package: var() with a fallback, so it works
        // with no stylesheet AND still rethemes from one variable set on any ancestor.
        style={{
          height: 'var(--guide-bar-height, 4px)',
          background: 'var(--guide-border, #d9d9d9)',
        }}
      >
        {/* The track alone could never show progress: the computed value was spent entirely on
        aria-valuenow, so a screen reader user heard "33" while a sighted user saw a flat bar
        forever. The width is data-driven geometry, which is the one thing no stylesheet can
        know; the height simply fills the track it sits in. */}
        <div
          className="guide-checklist-bar-fill"
          data-guide-part="checklist-bar-fill"
          style={{
            width: `${progress}%`,
            height: '100%',
            background: 'var(--guide-primary, #2563eb)',
          }}
        />
      </div>
      <ul className="guide-checklist-list">
        {items.map((item) => (
          <li
            key={item.id}
            className="guide-checklist-item"
            data-guide-part="checklist-item"
            data-guide-complete={item.completed ? 'true' : 'false'}
          >
            {/* A checkbox nested inside the row's own button is a nested-interactive
            anti-pattern: a screen reader cannot announce a control inside another control, and
            a click on the checkbox would also fire the row's activation. Kept as a sibling of
            the button below, not a descendant of it. */}
            <input
              type="checkbox"
              className="guide-checklist-check"
              data-guide-part="checklist-check"
              checked={item.completed}
              aria-label={
                item.completed ? text.markNotComplete(item.title) : text.markComplete(item.title)
              }
              onChange={() => toggle(item.id)}
            />
            <button
              type="button"
              className="guide-checklist-item-button"
              onClick={() => {
                activate(item.id)
                onActivate?.(item)
              }}
            >
              <span className="guide-checklist-item-title">{item.title}</span>
              {item.body && <span className="guide-checklist-item-body">{item.body}</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
