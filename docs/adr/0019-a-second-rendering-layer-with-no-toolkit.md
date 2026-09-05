---
type: ADR
title: 0019. A second rendering layer with no toolkit
description: "@apollovisionlabs/guide-unstyled renders the tour, the checklist and the hotspots as plain DOM against the same core, with an optional stylesheet, its own hand written positioning, and parity across all three surfaces."
tags: [adr, architecture]
status: stable
generated:
  by: claude-opus-5
  at: 2026-09-05T00:00:00Z
  directed_by: human:remy dème
---

# 0019. A second rendering layer with no toolkit

## Context

[ADR 0001](0001-headless-core-and-rendering-layer.md) exists precisely so a second rendering layer
could be added as a new package against the same hooks, with no change to `packages/core`. This
work is the first time that claim was tested: `packages/unstyled` renders the tour, the checklist
and the hotspots the way `packages/mui` does, but as plain DOM elements, carrying only a
`guide-` class and a `data-guide-part` attribute, no UI toolkit and no CSS-in-JS
(`packages/unstyled/README.md`). It consumes `useGuideStep`, `useChecklist`, `useHotspots` and the
rest of the core's public surface exactly as `packages/mui` does; nothing in `packages/core`
changed to make this possible.

Three choices shaped the result and are recorded here because each had a plausible alternative.

## Decision

**Unstyled with an optional stylesheet, not a Tailwind build.** Every element ships bare, so an
adopter with their own design system starts from nothing rather than fighting utility classes.
`packages/unstyled/styles.css` gives the package a usable default look, imported separately
(`import '@apollovisionlabs/guide-unstyled/styles.css'`), never on `position`, `top`, `left`,
`z-index` or `pointer-events` on a part the components already position, so adopting it never
fights the placement the components compute themselves. `sideEffects: ["*.css"]` in
`packages/unstyled/package.json` keeps that file from being tree-shaken away by a bundler that
otherwise assumes the package is side-effect free.

**Positioning written here, not depended upon.** `packages/mui` places its popover with MUI's
`Popper`; this package has no such dependency to reach for. `computePosition`
(`packages/unstyled/src/computePosition.ts`) is a pure function, no DOM, no React, that flips a
placement to its opposite side when the main axis does not fit and clamps both axes to the
viewport unconditionally, on the stated ground that a bubble no one can read is worse than one that
overlaps the element it points at. `usePosition` (`packages/unstyled/src/usePosition.ts`) is the
only caller and the only place a real layout, a real anchor and a real window are involved.

**Parity across all three surfaces, not a tour only preview.** The tour, the checklist and the
hotspots all ship in this package, not the tour alone. A rendering layer that only proved out the
easiest of the three would say nothing about whether the core's checklist and hotspot hooks are as
toolkit-independent as the tour's; `Checklist.tsx`, `ChecklistLauncher.tsx` and `Hotspots.tsx` exist
so that claim has evidence, not just the tour's. `apps/demo` carries this out at the application
level: its second route (`apps/demo/src/UnstyledApp.tsx`) reuses the exact same `productTour`,
`onboardingChecklist` and `hotspots` declarations the first route renders through
`@apollovisionlabs/guide-mui`, swapping only the rendering components. A route that declared its
own tour would have proven nothing about the core being shared.

## Consequences

- A `guide-` class name or a `data-guide-part` value is public API from this point on: an adopter's
  stylesheet targets them, and the shipped stylesheet targets them itself. Renaming one is a
  breaking change, exactly as a prop rename is.
- `computePosition`'s collision handling is proved today by pure unit tests
  (`packages/unstyled/test/computePosition.test.ts`), numbers in and numbers out, plus one real
  browser assertion in `e2e/unstyled.spec.ts`: a tour step whose target sits near the right edge of
  a narrow window, asserting the popover's own box stays inside the viewport rather than merely
  that Playwright considers it visible. Being visible and hanging off the edge are not the same
  thing, and only a real browser measures the difference.
- `packages/unstyled` depends on `@apollovisionlabs/guide-core` and peer-depends on `react` and
  `react-dom`. It carries no runtime dependency beyond `@apollovisionlabs/guide-core`, and none of
  a UI toolkit or a positioning library, which is the sentence to reach for rather than "no runtime
  dependency": the `dependencies` entry on the core is real and would mislead a reader who checked
  and found it.
- A future third rendering layer, for a different design system, follows the same shape this one
  did: no change to `packages/core`, its own positioning if it needs one, and parity across the
  tour, the checklist and the hotspots rather than the tour alone.
