---
'@apollovisionlabs/guide-core': minor
'@apollovisionlabs/guide-mui': minor
---

Fixed a defect present in the published `@apollovisionlabs/guide-core@0.2.0` and
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
