# @apollovisionlabs/guide-mui

## 0.3.0

### Minor Changes

- 73fd247: Add a `labels` prop to `Checklist` and `ChecklistLauncher` so their own chrome can be
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

## 0.2.0

### Minor Changes

- 37a0618: Add a first-steps checklist alongside the tour: `ChecklistProvider`, `useChecklist`, and, in
  `@apollovisionlabs/guide-mui`, `Checklist` and `ChecklistLauncher`. An item is completed by
  finishing its linked tour or by a manual tick; an `href` item navigates without completing itself.
  Completion is idempotent, and progress persists and can be dismissed.
  
  This widens `GuideStorage` to make room for it, and both changes are breaking:
  
  - `GuideStorage.read` and `GuideStorage.write` are now generic over the stored value
    (`read<T>(key)`, `write<T>(key, value)`) instead of fixed to `TourProgress` keyed by tour id. A
    custom `GuideStorage` implementation must widen its own signature to match.
  - Tour progress now persists under the key `tour:<id>` instead of the bare tour id. Progress
    written by an earlier version is orphaned: a user in the middle of a tour restarts it once, from
    the beginning, after upgrading.
  
  Dismissing `ChecklistLauncher` now leaves a brief off screen status message and moves focus to it,
  so a keyboard user is not dropped on the document body when the button and its popover unmount
  together.
  
  Stored values are also validated before they are trusted, which they were not before. A corrupted
  or hand edited entry that 0.1.x would have resumed from is now ignored and the tour starts from
  its first step.

### Patch Changes

- Updated dependencies [37a0618]
  - @apollovisionlabs/guide-core@0.2.0

## 0.1.1

### Patch Changes

- No change to the published code. This version exists to exercise the release workflow end to end,
  so that trusted publishing is proven to work before a release that matters depends on it.
- Updated dependencies
  - @apollovisionlabs/guide-core@0.1.1

## 0.1.0

### Minor Changes

- First public release: a headless React onboarding/tour engine (`@apollovisionlabs/guide-core`) with a spotlight-and-popover MUI renderer (`@apollovisionlabs/guide-mui`). Supports multi-page tours, pluggable persistence, translations, and keyboard/screen-reader accessible steps.

### Patch Changes

- Updated dependencies
  - @apollovisionlabs/guide-core@0.1.0
