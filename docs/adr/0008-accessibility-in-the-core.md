---
type: ADR
title: 0008. Accessibility lives in the core, and interactive steps are non-modal
description: The focus trap, live-region announcer and reduced-motion preference belong to the core so every renderer inherits them.
tags: [adr, a11y]
status: stable
generated:
  by: claude-opus-5
  at: 2026-09-02T14:46:46Z
  directed_by: human:remy dème
---

# 0008. Accessibility lives in the core, and interactive steps are non-modal

## Context

Focus management, screen-reader announcements and motion preferences look like rendering concerns,
so the obvious place for them is the MUI package. But putting them there means the next rendering
layer starts from zero on accessibility, the part of a tour most likely to be got wrong.

## Decision

`packages/core/src/a11y.ts` owns three primitives, exported from `@apollovisionlabs/guide-core`:

- `useFocusTrap(container, active, { initialFocus })` cycles Tab within the container and
  restores the previously focused element on teardown.
- `useAnnouncer()` exposes a single visually hidden `[data-guide-announcer]` node with
  `aria-live="polite"`, into which the provider writes `"<n> / <total>"` for every shown step.
- `usePrefersReducedMotion()` subscribes to the media query and unsubscribes on teardown.

The provider additionally restores focus to the element that had it when the tour started, because
the popover unmounts and remounts on each step and its own trap cannot own that origin.

Second half of the decision: a step marked `interactive: true` is rendered **non-modal**. No focus
trap, no `aria-modal`, and a click-through overlay (`modal={!interactive}` in
`packages/mui/src/GuideTour.tsx`). Focus enters the popover on its container, not on the close
button, so a reflex Enter after an arrow key does not end the tour.

## Consequences

- An alternative renderer gets the accessible behaviour by importing three hooks.
- A step that tells the user to click something lets them actually click it. The trade-off is
  accepted deliberately: an interactive step is not a modal dialog and is not announced as one.
- While a target is being awaited nothing is rendered, so the popover's Escape handler does not
  exist. `GuideTour` mounts a keyboard-only escape hatch for that window; without it the tour would
  be invisible and unquittable.
- Keyboard shortcuts (Escape, ArrowLeft, ArrowRight) are ignored while focus is in an input,
  textarea, select or contenteditable, so typing is never hijacked.
- Three of the seven end-to-end scenarios cover this area, and they are the tests to run first
  after touching it.
