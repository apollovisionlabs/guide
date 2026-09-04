# Guide: advancing on an action, and hotspots

Date: 2026-09-04
Status: awaiting the maintainer's approval

## 1. Goal

Two additions, shipped together because they share the target resolution the
library already owns.

**Advancing on an action.** A step gains `advanceOn: 'click'`. The tour moves
on when the user clicks the highlighted element, not when they come back and
press Next. This closes the one place where the library's behaviour contradicts
its own intent: `interactive: true` already lets the user act on the page, and
nothing listens.

**Hotspots.** A small marker sits on an element, outside any tour, and opens a
short explanation that can start a tour. It is the third thing an onboarding
needs, after the tour that teaches a flow and the checklist that tracks the
first session: a way to point at one thing, in place, later.

## 2. Scope

In scope:

- `advanceOn: 'click'` on `Step`, honoured by the core and reflected in the
  MUI popover
- `Hotspot`, `HotspotProvider`, `useHotspots` in `@apollovisionlabs/guide-core`
- `Hotspots` in `@apollovisionlabs/guide-mui`
- both features exercised in the demo app and in Playwright

Out of scope, deliberately:

- `advanceOn: 'input' | 'change'` or a predicate. Click covers the cases that
  exist today. Widening the union later is additive and breaks nothing.
- an event distinguishing "advanced by action" from "advanced by button".
  `step:show` already records progression; nobody has asked to tell the two
  apart.
- a hotspot that reappears, or one whose lifecycle the application controls.
  Opening a hotspot marks it seen, for good.
- the apollovisionlabs website. It follows once the packages are published.

## 3. Advancing on an action

### The type

```ts
export interface Step {
  // ...
  /** Advances the tour when the user clicks the target. Implies `interactive`. */
  advanceOn?: 'click'
}
```

### Why it implies `interactive`

The spotlight covers the page and swallows clicks unless the step is
interactive, and the popover traps focus. A step that waits for a click and
does not let the click through is a dead end, so the core derives the
modality rather than asking the caller to remember:

```
interactive = step.interactive === true || step.advanceOn !== undefined
```

`ActiveStep` gains two derived, already-resolved fields, so the rule lives in
the core and no renderer has to rediscover it:

- `interactive: boolean`, as above
- `awaitsAction: boolean`, true when `advanceOn` is set

`GuideTour` reads `activeStep.interactive` instead of
`activeStep.step.interactive`.

### The listener

While the tour is running and the step's element is resolved, the provider
attaches a `click` listener to that element, in the bubble phase, and calls
the same `next()` the button calls. So the last step still emits
`tour:complete`, and persistence is unchanged.

It never calls `preventDefault` or `stopPropagation`. The application's own
handler runs first and keeps working; the tour observes, it does not
intercept. `next` is read through a ref, so a re-render does not detach and
reattach the listener.

A missing target is unaffected: the existing `onMissingTarget` policy applies
before there is any element to listen on.

**A limit, named rather than hidden.** `useTargetElement` stops observing once
it has found the element. If the application replaces that node afterwards,
the listener sits on a detached node and the step no longer advances. This is
pre-existing (the spotlight already tracks a stale rect in that case) and is
not fixed here.

### What the popover shows

A step that waits for an action must not offer a button that skips the action.
When `awaitsAction` is true, `StepPopover`:

- hides the primary button, Next and Finish alike
- ignores `ArrowRight`, which would otherwise be a hidden bypass
- keeps Back, Close and `Escape`, so the user is never trapped
- shows a line in place of the button, from a new label
  `awaitingAction`, defaulting to `Click the highlighted element to continue.`

The label joins the existing `labels` prop, so a French application overrides
it the same way it overrides `next` and `finish`.

## 4. Hotspots

### Types

```ts
export interface Hotspot {
  id: string
  /** Logical key carried by the data-guide attribute on the element. */
  target: string
  title?: string
  titleKey?: string
  body?: string
  bodyKey?: string
  /** Tour started from the hotspot's bubble. */
  tourId?: string
  placement?: Placement
}

export interface ResolvedHotspot {
  id: string
  target: string
  title: string
  body: string
  seen: boolean
  tourId?: string
  placement?: Placement
}

export interface HotspotsProgress {
  seen: string[]
}
```

A hotspot carries no `route`. It is shown when its element is on the page and
hidden when it is not, which is the same question a route would answer less
directly.

`isHotspotsProgress` joins the two guards already in `storage.ts`, and a
stored value that fails it is treated as absent.

