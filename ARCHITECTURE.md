---
type: Guide
title: Architecture
description: How the two packages of this monorepo are layered, and the mechanisms that make a guided tour work.
tags: [architecture, monorepo, react, packages]
status: stable
generated:
  by: claude-opus-5
  at: 2026-09-02T14:46:46Z
  directed_by: human:remy dème
---

# Architecture

This document describes the internals. For the public API (every prop, every event, every
option a consumer passes), see [README.md](README.md); it is not repeated here.

## Repository layout

```
packages/core/     @apollovisionlabs/guide-core:  state machine, DOM resolution, a11y, persistence. No UI dependency.
packages/mui/      @apollovisionlabs/guide-mui:   MUI rendering of what the core exposes.
apps/demo/         demo:         private three-page Vite app, also the Playwright fixture.
e2e/               Playwright specs run against apps/demo.
```

`pnpm-workspace.yaml` declares `packages/*` and `apps/*`. Only `packages/*` are published;
`apps/demo` is `"private": true`.

## The layering rule

`@apollovisionlabs/guide-core` (`packages/core/package.json`) peer-depends on `react` alone. It imports nothing
from MUI, from Emotion, or from any router. That is the boundary: every decision that could be
rendered differently by a different design system lives in the core, and `@apollovisionlabs/guide-mui` only draws.

`@apollovisionlabs/guide-mui` declares `@apollovisionlabs/guide-core` as a real dependency and MUI, Emotion and React as peers.
Its whole surface is three components (`packages/mui/src/index.ts`).

## Data flow of a running tour

1. A consumer renders `GuideProvider` (`packages/core/src/GuideProvider.tsx`) with an array of
   `Tour` objects, and calls `useTour(id).start()` (`packages/core/src/useTour.ts`).
2. The provider reduces state through a pure reducer, `tourReducer`
   (`packages/core/src/tourMachine.ts`), over `idle | running | paused | completed`.
3. For the current step it resolves a DOM element (target resolution, below), measures its
   viewport rectangle, and assembles an `ActiveStep` object.
4. `useGuideStep()` (`packages/core/src/useGuideStep.ts`) exposes that object.
   `GuideTour` (`packages/mui/src/GuideTour.tsx`) reads it and renders `Spotlight` + `StepPopover`.

The provider never renders anything itself. Swapping the renderer means writing another component
against `useGuideStep()`.

## Target resolution by logical key

A step names a `target`, which is a **logical key**, never a CSS selector. The key is matched
against a `data-guide` attribute:

- `packages/core/src/selector.ts` builds `[data-guide="<escaped key>"]`, using `CSS.escape` when
  available and a manual fallback otherwise. The same builder is used by runtime resolution and by
  the development-time validation in `validateTour.ts`, so a key containing a quote cannot be
  valid on one path and a `SyntaxError` on the other.
- `packages/core/src/useTargetElement.ts` looks the element up. If it is absent, a
  `MutationObserver` on `document.body` (`childList`, `subtree`, `attributes`) waits for it, up to
  `targetTimeoutMs` (default 5000).
- The hook only reports state that belongs to the currently requested target. Returning the
  previous step's state for one render would make the tour skip two steps at once.
- On timeout the observer is deliberately **not** disconnected, so the `wait` policy can still
  resume when the element appears later.

The missing-target policy (`skip`, `wait`, `error`; `wait` by default) is applied by an effect in
the provider, which also emits `target:missing`.

### Route timeouts rely on step object identity

A step whose `route` never matches the current location requests no target, so the target timer
never runs. The provider arms a second timer for that case, and stores the *step object* that
timed out (`routeTimeoutStep`) rather than a boolean, so the next step does not inherit the
previous step's expiry for a render.

The consequence is a real constraint on consumers: because the comparison is by object identity,
tours must be declared as **module constants**, not as inline literals recreated on every render.
An inline literal produces a new step object each render, the effect restarts, and the timer never
fires, so the missing-target policy would silently never apply. `apps/demo/src/tours.ts` shows the
documented pattern.

## Cross-page tours without a router dependency

