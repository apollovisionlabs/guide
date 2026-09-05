# @apollovisionlabs/guide-unstyled

A rendering layer for [`@apollovisionlabs/guide-core`](../core/README.md) that draws the tour, the
checklist and the hotspots as plain DOM elements: no UI toolkit, no CSS-in-JS, no design tokens.
Every part carries a `guide-` class and a `data-guide-part` attribute and nothing else, so you can
style it with your own CSS, adopt the stylesheet this package ships, or use both (the stylesheet
sets appearance only; anything more specific you write still wins).

## Installation

```bash
pnpm add @apollovisionlabs/guide-core @apollovisionlabs/guide-unstyled
```

Peer dependencies are `react` and `react-dom`, both `^19`. Beyond those and
`@apollovisionlabs/guide-core`, this package has no other dependency: no UI toolkit, no styling
runtime.

## Two ways to use it

**Without the stylesheet.** Import the components and render them under `GuideProvider` (and
`ChecklistProvider` / `HotspotProvider`, as needed) exactly as documented in the
[root README](../../README.md). Almost everything is unstyled HTML carrying its `guide-` class,
with no spacing, border or typography of its own, ready for your own stylesheet to target. Five
things do ship a visible default, because without them the layer is not plain, it is broken:

| What | Default | How to change it |
| --- | --- | --- |
| The three floating surfaces (popover, hotspot bubble, launcher panel) | `background: var(--guide-surface, #ffffff)` and `color: var(--guide-ink, #111111)`, set inline | Set `--guide-surface` / `--guide-ink` on any ancestor. |
| The spotlight overlay | a 50% black fill, an SVG presentation attribute | Any CSS `fill` rule, or `--guide-overlay` with the stylesheet loaded. |
| The launcher progress ring | `stroke="currentColor"`, an SVG presentation attribute | Any CSS `stroke` or `color` rule. |
| The hotspot marker's dot | `fill="currentColor"`, an SVG presentation attribute | Any CSS `fill` or `color` rule. |
| The checklist progress bar | a 4px track in `--guide-border` with a fill in `--guide-primary`, set inline | Set `--guide-bar-height`, `--guide-border` or `--guide-primary`. |

The surfaces' two colours are inline because a transparent panel prints its text straight over
the page copy behind it, with no boundary at all, which is unreadable rather than plain; the
progress bar's are inline because a bar with no height and no colour draws nothing at all, and a
component that says it renders a bar and renders nothing is absent rather than plain. All of them
are `var()` references rather than flat colours on purpose: a flat inline colour would beat every rule
an adopter writes and make the package unthemeable, whereas this renders correctly with no
stylesheet at all and still yields to one custom property set anywhere above it. The three SVG
defaults are presentation attributes, which lose to any CSS declaration, for the same reason.

**With the stylesheet.** Import the CSS once, anywhere in your app:

```ts
import '@apollovisionlabs/guide-unstyled/styles.css'
```

This gives every part a default look: colour, spacing, borders, radius, typography, the strike
through on a completed checklist item and the pulse on a hotspot marker. It never sets
`position`, `top`, `left`, `z-index` or `pointer-events` on a part the components already
position, so it never fights the placement or stacking the components compute themselves. Retheme
it by setting the custom properties listed below; anything you declare on `.guide-*` yourself
still overrides it with ordinary CSS specificity, including the spotlight's `fill` and the
launcher ring's `stroke`, which the components set as SVG presentation attributes for exactly this
reason.

## Components

### `GuideTour`

Renders the active tour step: `Spotlight` plus `StepPopover`. Reads the current step from
`useGuideStep()` (from `@apollovisionlabs/guide-core`); render one `<GuideTour />` under
`GuideProvider` and nothing else is required to show a running tour.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `zIndex` | `number` | `1300` | Passed to both `Spotlight` and `StepPopover`, which sits one above it. |
| `padding` | `number` | `8` | Passed to `Spotlight`. |
| `radius` | `number` | `8` | Passed to `Spotlight`. |
| `labels` | `Partial<StepPopoverLabels>` | see `StepPopover` | Passed to `StepPopover`. |

While a step's target is awaited (not yet resolved), `GuideTour` renders nothing visible but still
listens for `Escape` to stop the tour, because neither `Spotlight` nor `StepPopover` is mounted
during the wait.

### `Spotlight`

The dimmed overlay with a hole cut over the target. Exported for advanced composition; `GuideTour`
renders it for you in the normal case.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `rect` | `Rect \| null` | none | The target's rectangle. Renders nothing when `null`. |
| `padding` | `number` | `8` | Margin, in pixels, between the target and the edge of the hole. |
| `radius` | `number` | `8` | Corner radius, in pixels, of the hole. |
| `interactive` | `boolean` | `false` | When `true`, the overlay is `pointer-events: none` and a click never stops the tour. |
| `zIndex` | `number` | `1300` | Stacking level of the overlay. |
| `onDismiss` | `() => void` | none | Called on a click outside the hole, when not `interactive`. |

