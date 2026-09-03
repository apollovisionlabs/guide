---
"@apollovisionlabs/guide-mui": minor
---

Add a `labels` prop to `Checklist` and `ChecklistLauncher` so their own chrome can be
translated, matching the pattern `StepPopover` and `GuideTour` already use. Previously the
dismiss button, the checkbox accessible names, the progress text, the launcher's accessible
name, and its dismissal confirmation were hardcoded English, even when every item title and
body was already going through `translate`.

`ChecklistLabels` (exported from `@apollovisionlabs/guide-mui`) covers `Checklist`, and
`ChecklistLauncherLabels` extends it with the launcher's own two strings. The entries that
interpolate a value are functions rather than template strings, since word order around a
count or a title is not the same in every language:

```ts
interface ChecklistLabels {
  dismiss: string
  progress: (completedCount: number, total: number) => string
  markComplete: (itemTitle: string) => string
  markNotComplete: (itemTitle: string) => string
}
```

Both props accept a partial override; anything left out keeps its English default, so this is
backward compatible for existing consumers. `ChecklistLauncher` passes its resolved labels
through to the `Checklist` it renders inside its popover.
