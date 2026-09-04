---
'@apollovisionlabs/guide-core': minor
'@apollovisionlabs/guide-mui': minor
---

A step can now advance when the user clicks its target, through `advanceOn: 'click'`. Such a
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
