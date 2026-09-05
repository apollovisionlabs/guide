---
'@apollovisionlabs/guide-unstyled': minor
---

The demo application now has a second route rendering the exact same tour, checklist and
hotspot declarations through this package instead of `@apollovisionlabs/guide-mui`, and
`e2e/unstyled.spec.ts` runs the same journeys the styled suite runs against it, plus a scenario
the styled suite cannot have: a tour step near the right edge of a narrow window, asserting the
popover's own box stays inside the viewport.

That real browser run caught a genuine defect: `StepPopover` applied the `zIndex` prop it was
given as its own stacking level instead of one above it, tying it with `Spotlight` at the same
level. With the tie, whichever of the two happened to mount later in the DOM painted on top, and
in practice that was the spotlight, silently swallowing every click on the popover's own
buttons. `StepPopover` now renders one level above whatever `zIndex` it receives (or the default),
matching what `@apollovisionlabs/guide-mui`'s equivalent already did and what this package's own
README already documented.

This package carries no runtime dependency beyond `@apollovisionlabs/guide-core`, with `react`
and `react-dom` as peers.
