# @apollovisionlabs/guide-mui

## 0.4.0

### Minor Changes

- bed2ddc: A step can now advance when the user clicks its target, through `advanceOn: 'click'`. Such a
  step is interactive by construction, and its popover offers no button and no arrow key that
  would skip the action it is asking for.
  
  Hotspots are new: a marker on one element, outside any tour, opening a short explanation that
  can start a tour. Opening one marks it seen, for good, through the same storage the tour and
  the checklist use.
  
  Nothing here is breaking at runtime. One source-level note for TypeScript users:
  `StepPopoverLabels` gained a required member, `awaitingAction`. The `labels` prop is a
  `Partial`, so passing labels is unaffected, but code that annotated a complete constant, as in
  `const labels: StepPopoverLabels = { ... }`, now fails to typecheck until that member is added.
  Both packages stay a minor: nothing that compiled against the published API at runtime changes
  behaviour, and the type is a new member on an interface consumers were not required to satisfy
  in full.
- f81748f: Fixed a defect present in the published `@apollovisionlabs/guide-core@0.2.0` and
  `@apollovisionlabs/guide-mui@0.3.0`: `ChecklistProvider` reads persisted progress from storage
  asynchronously, and until that read landed, every checklist rendered from its initial empty
  state. A user saw a checklist they had dismissed long ago flash its launcher on screen before
  vanishing, and a checklist with three of four items done render "0 of 4" before jumping to
  "3 of 4", on every page load.
  
  `useChecklist` gains a `restored` member, settled per checklist: `true` immediately when no
  `storage` prop was given, and `true` once that checklist's own read resolves or rejects (a
  broken storage backend now degrades to showing the checklist, not hiding it forever). Reads run
  concurrently across checklists, so a slow or hung read for one checklist cannot hold a different
  checklist's `restored` false either. `Checklist` and `ChecklistLauncher` both wait for it before
  drawing anything.
  
  Both packages stay a minor: `restored` is a new member on an existing return type, not a
  breaking change to the shape callers already destructure from, and the MUI components' visible
  behaviour changes only in removing the flash described above. The one user-visible tradeoff: with
  a slow storage backend, a checklist now appears later than it used to, rather than appearing at
  once and then jumping.

### Patch Changes

- Updated dependencies [bed2ddc]
- Updated dependencies [f81748f]
  - @apollovisionlabs/guide-core@0.3.0

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
