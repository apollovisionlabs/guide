# An unstyled rendering layer: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A third package renders the tour, the checklist and the hotspots in plain DOM, with no UI toolkit and no runtime dependency.

**Architecture:** `@apollovisionlabs/guide-unstyled` consumes the same core hooks `guide-mui` consumes. Collision aware positioning is a pure function with a thin React wrapper. Floating parts portal into `document.body`. Appearance lives in class names and an optional stylesheet; only layout mechanics are inline.

**Tech Stack:** TypeScript, React 19, tsup, Vitest with jsdom, Testing Library, Playwright, pnpm workspaces, changesets.

**Spec:** `docs/superpowers/specs/2026-09-04-guide-unstyled-design.md`

## Global Constraints

- Never read, fetch or consult the source of Intro.js, Shepherd.js, Floating UI, Popper.js or any other positioning or tour library. They are AGPL, commercially licensed, or would make this a derivative work. The positioning maths in Task 2 is written from the geometry, not from anyone's implementation.
- **No runtime dependency.** The new package depends on `@apollovisionlabs/guide-core` (workspace) and peers on `react ^19`. Nothing else. Adding a runtime dependency is a plan violation, not a judgement call.
- **No change to `packages/core`.** If a task appears to need one, stop and report it: that is a finding about ADR 0001 and the controller rules on it. Do not patch the core quietly.
- No vocabulary from any private product. This repository is public. Demo content stays generic.
- Never emit an em dash (U+2014) or an en dash (U+2013) in anything authored: source, comments, tests, documentation, commit messages. Before each commit run `git diff -U0 | grep -nP '^\+.*[\x{2014}\x{2013}]'` and fix every hit by rewriting.
- English for code, comments, commit messages and documentation.
- Conventional Commits: lowercase type, colon, imperative subject, no trailing period.
- Accessibility parity with `guide-mui` is a requirement, not an aspiration. Where a test in `packages/mui/test/` asserts a role, a label, a keyboard behaviour or a focus destination, the equivalent assertion exists here.
- Every test must be proven to fail against the behaviour it claims to cover before the implementation is written. Nine tests that could not fail have already been caught in this repository. A test that passes at the red step is wrong: fix the test, not the code, and record what changed.
- jsdom measures nothing: every rect is zero and every element is focusable. `packages/mui/test/setup.ts` and `packages/core/test/setup.ts` already model browser rules for this reason. Follow that precedent rather than inventing a new mechanism, and keep the geometry in the pure function where it can be proved without a DOM.
- Run `pnpm test && pnpm typecheck && pnpm build` from the repository root before each commit, and read the EXIT CODE, not only the summary line: vitest can print a green summary and still exit non-zero.
- Do not publish, do not bump versions, do not push.

---

### Task 1: The package exists and builds

**Files:**
- Create: `packages/unstyled/package.json`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`, `LICENSE`
- Create: `packages/unstyled/src/index.ts`
- Create: `packages/unstyled/test/setup.ts`
- Create: `packages/unstyled/test/scaffold.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a workspace package named `@apollovisionlabs/guide-unstyled` whose `build`, `test` and `typecheck` scripts run from the root, and a test setup every later task's tests rely on.

- [ ] **Step 1: Copy the sibling's configuration and strip the toolkit**

Take `packages/mui/package.json`, `tsconfig.json`, `tsup.config.ts` and `vitest.config.ts` as the starting point. Read each before changing it; the comment in `tsup.config.ts` explaining why `treeshake` is false is load bearing and must survive.

`package.json` differs from the MUI one in exactly these ways:

```json
{
  "name": "@apollovisionlabs/guide-unstyled",
  "version": "0.0.0",
  "files": ["dist", "styles.css", "README.md", "LICENSE"],
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs"
    },
    "./styles.css": "./styles.css"
  },
  "keywords": ["react", "onboarding", "product-tour", "walkthrough", "unstyled", "headless", "accessibility"],
  "dependencies": { "@apollovisionlabs/guide-core": "workspace:*" },
  "peerDependencies": { "react": "^19" }
}
```

