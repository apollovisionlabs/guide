---
type: ADR
title: 0017. Advancing on an action implies an interactive step
description: A step that declares advanceOn has interactive and awaitsAction derived for it in the core, rather than requiring the caller to set both.
tags: [adr, architecture, accessibility]
status: stable
generated:
  by: claude-opus-5
  at: 2026-09-04T09:00:00Z
  directed_by: human:remy dème
---

# 0017. Advancing on an action implies an interactive step

## Status

Stable. Refines the non-modal interactive step [ADR 0008](0008-accessibility-in-the-core.md)
introduced.

## Context

A step can now advance when the user clicks its target, through `advanceOn: 'click'`
(`packages/core/src/types.ts`). For that click to reach the target at all, the step also has to be
non-modal and click-through, the behaviour [ADR 0008](0008-accessibility-in-the-core.md) already
gives a step marked `interactive: true`.

Requiring the caller to set both `interactive: true` and `advanceOn: 'click'` on the same step
would work, but it hands the caller a way to get it wrong silently: a step declaring `advanceOn`
without also declaring `interactive` would wait for a click on an element the overlay still
blocks, a dead end with no error and no warning. It would also leave every renderer, present and
future, deciding for itself whether `advanceOn` implies `interactive`, the kind of rule that
belongs in one place.

## Decision

`packages/core/src/GuideProvider.tsx` derives both flags on `ActiveStep`, the object a renderer
actually reads, rather than trusting `Step.interactive`:

```ts
interactive: step.interactive === true || step.advanceOn !== undefined,
awaitsAction: step.advanceOn !== undefined,
```

`ActiveStep.interactive` and `ActiveStep.awaitsAction` (`packages/core/src/GuideProvider.tsx`) are
the properties a renderer reads. `Step.interactive` alone continues to mean what
[ADR 0008](0008-accessibility-in-the-core.md) gave it: a click-through, non-modal step with no
auto-advance. A step that sets only `advanceOn: 'click'` is interactive by construction, and
`Step.interactive` on it is left `undefined`; a renderer that reads `step.interactive` directly,
instead of `activeStep.interactive`, would treat that step as modal and get it wrong.

`@apollovisionlabs/guide-mui` reads `awaitsAction` in two places: `StepPopover`
(`packages/mui/src/StepPopover.tsx`) replaces the primary button with the `awaitingAction` label
and ignores `ArrowRight`, and `GuideTour` (`packages/mui/src/GuideTour.tsx`) passes
`modal={!active.interactive}` to it and `interactive={active.interactive}` to `Spotlight`, exactly
as it already did for a plain interactive step.

## Consequences

- A step needs only `advanceOn: 'click'` to become interactive and auto-advancing; it does not
  also need `interactive: true`. Setting both is harmless, since `interactive` is a boolean `||`.
- Any renderer built against `@apollovisionlabs/guide-core`, not only
  `@apollovisionlabs/guide-mui`, gets this for free by reading `ActiveStep`, the same way it
  already inherits the accessibility primitives from [ADR 0008](0008-accessibility-in-the-core.md).
- The click listener that advances the step is attached to the element resolved when the step
  opened (`packages/core/src/GuideProvider.tsx`), in the bubble phase, with no `preventDefault` or
  `stopPropagation`, so the application's own click handler on that element keeps running. This
  reuses the existing target resolution rather than adding a second one; if the application
  replaces that DOM node afterward, the step stops advancing, the same pre-existing limit every
  step already has (see "Missing targets" in `README.md`).
- `packages/core/test/GuideProvider.test.tsx` (`describe('advanceOn', ...)`) asserts the click
  advances the step, that a click elsewhere does not, that the application's own handler still
  fires, and that `interactive` / `awaitsAction` are derived correctly for both an `advanceOn` step
  and a plain step. `packages/mui/test/StepPopover.test.tsx`
  (`describe('a step awaiting an action', ...)`) asserts the popover offers no button and keeps
  ignoring `ArrowRight`.

## Alternatives considered

**Require the caller to set `interactive: true` alongside `advanceOn: 'click'`.** Rejected: it is
redundant on every step that will ever declare `advanceOn`, and omitting it produces the silent
dead end described in Context, not a typecheck error or a runtime warning.