### `StepPopover`

The tour's dialog: title, body, step count and navigation buttons.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `anchorEl` | `HTMLElement \| null` | none | The element the popover positions against. |
| `open` | `boolean` | none | Whether to render. |
| `title` | `string` | none | Step title. |
| `body` | `string` | none | Step body. |
| `stepIndex` / `stepCount` | `number` | none | Shown as `stepIndex + 1 / stepCount`. |
| `isFirst` / `isLast` | `boolean` | none | Hides the back button on the first step; shows the `finish` label on the last. |
| `placement` | `Placement` | `'bottom'` | Preferred side; flips and clamps to the viewport (see "Positioning" below). |
| `zIndex` | `number` | `1300` | Stacking level. |
| `describeElement` | `HTMLElement \| null` | none | Element that receives `aria-describedby`, pointing at the body, for as long as the popover is open. |
| `modal` | `boolean` | `true` | Traps focus when `true`. Pass `false` for an interactive step, so the user can reach the page. |
| `awaitsAction` | `boolean` | `false` | Replaces the primary button with the `awaitingAction` label and ignores `ArrowRight`. |
| `labels` | `Partial<StepPopoverLabels>` | see below | Button and status wording. |
| `onNext` / `onPrevious` / `onStop` | `() => void` | none | Called by the matching button or keyboard shortcut. |

`StepPopoverLabels` defaults: `{ next: 'Next', previous: 'Back', finish: 'Finish', close: 'Close', awaitingAction: 'Click the highlighted element to continue.' }`.

`Escape` stops the tour, `ArrowRight` advances, `ArrowLeft` goes back; all three are ignored while
focus is in a text input, and `ArrowRight` is also ignored while `awaitsAction` is set.

**Rendering it standalone: pass `modal={false}`.** With `modal` left at its default the popover
emits `aria-modal="true"`, which tells a screen reader that everything outside it is inert. Under
`GuideTour` that is true, because the `Spotlight` overlay is mounted with it and really does swallow
the page. Rendered on its own it is not: this layer applies neither `aria-hidden` nor `inert` to
anything, so the claim would be a promise nothing keeps, exactly the one `ChecklistLauncher`'s panel
deliberately does not make. Pass `modal={false}` unless you are supplying an inert layer of your
own, in which case keep the default and the claim is yours to honour.

### `Checklist`

Renders a checklist inline: a progress bar, one row per item with a checkbox and a dismiss button.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `checklistId` | `string` | none | Passed to `useChecklist`. |
| `title` | `string` | none | Rendered as a heading when set. |
| `onDismiss` | `() => void` | none | Called after the checklist is dismissed. |
| `onActivate` | `(item: ResolvedChecklistItem) => void` | none | Called after any row is activated. |
| `labels` | `Partial<ChecklistLabels>` | see below | Wording. |

`ChecklistLabels` defaults: `{ dismiss: 'Dismiss', progress: (completed, total) => \`${completed} of ${total}\`, markComplete: (title) => \`Mark ${title} as complete\`, markNotComplete: (title) => \`Mark ${title} as not complete\` }`.

Renders nothing until the checklist's own restore from storage has settled
(`useChecklist(checklistId).restored`), so a checklist already dismissed or partly completed never
flashes its pre-restore state for one paint.

The progress bar is determinate: `guide-checklist-bar` is the track and `guide-checklist-bar-fill`
inside it carries the percentage as an inline `width`, so the same number a screen reader reads off
`aria-valuenow` is the one a sighted user sees. The track's height and both colours are inline too,
through `--guide-bar-height`, `--guide-border` and `--guide-primary`, so the bar is drawn with no
stylesheet loaded and still rethemes from those three variables. The stylesheet adds only its
margin and its corner radius.

**Differs from `@apollovisionlabs/guide-mui`:** this `Checklist` announces its progress through
`useAnnouncer` whenever it changes, so a screen reader user ticking items hears "2 of 4" the way a
sighted user reads it off the bar. The MUI layer's `Checklist` does not. This is deliberate, not an
oversight on either side, but it does mean the two layers are not identical to assistive
technology; the MUI layer is expected to gain the announcement rather than this one to lose it.

### `ChecklistLauncher`