There are no `devDependencies` and no `@mui/material`, `@emotion/*` peers. Keep `type`, `license`, `sideEffects`, `main`, `module`, `types`, `publishConfig`, `repository` and `scripts` identical in shape to the sibling's.

`tsup.config.ts`: same as the sibling with `external` reduced to `['react', 'react-dom', '@apollovisionlabs/guide-core']`.

`LICENSE`: copy `packages/mui/LICENSE` verbatim.

- [ ] **Step 2: The test setup**

`packages/unstyled/test/setup.ts` starts as a copy of `packages/mui/test/setup.ts`. Read that file first and keep every rule it models, along with the comments explaining why each exists. Do not add rules this package does not yet need; later tasks add them when a test requires one.

- [ ] **Step 3: Write the failing scaffold test**

```ts
import { describe, expect, it } from 'vitest'
import * as unstyled from '../src/index'

describe('the package', () => {
  it('has an entry point that can be imported', () => {
    expect(unstyled).toBeTypeOf('object')
  })
})
```

- [ ] **Step 4: Run it and watch it fail**

Run: `pnpm --filter @apollovisionlabs/guide-unstyled test`
Expected: FAIL, the import of `../src/index` cannot resolve. Record the exact text.

- [ ] **Step 5: Create the entry point**

`packages/unstyled/src/index.ts` with a single line so the module exists and is not empty:

```ts
export {}
```

Later tasks replace this with real exports.

- [ ] **Step 6: Prove the workspace picked it up**

Run, and read each exit code:
- `pnpm install`
- `pnpm --filter @apollovisionlabs/guide-unstyled test`
- `pnpm typecheck`
- `pnpm build`

Expected: all pass, and `packages/unstyled/dist/index.mjs` exists after the build. Confirm `"use client";` is the first line of both `dist/index.mjs` and `dist/index.cjs`, as ADR 0005 requires.

- [ ] **Step 7: Commit**

```bash
git add packages/unstyled
git commit -m "chore: scaffold the unstyled rendering package"
```

---

### Task 2: Positioning, as a pure function

**Files:**
- Create: `packages/unstyled/src/computePosition.ts`
- Create: `packages/unstyled/test/computePosition.test.ts`
- Modify: `packages/unstyled/src/index.ts`

**Interfaces:**
- Consumes: `Placement` and `Rect` from `@apollovisionlabs/guide-core`.
- Produces: `computePosition`, `Size` and `Positioned`. Task 3 wraps it; Tasks 4, 5 and 6 use it only through that wrapper.

This is the riskiest code in the branch and the reason it is a pure function: no DOM, no React, no time, so every edge case is numbers in and numbers out.

- [ ] **Step 1: Write the failing tests**

