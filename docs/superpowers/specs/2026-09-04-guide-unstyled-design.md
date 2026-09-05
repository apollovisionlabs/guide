# An unstyled rendering layer

Date: 2026-09-04
Status: awaiting the maintainer's approval

## 1. Goal

`guide` renders in exactly one way today, through Material UI. The core has been
headless since ADR 0001, but the only layer that draws anything imposes a UI
toolkit most React applications do not use. Every feature added so far serves
that one audience.

A third package renders the same three surfaces with no toolkit at all: the
tour, the checklist and the hotspots, in plain DOM, styled by whoever installs
it. It is also the first real test of ADR 0001: if the core is genuinely
headless, a second renderer needs no change to it.

## 2. Name and shape

`@apollovisionlabs/guide-unstyled`. The name says what it is beside its sibling,
`guide-mui`, and leaves room for a styled layer later without renaming anything.

- peer dependency: `react ^19`, the same as the other two packages
- dependency: `@apollovisionlabs/guide-core`, workspace, as `guide-mui` has
- runtime dependencies: none. The repository has never had one and does not gain
  one here.

The component API mirrors `guide-mui` prop for prop wherever the prop still
means something, so moving from one layer to the other is an import change and
nothing else. `sx` and the theme have no equivalent and are simply absent;
`zIndex` stays a number.

## 3. The styling contract is the API

An unstyled component that ships no styles at all is not usable: a bubble with
no background and no position is a puzzle every adopter solves the same way. So
the split is by purpose, not by taste.

**Inline, non negotiable.** Only what breaks without it: `position`, the
computed `top` and `left`, `z-index`, `pointer-events`, and the spotlight's mask
geometry. These are layout mechanics, not appearance, and a stylesheet that
overrode them would break the component rather than restyle it.

**Everything else lives in CSS.** Every element carries a stable class name and
a `data-guide-part` attribute. Both are public API: renaming one is a breaking
change and belongs in a changeset.

**An optional stylesheet.** `@apollovisionlabs/guide-unstyled/styles.css`, a
plain file the consumer may import, giving a plain and correct appearance out of
the box. Importing it is a choice; not importing it leaves the markup bare and
fully described by its classes. It is exported through the package's `exports`
map so a bundler can find it.

The list of parts is documented as a table, because for this package that table
is the reference an adopter actually reads.

## 4. Positioning, written here rather than depended upon

The bubbles need collision handling: a tour step near the right edge of the
window must not open a popover off screen. `guide-mui` gets this from MUI's
Popper. This package has no such thing and takes no dependency to get it.

Hand written collision handling is the riskiest part of this work, and the
design answers that risk in one move: **the maths is a pure function, and the
hook is a thin wrapper over it.**

```ts
export function computePosition(
  anchor: Rect,
  floating: { width: number; height: number },
  viewport: { width: number; height: number },
  options: { placement: Placement; offset: number; padding: number },
): { x: number; y: number; placement: Placement }
```

No DOM, no React, no time. Flip, shift, and the exhausted case where neither
side fits are ordinary unit tests with numbers in and numbers out, which is the
only way this gets trustworthy. The hook that feeds it measures the anchor with
the core's `useElementRect` and the floating element with a `ResizeObserver`,
and recomputes on scroll and resize.

Behaviour:

- **flip**: if the requested side overflows and the opposite side fits, take the
  opposite. If neither fits, keep the requested side and let shift do its work,
  because moving the bubble twice is more disorienting than a tight fit.
- **shift**: clamp along the cross axis so the bubble stays inside the viewport
  minus `padding`.
- the resolved placement is returned, so the markup can carry
  `data-guide-placement` and a stylesheet can point an arrow the right way.

**A limit stated now rather than discovered.** This positions against the
viewport, not against a scrolling ancestor. A target inside its own scroll
container, near that container's edge but not the window's, is not corrected.
`guide-mui` handles that case through Popper. It is out of scope here, it is
documented, and the pure function is where it would be added later.

## 5. Portals

Every floating part renders into `document.body` through `createPortal`. Fixed
positioning is relative to the nearest ancestor carrying a `transform`, `filter`
or `contain`, so a component rendered in place would be positioned correctly
until someone animated one of its ancestors, and then silently not. Portalling
also keeps the parts out of an ancestor's `overflow: hidden`.

## 6. What it renders

Three surfaces, at parity with `guide-mui`, because a layer that does a third of
what its sibling does cannot be recommended or documented honestly.

- `GuideTour`: a spotlight, the same SVG mask approach the MUI layer uses, and a
  step popover. Honours `advanceOn`, so a step waiting for an action offers no
  primary button and ignores ArrowRight, and reads the derived
  `active.interactive`, never `step.interactive`.
- `Checklist` and `ChecklistLauncher`: the list, the progress, the dismissal,
  and the launcher with its ring. Both wait on `restored`.
- `Hotspots`: the marker and its bubble, deferring to a running or paused tour,
  and everything ADR 0018 settled.

## 7. Accessibility is not reimplemented

The core already owns the parts that are easy to get wrong: `useFocusTrap`,
`useAnnouncer`, `usePrefersReducedMotion`. This package uses them. Roles,
labels, the keyboard contract and the focus handovers match `guide-mui`
exactly, and its test suites are the blueprint: where a MUI test asserts a role
or a label, the same assertion appears here.

The two hard won behaviours from the previous branch are requirements here, not
rediscoveries: a control that unmounts as its popover closes must not drop focus
to `document.body`, and it must not claw focus back from somewhere the user
deliberately went.

Every label is overridable, and every label that interpolates a value is a
function, because word order varies by language.

## 8. Testing

- `computePosition`: pure unit tests. Flip on each of the four sides, shift on
  each axis, the case where neither side fits, a floating element larger than
  the viewport, and a zero size anchor.
- Components: Testing Library, mirroring `packages/mui/test`, which already
  covers the roles, labels, keyboard and focus contracts.
- jsdom measures nothing: every rect is zero and every element is focusable.
  `packages/mui/test/setup.ts` already models two browser rules for this reason
  and `packages/core/test/setup.ts` models one. This package's setup does the
  same, and the pure positioning function is deliberately the place where
  geometry is proved, so the component tests do not have to pretend to measure.
- Playwright: the demo application gains a route rendering the unstyled layer
  against the same tours, checklist and hotspots, so both layers are exercised
  by the same scenarios and a real browser measures the positioning.

## 9. Out of scope

- a Tailwind package. This one serves Tailwind, CSS modules and plain CSS
  equally, and a utility class build would be a fourth package with no logic of
  its own.
- animation beyond CSS transitions in the optional stylesheet, which respect
  `prefers-reduced-motion`.
- correcting position against a scrolling ancestor, as stated in section 4.
- any change to `guide-core`. If this package turns out to need one, that is a
  finding about ADR 0001 and gets recorded rather than quietly patched.

## 10. Release

A changeset adding the new package at its first minor, and touching the other
two only if something there genuinely changed. The publish is a separate human
decision, and the release workflow already publishes every public package in the
workspace.
