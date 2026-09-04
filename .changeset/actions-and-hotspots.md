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

Nothing here is breaking.