`packages/unstyled/test/computePosition.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { computePosition } from '../src/computePosition'

const viewport = { width: 1000, height: 800 }
const floating = { width: 200, height: 100 }
const options = { placement: 'bottom' as const, offset: 8, padding: 8 }

// A comfortable anchor in the middle of the viewport, so nothing collides.
const centred = { top: 400, left: 400, width: 100, height: 40 }

describe('computePosition', () => {
  it('centres on the main axis for the requested side', () => {
    const bottom = computePosition(centred, floating, viewport, options)
    expect(bottom).toEqual({ x: 350, y: 448, placement: 'bottom' })

    const right = computePosition(centred, floating, viewport, { ...options, placement: 'right' })
    expect(right).toEqual({ x: 508, y: 370, placement: 'right' })
  })

  it('flips to the opposite side when the requested one overflows', () => {
    // 60px from the bottom edge: a 100px bubble plus an 8px offset does not fit below.
    const low = { top: 740, left: 400, width: 100, height: 40 }
    const result = computePosition(low, floating, viewport, options)
    expect(result.placement).toBe('top')
    expect(result.y).toBe(632)
  })

  it('flips on each of the four sides', () => {
    const near = {
      bottom: { top: 740, left: 400, width: 100, height: 40 },
      top: { top: 20, left: 400, width: 100, height: 40 },
      right: { top: 400, left: 900, width: 100, height: 40 },
      left: { top: 400, left: 20, width: 100, height: 40 },
    }
    const opposite = { bottom: 'top', top: 'bottom', right: 'left', left: 'right' } as const
    for (const side of ['bottom', 'top', 'right', 'left'] as const) {
      const result = computePosition(near[side], floating, viewport, { ...options, placement: side })
      expect(result.placement, `${side} should flip`).toBe(opposite[side])
    }
  })

  it('keeps the requested side when neither side fits', () => {
    const tall = { width: 200, height: 700 }
    const result = computePosition(centred, tall, viewport, options)
    expect(result.placement).toBe('bottom')
  })

  it('shifts along the cross axis rather than leaving the viewport', () => {
    const nearRight = { top: 400, left: 950, width: 40, height: 40 }
    const result = computePosition(nearRight, floating, viewport, options)
    expect(result.placement).toBe('bottom')
    expect(result.x).toBe(792)

    const nearLeft = { top: 400, left: 10, width: 40, height: 40 }
    expect(computePosition(nearLeft, floating, viewport, options).x).toBe(8)
  })

  it('shifts on the vertical axis for a side placement', () => {
    const low = { top: 770, left: 400, width: 40, height: 40 }
    const result = computePosition(low, floating, viewport, { ...options, placement: 'right' })
    expect(result.y).toBe(692)
  })

  it('clamps to the padding when the floating element is larger than the viewport', () => {
    const huge = { width: 1200, height: 100 }
    const result = computePosition(centred, huge, viewport, options)
    expect(result.x).toBe(8)
  })

  it('handles a zero size anchor without producing NaN', () => {
    const empty = { top: 0, left: 0, width: 0, height: 0 }
    const result = computePosition(empty, floating, viewport, options)
    expect(Number.isFinite(result.x)).toBe(true)
    expect(Number.isFinite(result.y)).toBe(true)
  })
})
```

Work every expected number out by hand from the geometry before running anything, and write in your report how you derived at least the two flip cases. A number copied from a failing run is not an assertion, it is a recording of whatever the code happened to do.

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm --filter @apollovisionlabs/guide-unstyled test`
Expected: the import fails because `computePosition` does not exist. Record the text.

- [ ] **Step 3: Write the function**

`packages/unstyled/src/computePosition.ts`:

```ts
import type { Placement, Rect } from '@apollovisionlabs/guide-core'

export interface Size {
  width: number
  height: number
}

export interface Positioned {
  x: number
  y: number
  placement: Placement
}

export interface PositionOptions {
  placement: Placement
  /** Gap between the anchor and the floating element, in pixels. */
  offset: number
  /** Smallest distance kept between the floating element and the viewport edge. */
  padding: number
}

const OPPOSITE: Record<Placement, Placement> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
}

function coordsFor(placement: Placement, anchor: Rect, floating: Size, offset: number) {
  const centreX = anchor.left + anchor.width / 2 - floating.width / 2
  const centreY = anchor.top + anchor.height / 2 - floating.height / 2
  switch (placement) {
    case 'top':
      return { x: centreX, y: anchor.top - floating.height - offset }
    case 'bottom':
      return { x: centreX, y: anchor.top + anchor.height + offset }
    case 'left':
      return { x: anchor.left - floating.width - offset, y: centreY }
    case 'right':
      return { x: anchor.left + anchor.width + offset, y: centreY }
  }
}

/** Only the main axis decides a flip. The cross axis is what shift corrects. */
function fitsOnMainAxis(
  placement: Placement,
  coords: { x: number; y: number },
  floating: Size,
  viewport: Size,
  padding: number,
): boolean {
  switch (placement) {
    case 'top':
      return coords.y >= padding
    case 'bottom':
      return coords.y + floating.height <= viewport.height - padding
    case 'left':
      return coords.x >= padding
    case 'right':
      return coords.x + floating.width <= viewport.width - padding
  }
}

/**
 * Places a floating element against an anchor, correcting for the viewport edges.
 *
 * Pure on purpose: no DOM, no React, no clock. Flip and shift are the two rules that go
 * wrong silently in a hand written positioner, and here they are ordinary arithmetic that
 * a test can pin down exactly.
 *
 * Positions against the viewport, not against a scrolling ancestor. A target inside its own
 * scroll container, near that container's edge but not the window's, is not corrected. That
 * is a documented limit and this function is where it would be lifted.
 */