A step may declare `route` (a pattern, matched by `packages/core/src/matchRoute.ts`, supporting
`:param` segments and a `*` wildcard) and `navigateTo` (a concrete path). When the current
`location` does not match, the provider calls the `navigate` function supplied by the consumer.
The core therefore depends on no router; `apps/demo/src/App.tsx` wires React Router's
`useNavigate` and `useLocation` into those two props.

The destination already requested for the current step is kept in a ref, so a route that never
matches does not call `navigate` on every render; `start()` resets that ref so restarting the same
tour on the same step navigates again.

## Spotlight geometry

`Spotlight` (`packages/mui/src/Spotlight.tsx`) is a single fixed-position SVG covering the
viewport: one full-size rectangle filled with a themed overlay colour, masked by a second
rectangle over the target's rectangle plus padding.

The rectangle comes from `packages/core/src/useElementRect.ts`, which measures in a
`useLayoutEffect` (falling back to `useEffect` outside the browser). Measuring in a plain effect
would let one frame through with the spotlight still on the previous step's element. It re-measures
on `ResizeObserver` callbacks, on capture-phase `scroll`, and on `resize`, and returns the previous
object when the rectangle is unchanged so consumers do not re-render needlessly.

The SVG mask cuts the *rendering*, not the hit area. `Spotlight` therefore compares the click
coordinates against the hole rectangle and only dismisses on a click outside it; an interactive
step sets `pointer-events: none` on the whole overlay instead.

## Accessibility belongs to the core

`packages/core/src/a11y.ts` owns three primitives, so an alternative renderer inherits them:

- `useFocusTrap(container, active, { initialFocus })` cycles Tab and Shift+Tab inside the
  container and restores the previously focused element on teardown. `initialFocus: 'container'`
  is used by the popover so a reflex Enter after an arrow key does not hit the close button.
- `useAnnouncer()` writes into a single visually hidden `[data-guide-announcer]` node with
  `aria-live="polite"`; the provider announces `"<n> / <total>"` on every shown step.
- `usePrefersReducedMotion()` subscribes to the media query; the spotlight drops its transition.

The provider also restores focus to whatever was focused when the tour started: the popover
unmounts and remounts on every step, so its own trap cannot own that origin.

A step marked `interactive: true` is rendered **non-modal** on purpose (`modal={!interactive}` in
`GuideTour.tsx`): no focus trap, no `aria-modal`, a click-through overlay. Otherwise the user
could not reach the element the step tells them to click.

## Persistence

`GuideStorage` is a two-method async interface (`packages/core/src/types.ts`). The core ships
`createMemoryStorage()` and `createBrowserStorage(namespace)` (`packages/core/src/storage.ts`).
Neither performs any network access, and the packages make none of their own: the only outward
signal is the `onEvent` callback the consumer supplies.

Storage failure is non-fatal by design. A read that throws starts the tour from the beginning, a
write that throws is swallowed, and the provider warns once per session.

## Known seams

Recorded as facts, not as complaints:

- `@apollovisionlabs/guide-mui` exports `Spotlight` and `StepPopover` together with their full prop interfaces
  (`packages/mui/src/index.ts`). That publishes an internal seam as a public contract: changing
  either prop object is a breaking change for consumers, even though `GuideTour` is the intended
  entry point.
- `useTour` returns `start`, `next`, `previous`, `stop`, `status`, `stepIndex`. It does **not**
  expose `complete()`, although the design document
  (`docs/superpowers/specs/2026-09-02-guide-onboarding-design.md`, §API) lists it. Completion is
  reachable only by calling `next()` on the last step.
- `packages/mui/tsconfig.json` maps `@apollovisionlabs/guide-core` to `../core/src/index.ts` and includes
  `../core/src/globals.d.ts`. See [ADR 0009](docs/adr/0009-typecheck-core-through-sources.md) for
  the two consequences: a core type error is reported as a `@apollovisionlabs/guide-mui` failure, and the emitted
  `.d.ts` files are never validated by `pnpm typecheck`.

## Build and packaging

Both packages build with tsup to ESM + CJS + declarations, with a `"use client"` banner and
`treeshake: false`. The reasoning is in [INFRA.md](INFRA.md) and
[ADR 0005](docs/adr/0005-disable-treeshake-to-keep-use-client.md).