### Provider

`HotspotProvider` takes `hotspots`, `storage`, `translate` and `onEvent`, and
sits inside `GuideProvider` so a bubble can start a tour. Like
`ChecklistProvider` it tolerates a null `GuideContext`: a hotspot carrying a
`tourId` with no provider above warns once and does nothing.

Duplicate hotspot ids throw at mount, the way duplicate tour ids do. Silence
there hides a wiring mistake until production.

One storage key holds every hotspot's state, `hotspots:seen`, whose value is
`{ seen: string[] }`. The comment on `GuideStorage` that lists `tour:<id>` and
`checklist:<id>` gains this third shape.

`seen` only ever grows, so a write that lands while the initial read is still
in flight merges correctly by union. `reset()` is the one move that subtracts
and therefore loses that race, exactly as the checklist's `reset` does; the
same comment says so at the same place.

### Hook

```ts
useHotspots(): {
  hotspots: ResolvedHotspot[]   // every hotspot, each carrying its own `seen`
  open(id: string): void
  reset(): void
}
```

The hook returns all of them rather than the unseen ones. A renderer that
needs to keep a marker mounted while its bubble is closing needs the seen one
too, and filtering is one line at the call site; hiding it in the core would
force a second, awkward accessor.

`open` marks the hotspot seen and emits. An unknown id warns and does nothing.

### Events

```ts
| { type: 'hotspot:show'; hotspotId: string }
| { type: 'hotspot:open'; hotspotId: string }
```

`hotspot:show` fires once per hotspot, when its marker is actually on screen.
`hotspot:open` fires when the bubble opens, which is the same moment the
hotspot becomes seen.

## 5. MUI rendering

`<Hotspots />` takes optional `labels`, `zIndex` and `placement`, and renders
one marker per hotspot that is unseen, or that is currently open.

Each marker is a real `<button>`, positioned `fixed` over the target's
top-right corner from the rect `useElementRect` already tracks through scroll
and resize, pulsing unless `prefers-reduced-motion` is set, which the core's
`usePrefersReducedMotion` already answers.

Clicking it opens a `Popper` holding the title, the body, and, when the
hotspot names a tour, a button that starts it. The bubble is a
`role="dialog"` with `aria-labelledby` and `aria-describedby`, traps focus
through the core's `useFocusTrap`, and closes on `Escape` or on a click
outside.

Opening marks the hotspot seen, so the provider stops listing it as unseen.
The marker keeps a local flag and stays mounted until its own bubble closes,
otherwise the bubble would lose its anchor at the moment it opened. When it
does unmount, focus returns to the target element itself, which is a real,
present element; that is simpler and quieter than the off-screen destination
the checklist launcher needed.

### Labels

```ts
export interface HotspotLabels {
  /** Accessible name of the marker. A function, because word order varies. */
  marker: (title: string) => string
  startTour: string
  close: string
}
```

Defaults are English, overridable subset by subset, matching `StepPopover`
and `Checklist`.

### Stacking

Default `theme.zIndex.drawer + 1`. A hotspot must sit above the app bar, since
the thing it points at is often in one, and below a running tour's spotlight,
which is at `theme.zIndex.modal`. A hotspot whose target lives inside a modal
dialog is therefore covered; the `zIndex` prop is the way out, and the README
says so rather than leaving it to be discovered.

## 6. Testing

Core, Vitest and jsdom:

- a click on the target advances the step, and on the last step completes the
  tour
- a click elsewhere does not advance
- the application's own click handler still runs
- `interactive` and `awaitsAction` are derived as specified
- a hotspot's seen state persists and is restored
- a corrupted stored value is ignored
- `open` on an unknown id warns and changes nothing
- duplicate hotspot ids throw

MUI, Testing Library:

- a step with `advanceOn` renders no Next button and shows the waiting label
- `ArrowRight` does not advance such a step, `Escape` still stops the tour
- a marker renders for an unseen hotspot and not for a seen one
- opening a bubble exposes a labelled dialog and marks the hotspot seen
- the bubble's tour button starts the tour

Playwright, against the demo:

- a step waits for a real click on a real button and then advances
- a hotspot opens, its tour runs, and the hotspot is gone after a reload

No new pixel snapshot, for the reason the checklist gave: the baselines are
per platform and need the Linux container, and role and label assertions catch
what matters here.

## 7. Release

One changeset, both packages minor. Nothing here is breaking: `advanceOn` is a
new optional field, and every hotspot export is new. The version bump and the
publish stay a separate, human decision.