Wraps `Checklist` behind a floating button showing `completedCount/total`, opened as a panel.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `checklistId` | `string` | none | Passed to `Checklist` and `useChecklist`. |
| `title` | `string` | none | Passed to `Checklist`; also the panel's accessible name. |
| `placement` | `'bottom-right' \| 'bottom-left' \| 'top-right' \| 'top-left'` | `'bottom-right'` | Corner of the viewport the button sits in. |
| `zIndex` | `number` | `1299` | Stacking level of the button; the panel sits one above it. |
| `labels` | `Partial<ChecklistLauncherLabels>` | see below | Wording, extends `ChecklistLabels`. |

`ChecklistLauncherLabels` adds `fabLabel: (title, completed, total) => \`${title}, ${completed} of ${total} complete\`` (the button's accessible name; the ring around it is decorative and invisible to a screen reader) and `dismissed: (title) => \`${title} dismissed\`` (a focus destination announced when the panel is dismissed).

The panel closes on `Escape` and on a click anywhere outside it (the launcher button itself
excepted, which toggles it), mirroring the hotspot bubble in this same package. Focus returns to
the launcher button either way.

The panel is a `role="dialog"` that traps focus, but it deliberately carries **no `aria-modal`**.
This layer applies neither `aria-hidden` nor `inert` to the rest of the application, so a screen
reader's virtual cursor can still reach the page behind the panel, and claiming `aria-modal="true"`
would promise an inertness that is not there. The MUI layer's panel is rendered by MUI's own
`Modal`, which does apply `aria-hidden` to the rest of the app, so it makes the claim honestly.

Dismissing from inside the panel removes both the button and the panel in the same commit. Because
nothing would be left to return focus to, an off-screen status message takes focus for a moment
and then removes itself, so a keyboard user hears the dismissal confirmed instead of landing on
`document.body`.

### `Hotspots`

Renders a marker at each unseen hotspot's target; clicking it opens a bubble with the hotspot's
title, body, and, when it names a `tourId`, a button that starts that tour.

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `labels` | `Partial<HotspotLabels>` | see below | Wording. |
| `placement` | `Placement` | `'bottom'` | Where the bubble opens relative to the marker. Overridable per hotspot through `Hotspot.placement`. |
| `zIndex` | `number` | `1299` | Stacking level of the marker; the bubble sits one above it. |

`HotspotLabels` defaults: `{ marker: (title) => \`Show what is new: ${title}\`, startTour: 'Show me', close: 'Close' }`.

Renders nothing while a tour is running or paused (read through `GuideContext`, tolerating its
absence), nothing until the hotspot's own restore from storage has settled, and no marker for a
target with no rendered size (a `display: none` target, for instance).

## Parts

Every part below carries the listed class and `data-guide-part`. These are a stable contract:
build selectors against them.

| Element | class | `data-guide-part` |
| --- | --- | --- |
| spotlight svg | `guide-spotlight` | `spotlight` |
| popover container | `guide-popover` | `popover` |
| popover header | `guide-popover-header` | `popover-header` |
| popover title | `guide-popover-title` | `popover-title` |
| popover body | `guide-popover-body` | `popover-body` |
| popover footer | `guide-popover-footer` | `popover-footer` |
| step counter | `guide-popover-count` | `popover-count` |
| waiting sentence | `guide-popover-awaiting` | `popover-awaiting` |
| next or finish button | `guide-button guide-button-primary` | `popover-next` |
| back button | `guide-button` | `popover-previous` |
| close button | `guide-button guide-button-icon` | `popover-close` |
| checklist container | `guide-checklist` | `checklist` |
| checklist heading | `guide-checklist-title` | `checklist-title` |
| checklist progress text | `guide-checklist-progress` | `checklist-progress` |
| checklist progress bar | `guide-checklist-bar` | `checklist-bar` |
| checklist progress fill | `guide-checklist-bar-fill` | `checklist-bar-fill` |
| checklist item row | `guide-checklist-item` | `checklist-item` |
| checklist item checkbox | `guide-checklist-check` | `checklist-check` |
| checklist dismiss button | `guide-button` | `checklist-dismiss` |
| launcher button | `guide-launcher` | `launcher` |
| launcher ring | `guide-launcher-ring` | `launcher-ring` |
| launcher panel | `guide-launcher-panel` | `launcher-panel` |
| hotspot marker | `guide-hotspot` | `hotspot` |
| hotspot bubble | `guide-hotspot-bubble` | `hotspot-bubble` |
| hotspot bubble title | `guide-hotspot-title` | `hotspot-title` |
| hotspot bubble body | `guide-hotspot-body` | `hotspot-body` |
| hotspot bubble actions | `guide-hotspot-actions` | `hotspot-actions` |
| hotspot tour button | `guide-button guide-button-primary` | `hotspot-tour` |
| hotspot close button | `guide-button` | `hotspot-close` |

The popover and the hotspot bubble also carry `data-guide-placement`, the side `usePosition`
actually resolved (which can differ from the requested `placement` after a flip). A completed
checklist item's row carries `data-guide-complete="true"` (or `"false"`), which is how the
stylesheet's strike through is applied without the component choosing a text decoration itself.

A few structural elements carry a class but no `data-guide-part`, because nothing outside their
own parent ever needs to address them directly: `guide-checklist-header`, `guide-checklist-list`,
`guide-checklist-item-button`, `guide-checklist-item-title`, `guide-checklist-item-body` and
`guide-launcher-anchor`. They are still valid, stable selectors for a stylesheet.

One class, `guide-visually-hidden`, is applied to the focus-destination node the launcher renders
on dismissal, but that node is hidden by an inline style set directly on it regardless of any
stylesheet (the same precedent `announcerNode` in `@apollovisionlabs/guide-core` follows), so the
shipped stylesheet has no rule for it and one would have no visible effect.

## Custom properties

The shipped stylesheet reads every colour through one of these, each with a fallback. Three of
of them are also read inline by the components themselves, so they work with no stylesheet loaded:
`--guide-surface` and `--guide-ink` on the three floating surfaces, `--guide-launcher-offset` on the
launcher's corner inset, and `--guide-bar-height`, `--guide-border` and `--guide-primary` on the
checklist progress bar.

| Property | Fallback | Used for |
| --- | --- | --- |
| `--guide-surface` | `#ffffff` | Background of the popover, the launcher panel, the checklist and the hotspot bubble. |
| `--guide-ink` | `#111111` | Primary text colour. |
| `--guide-muted` | `#6b6b6b` | Secondary text: progress counts, the step counter, the waiting sentence, item bodies. |
| `--guide-border` | `#d9d9d9` | Borders and the checklist progress track. |
| `--guide-primary` | `#2563eb` | Primary buttons, the launcher button and ring, the hotspot marker and its pulse, the checklist checkbox. |
| `--guide-primary-ink` | `#ffffff` | Text on a primary button and on the launcher button. |
| `--guide-overlay` | `rgba(0, 0, 0, 0.5)` | The spotlight's dimmed background. |
| `--guide-launcher-offset` | `24px` | Distance between the checklist launcher and the two viewport edges of its corner. |
| `--guide-bar-height` | `4px` | Thickness of the checklist progress bar. |
| `--guide-radius` | `8px` | Corner radius shared by the popover, panel, bubble, checklist, buttons and progress track. |

`--guide-launcher-offset` is the one to reach for when the launcher has to clear a fixed cookie
banner or a mobile tab bar: it moves the button away from both edges of whichever corner
`placement` puts it in.

Set any subset on a wrapping element (or `:root`) to retheme:

```css
:root {
  --guide-primary: #7c3aed;
  --guide-surface: #1c1c1e;
  --guide-ink: #f5f5f5;
}
```

## Positioning

`StepPopover`, `ChecklistLauncher`'s panel and `Hotspots`' bubbles all position through the same
`usePosition` / `computePosition` pair: pick a side, flip to the opposite side if the preferred one
doesn't fit, then clamp both axes to the viewport unconditionally, because a bubble that hangs off
the edge of the window is unusable, not merely imperfect.

`ChecklistLauncher`'s panel centres on its button on the cross axis and clamps to the viewport,
rather than aligning to whichever corner the button sits in the way the MUI layer's `Popper` does.
A launcher pinned to `bottom-right`, for instance, opens a panel centred above the button, not
flush with the button's right edge.

## Limits

- **Positioning is against the viewport, not a scrolling ancestor.** A target inside its own
  scroll container, near that container's edge rather than the window's, is not corrected for.
  Every floating part renders through a `Portal` into `document.body` specifically to avoid one
  class of positioning bug (an ancestor with `transform`, `filter` or `contain` breaking `fixed`
  positioning), but scroll containers are not accounted for.
- **Positioning clamps against the layout viewport.** `document.documentElement.clientWidth` and
  `clientHeight`, which exclude a space-taking scrollbar, rather than `window.innerWidth` and
  `innerHeight`, which include it: every rect they are compared against comes from
  `getBoundingClientRect`, which excludes it too.
- **No runtime dependency beyond `@apollovisionlabs/guide-core`.** No UI toolkit, no styling
  runtime. Peer dependencies are `react` and `react-dom` (`^19` each).
- **The default stacking of the hotspots and the checklist launcher share a layer.** Both default
  to the same `zIndex` (1299, one below the tour's 1300) when neither is given an explicit
  `zIndex` prop, so an ambient hotspot marker and the checklist launcher button can end up at the
  same stacking level, ordered only by DOM order. Give one of them an explicit `zIndex` if you
  need a guaranteed order between them.

## Compatibility

| | Supported |
| --- | --- |
| React | 19 |
| Rendering | ESM and CommonJS, with `"use client"` for Next's App Router |
