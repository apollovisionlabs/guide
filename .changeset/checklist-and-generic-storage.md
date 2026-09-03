---
"@apollovisionlabs/guide-core": minor
"@apollovisionlabs/guide-mui": minor
---

Add a first-steps checklist alongside the tour: `ChecklistProvider`, `useChecklist`, and, in
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