export function computePosition(
  anchor: Rect,
  floating: Size,
  viewport: Size,
  { placement, offset, padding }: PositionOptions,
): Positioned {
  let chosen = placement
  let coords = coordsFor(chosen, anchor, floating, offset)

  if (!fitsOnMainAxis(chosen, coords, floating, viewport, padding)) {
    const opposite = OPPOSITE[chosen]
    const alternative = coordsFor(opposite, anchor, floating, offset)
    // Only move if the other side is genuinely better. Flipping into a second bad fit
    // moves the bubble twice and reads as a glitch.
    if (fitsOnMainAxis(opposite, alternative, floating, viewport, padding)) {
      chosen = opposite
      coords = alternative
    }
  }

  const alongX = chosen === 'top' || chosen === 'bottom'
  if (alongX) {
    // The lower clamp wins when the floating element is wider than the viewport, which keeps
    // it at the padding rather than pushing it off the left edge.
    const furthest = viewport.width - padding - floating.width
    coords = { ...coords, x: Math.min(Math.max(coords.x, padding), Math.max(padding, furthest)) }
  } else {
    const furthest = viewport.height - padding - floating.height
    coords = { ...coords, y: Math.min(Math.max(coords.y, padding), Math.max(padding, furthest)) }
  }

  return { x: coords.x, y: coords.y, placement: chosen }
}
```

- [ ] **Step 4: Run them and watch them pass**

Run: `pnpm --filter @apollovisionlabs/guide-unstyled test`
Expected: PASS. If a number disagrees, recheck your hand derivation before touching the code: the test may be right.

- [ ] **Step 5: Export it**

In `packages/unstyled/src/index.ts`, replace `export {}` with `export * from './computePosition'`.

- [ ] **Step 6: Run everything and commit**

Run: `pnpm test && pnpm typecheck && pnpm build`

```bash
git add packages/unstyled
git commit -m "feat(unstyled): place a floating element against the viewport edges"
```

---

### Task 3: The React wrapper and the portal

**Files:**
- Create: `packages/unstyled/src/usePosition.ts`
- Create: `packages/unstyled/src/Portal.tsx`
- Create: `packages/unstyled/test/usePosition.test.tsx`
- Modify: `packages/unstyled/src/index.ts`
- Modify: `packages/unstyled/test/setup.ts` if a browser rule must be modelled

**Interfaces:**
- Consumes: `computePosition` from Task 2, `useElementRect` from the core.
- Produces: `usePosition(anchor, options)` returning `{ x, y, placement, ref }` where `ref` is the callback ref the floating element must carry so its size can be measured, and `Portal`, which renders children into `document.body`.

- [ ] **Step 1: Write the failing tests**

Cover, each proved red:
- the hook returns the same numbers `computePosition` returns for the measured anchor and floating size, so the wiring is proved rather than assumed
- a `null` anchor produces no position and does not throw
- the position recomputes on `resize`
- `Portal` renders its children into `document.body` and not in place, asserted by checking the parent element, and removes them on unmount

`usePosition` measures the floating element with a `ResizeObserver`. jsdom has none: the setup file already stubs what this repository needs, so extend it there with a comment explaining the rule being modelled, and do not scatter stubs through individual tests.

- [ ] **Step 2: Run them and watch them fail, then write the hook and the portal**

`usePosition` composes the core's `useElementRect` for the anchor, a `ResizeObserver` for the floating element, and `computePosition`. It listens for `scroll` in the capture phase and `resize`, matching what `useElementRect` already does, and it must not recompute on every render.

`Portal` is `createPortal(children, document.body)` behind a mounted check, so server rendering does not touch `document`.

- [ ] **Step 3: Export both, run everything, commit**

```bash
git commit -m "feat(unstyled): measure and place a floating element in a portal"
```

---

### Task 4: The tour

**Files:**
- Create: `packages/unstyled/src/Spotlight.tsx`, `StepPopover.tsx`, `GuideTour.tsx`
- Create: `packages/unstyled/test/Spotlight.test.tsx`, `StepPopover.test.tsx`, `GuideTour.test.tsx`
- Modify: `packages/unstyled/src/index.ts`

**Interfaces:**
- Consumes: `usePosition` and `Portal` from Task 3; `useGuideStep`, `useFocusTrap`, `usePrefersReducedMotion` from the core.
- Produces: `GuideTour`, `Spotlight`, `StepPopover` and `StepPopoverLabels`, with the same prop names `guide-mui` uses.

**The blueprint is `packages/mui/src/Spotlight.tsx`, `StepPopover.tsx` and `GuideTour.tsx`, and their three test files.** Read all six before writing anything. Every role, label, keyboard behaviour and focus destination they assert is required here. What changes is only how it is drawn: no `Box`, no `Paper`, no `Popper`, no `useTheme`, no `sx`.

Required behaviour, all of it already proved in the MUI suites:
- the spotlight is an SVG mask with a hole over the target, `aria-hidden`, click outside the hole stops the tour, click inside does not, and it is `pointer-events: none` when the step is interactive
- the popover is `role="dialog"` with `aria-labelledby` and `aria-describedby`, traps focus when modal, and does not when the step is interactive
- `Escape` stops, `ArrowRight` advances, `ArrowLeft` goes back, all three ignored while focus is in a text input
- a step declaring `advanceOn` shows no primary button, ignores `ArrowRight`, and shows the `awaitingAction` label
- `GuideTour` reads `active.interactive` and `active.awaitsAction`, never `active.step.interactive`
- the target receives `aria-describedby` pointing at the body, removed on unmount
- transitions are disabled under `prefers-reduced-motion`

Every element carries a class and a `data-guide-part`. Use these exact values, because Task 7 documents them as public API:

| Element | class | `data-guide-part` |
| --- | --- | --- |
| spotlight svg | `guide-spotlight` | `spotlight` |
| popover container | `guide-popover` | `popover` |
| popover title | `guide-popover-title` | `popover-title` |
| popover body | `guide-popover-body` | `popover-body` |
| popover footer | `guide-popover-footer` | `popover-footer` |
| step counter | `guide-popover-count` | `popover-count` |
| waiting sentence | `guide-popover-awaiting` | `popover-awaiting` |
| next or finish button | `guide-button guide-button-primary` | `next` |
| back button | `guide-button` | `previous` |
| close button | `guide-button guide-button-icon` | `close` |

The popover also carries `data-guide-placement` with the resolved placement from `usePosition`.

Keep `data-testid="guide-spotlight"` on the spotlight, matching the MUI layer, so the demo and the e2e can address either layer the same way.

- [ ] **Step 1: Write the failing tests, mirroring `packages/mui/test`**

Port the assertions, not the MUI specifics. Prove each red before implementing. Watch the tests that assert an ABSENCE, which pass trivially against a component that rendered nothing: for each, confirm at the red step that it failed because the thing IS there.

- [ ] **Step 2: Implement, run, commit**

```bash
git commit -m "feat(unstyled): render the tour without a toolkit"
```

---

### Task 5: The checklist

**Files:**
- Create: `packages/unstyled/src/Checklist.tsx`, `ChecklistLauncher.tsx`
- Create: `packages/unstyled/test/Checklist.test.tsx`, `ChecklistLauncher.test.tsx`
- Modify: `packages/unstyled/src/index.ts`

**Interfaces:**
- Consumes: Task 3's `usePosition` and `Portal`; `useChecklist` from the core.
- Produces: `Checklist`, `ChecklistLauncher`, `ChecklistLabels`, `ChecklistLauncherLabels`.

**Blueprint: `packages/mui/src/Checklist.tsx` and `ChecklistLauncher.tsx` and their two test files.** Read them first, including their comments, which record decisions that cost real debugging: the nested interactive element that had to be restructured, the stacking level, the dismissal focus destination, and the flag cleared on blur so focus never falls to `document.body`.

Required behaviour: both render nothing until `restored`; the list is a real list, a row activates and the checkbox toggles without activating; progress is announced; the launcher shows the fraction in its accessible name because a ring is invisible to a screen reader; dismissal moves focus somewhere real without stealing it.

Parts table, exact values:

| Element | class | `data-guide-part` |
| --- | --- | --- |
| list container | `guide-checklist` | `checklist` |
| heading | `guide-checklist-title` | `checklist-title` |
| progress text | `guide-checklist-progress` | `checklist-progress` |
| progress bar | `guide-checklist-bar` | `checklist-bar` |
| item row | `guide-checklist-item` | `checklist-item` |
| item checkbox | `guide-checklist-check` | `checklist-check` |
| dismiss button | `guide-button` | `checklist-dismiss` |
| launcher button | `guide-launcher` | `launcher` |
| launcher ring | `guide-launcher-ring` | `launcher-ring` |
| launcher panel | `guide-launcher-panel` | `launcher-panel` |

A completed item carries `data-guide-complete="true"`, so a stylesheet can strike it through without the component choosing a text decoration.

- [ ] **Step 1: Write the failing tests, mirroring `packages/mui/test`. Step 2: implement, run, commit**

```bash
git commit -m "feat(unstyled): render the checklist without a toolkit"
```

---

### Task 6: The hotspots

**Files:**
- Create: `packages/unstyled/src/Hotspots.tsx`
- Create: `packages/unstyled/test/Hotspots.test.tsx`
- Modify: `packages/unstyled/src/index.ts`

**Interfaces:**
- Consumes: Task 3's `usePosition` and `Portal`; `useHotspots`, `useTargetElement`, `useElementRect` from the core.
- Produces: `Hotspots`, `HotspotLabels`.

**Blueprint: `packages/mui/src/Hotspots.tsx` and `packages/mui/test/Hotspots.test.tsx`.** This is the file that cost the most review on the previous branch, and every comment in it records a defect that shipped once. Read it and its ADR, `docs/adr/0018-hotspots-defer-to-a-running-tour.md`, before writing a line.

The behaviours that were bugs and must not be reintroduced:
- markers draw nothing while a tour is running or paused, read through a tolerated null `GuideContext`
- nothing draws until `restored`
- a marker draws only for a target with a rendered size, so a `display: none` target produces no marker and no `hotspot:show`
- the marker stays mounted while its own bubble is open, and the flag clearing that is deferred so focus never lands on `document.body`
- closing by clicking a non focusable area returns focus to the marker; closing by clicking something real leaves focus there
- clicking an already open marker closes the bubble and emits no second `hotspot:open`
- any timer stores its id and is cleared on unmount

Parts table, exact values:

| Element | class | `data-guide-part` |
| --- | --- | --- |
| marker button | `guide-hotspot` | `hotspot` |
| bubble container | `guide-hotspot-bubble` | `hotspot-bubble` |
| bubble title | `guide-hotspot-title` | `hotspot-title` |
| bubble body | `guide-hotspot-body` | `hotspot-body` |
| tour button | `guide-button guide-button-primary` | `hotspot-tour` |
| close button | `guide-button` | `hotspot-close` |

- [ ] **Step 1: Write the failing tests, mirroring `packages/mui/test/Hotspots.test.tsx`. Step 2: implement, run, commit**

```bash
git commit -m "feat(unstyled): render the hotspots without a toolkit"
```

---

### Task 7: The stylesheet, and the parts it names

**Files:**
- Create: `packages/unstyled/styles.css`
- Create: `packages/unstyled/README.md`
- Modify: `README.md` and `packages/core/README.md` and `packages/mui/README.md` where they claim the library renders only through MUI

**Interfaces:**
- Consumes: the class names and `data-guide-part` values Tasks 4, 5 and 6 actually emitted. Read the source; do not trust this plan's tables if the code disagrees, and report the disagreement.

- [ ] **Step 1: Write the stylesheet**

Plain CSS, no preprocessor, no reset, no `!important`. It styles only what the components leave unstyled: colour, spacing, borders, radius, typography, the strike through on a completed item, the pulse on a hotspot marker, and transitions guarded by `@media (prefers-reduced-motion: reduce)`.

It must not set `position`, `top`, `left`, `z-index` or `pointer-events` on any part the components position, because those are the mechanics the components own and a stylesheet fighting them is a bug.

Every colour goes through a custom property with a fallback, so an adopter can retheme by setting a handful of variables rather than rewriting rules:

```css
.guide-popover {
  background: var(--guide-surface, #ffffff);
  color: var(--guide-ink, #111111);
}
```

Document the full list of custom properties in the README.

- [ ] **Step 2: Prove the stylesheet matches the markup**

Write a test that reads `styles.css` and the built component source, extracts every `.guide-` class the stylesheet targets, and asserts each one appears in the source. A stylesheet naming a class nothing renders is dead, and a part nothing styles is invisible in the default look. Prove it red by adding a rule for a class that does not exist, then remove it.

- [ ] **Step 3: Write the package README**

It documents: installation, the two ways to use it (with and without the stylesheet), every component and prop, the full parts table, the custom properties, and the two limits from the spec, that positioning is against the viewport rather than a scrolling ancestor, and that the package has no runtime dependency.

Write it from the source, not from this plan. The previous documentation pass on this library produced five false statements caught only in review.

- [ ] **Step 4: Correct the other READMEs**

The root README and the two package READMEs describe a library with one rendering layer. Find every sentence the new package makes false or incomplete and fix it. Report each one, quoted before and after.

- [ ] **Step 5: Run everything and commit**

```bash
git commit -m "docs: the unstyled package, its parts and its stylesheet"
```

---

### Task 8: The demo proves both layers, and the release is prepared

**Files:**
- Modify: `apps/demo/src/App.tsx`, `apps/demo/src/router.tsx` and whatever a second route needs
- Create: `e2e/unstyled.spec.ts`
- Create: `.changeset/<name>.md`
- Modify: `docs/index.md`, `docs/log.md`, `docs/adr/index.md`
- Create: `docs/adr/0019-a-second-rendering-layer-with-no-toolkit.md`

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Add a route rendering the unstyled layer**

The demo already declares tours, a checklist and hotspots. The second route reuses those same declarations and swaps only the rendering components, which is the point: the core is untouched between the two. Import the stylesheet on that route so the demo shows the default look.

- [ ] **Step 2: Write the failing end to end tests**

`e2e/unstyled.spec.ts` runs the same journeys `e2e/tour.spec.ts`, `e2e/checklist.spec.ts` and `e2e/hotspots.spec.ts` run, against the unstyled route. Prove them red by pointing them at the route before it exists.

Add one scenario the MUI suite cannot have: a tour step whose target sits near the right edge of the window, asserting the popover stays inside the viewport. That is the only place the hand written positioning is measured by a real browser, so it is not optional.

- [ ] **Step 3: Write the ADR**

`docs/adr/0019-a-second-rendering-layer-with-no-toolkit.md`, following `docs/adr/template.md`. Record the decision and the three that shaped it: unstyled with an optional stylesheet rather than a Tailwind build, positioning written here rather than depended upon, and parity across all three surfaces rather than a tour only preview. Record the consequence: class names and `data-guide-part` values are public API, and renaming one is a breaking change.

- [ ] **Step 4: Update the bundle indexes and the log**

Add the ADR to `docs/adr/index.md`, anything new to `docs/index.md`, and a dated entry to `docs/log.md`, newest first.

- [ ] **Step 5: Write the changeset**

A minor for `@apollovisionlabs/guide-unstyled`. Touch the other two packages only if something in them genuinely changed. State plainly what the package is and that it carries no runtime dependency.

- [ ] **Step 6: Run everything**

Run, reading each exit code: `pnpm test`, `pnpm typecheck`, `pnpm build`, then `pnpm exec playwright test`. The e2e suite runs against `dist`, so the build must come first.

- [ ] **Step 7: Commit**

```bash
git commit -m "test(e2e): the demo renders through both layers"
```

**A note for whoever releases this.** Trusted publishing is configured per package on npmjs.com. `@apollovisionlabs/guide-unstyled` has never been published, so the release workflow will fail on it until the maintainer configures it there. That is a human step and it is not part of this plan.
