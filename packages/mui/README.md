# guide

`guide` is a headless React library for building in-app product tours. `@guide/core` owns the
state machine, target resolution, routing, persistence and accessibility concerns, and exposes
them as hooks with no rendering opinion. `@guide/mui` consumes those hooks to render a tour with
[MUI](https://mui.com) components — a spotlight overlay and a popover — so you get a complete tour
out of the box, or you can render your own UI on top of `@guide/core` directly.

This repository includes a runnable demo. From the repo root, run `pnpm --filter demo dev` and
open `http://localhost:5173` to try a three-page tour end to end.

## Installation

```bash
pnpm add @guide/core @guide/mui @mui/material @emotion/react @emotion/styled
```

`@guide/mui` depends on `@guide/core`, so both are needed to render the default UI. If you only
want the state machine and plan to render your own popover and spotlight, `@guide/core` alone is
enough.

## Minimal example

```tsx
import { GuideProvider, type Tour } from '@guide/core'
import { GuideTour } from '@guide/mui'

const tour: Tour = {
  id: 'welcome',
  steps: [
    {
      target: 'sidebar.projects',
      title: 'Your projects',
      body: 'Everything you create is grouped under a project.',
    },
  ],
}

function App() {
  return (
    <GuideProvider tours={[tour]}>
      <Sidebar />
      <GuideTour />
    </GuideProvider>
  )
}

function Sidebar() {
  // The target string is matched against the data-guide attribute, not a CSS selector or a ref.
  return <nav data-guide="sidebar.projects">Projects</nav>
}
```

Start the tour from anywhere under the provider with `useTour('welcome').start()`.

## `GuideTour` props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `labels` | `Partial<{ next, previous, finish, close }>` | `{ next: 'Next', previous: 'Back', finish: 'Finish', close: 'Close' }` | The popover's button labels. Defaults are English; override any subset. See "Translations". |
| `zIndex` | `number` | `theme.zIndex.modal` | Stacking level of the spotlight; the popover sits one above it. |
| `padding` | `number` | `8` | Margin, in pixels, between the highlighted element and the edge of the spotlight hole. |
| `radius` | `number` | `8` | Corner radius, in pixels, of the spotlight hole. |

## `GuideProvider` props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `tours` | `Tour[]` | — | The tours available to `start()`. Tour ids must be unique. |
| `children` | `ReactNode` | — | Your application. |
| `navigate` | `(path: string) => void` | — | Called when a step declares a page it needs. Required for multi-page tours. |
| `location` | `string` | — | The current pathname, used to decide whether a step's target should be on screen. Required for multi-page tours. |
| `storage` | `GuideStorage` | — | Persists tour progress. See "Persistence". |
| `translate` | `(key: string) => string` | — | Resolves `titleKey` / `bodyKey` on steps. See "Translations". |
| `onEvent` | `(event: GuideEvent) => void` | — | Called for every lifecycle event. See "Events". |
| `onMissingTarget` | `'skip' \| 'wait' \| 'error'` | `'wait'` | Default policy when a step's target never appears. Overridable per step. |
| `targetTimeoutMs` | `number` | `5000` | How long to wait for a target before applying the missing-target policy. |

## Multi-page tours

A step can declare the route it belongs to and, when it isn't the current one, where to navigate:

```tsx
{
  target: 'projects.create',
  route: '/projects',
  navigateTo: '/projects',
  title: 'Create a project',
  body: 'This step lives on another page — you were moved here automatically.',
}
```

`route` accepts `:param` segments and a trailing `*` wildcard, and is only used to decide whether
the current page already satisfies the step. `navigateTo` is the concrete path passed to
`navigate`; when it is omitted and `route` is a literal path (no `:` or `*`), that route is used as
the destination.

## Persistence

`GuideStorage` is the two-method interface the provider reads from and writes to:

```ts
interface GuideStorage {
  read(tourId: string): Promise<TourProgress | null>
  write(tourId: string, progress: TourProgress): Promise<void>
}
```

`@guide/core` ships `createMemoryStorage()` for tests and `createBrowserStorage(namespace?)` for
`localStorage`. Neither talks to a server. An implementation backed by your own API looks like
this:

```ts
import type { GuideStorage, TourProgress } from '@guide/core'

function createServerStorage(): GuideStorage {
  return {
    async read(tourId) {
      const response = await fetch(`/api/tours/${tourId}/progress`)
      if (!response.ok) return null
      return (await response.json()) as TourProgress
    },
    async write(tourId, progress) {
      await fetch(`/api/tours/${tourId}/progress`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(progress),
      })
    },
  }
}
```

Pass it as the `storage` prop. The provider reads on `start()` — unless an explicit `from` step
index is passed, or `resume: false` is passed — and writes whenever a running tour advances or
completes.

## Translations

Every step's own text is supplied by the consumer. A step can set `title` / `body` directly, or
`titleKey` / `bodyKey` plus a `translate` function on `GuideProvider`; the key is passed through
your translation library and the result is displayed. When a key is set without a `translate`
prop, the raw key is shown instead, so wiring `translate` is required for `titleKey` / `bodyKey`
to resolve to real strings.

The popover's own chrome is the one exception: `@guide/mui` ships English default labels
(`Next`, `Back`, `Finish`, `Close`), so the buttons read correctly out of the box. Every one of
them is overridable through the `labels` prop on `GuideTour` — pass the labels in your language
and nothing English remains:

```tsx
<GuideTour labels={{ next: 'Suivant', previous: 'Retour', finish: 'Terminer', close: 'Fermer' }} />
```

## Events

`onEvent` on `GuideProvider` receives every lifecycle event as a discriminated union:

| Event | Payload | When |
| --- | --- | --- |
| `tour:start` | `{ tourId, stepIndex }` | `start()` is called. |
| `tour:complete` | `{ tourId }` | `next()` is called on the last step. |
| `tour:stop` | `{ tourId, stepIndex }` | The tour is stopped before completion. |
| `step:show` | `{ tourId, stepIndex, target }` | A step's target is resolved and the step becomes visible. |
| `target:missing` | `{ tourId, stepIndex, target }` | A step's target didn't appear within `targetTimeoutMs`. |

## Accessibility

- The current step position is announced through a visually-hidden `aria-live="polite"` region,
  so screen reader users hear "2 / 4" as the tour advances.
- The step popover traps keyboard focus and is exposed as `role="dialog"` with
  `aria-labelledby` / `aria-describedby` — except for a step marked `interactive: true`, which
  deliberately does **not** trap focus, so the user can tab or click past the popover to reach the
  element they're asked to interact with.
- `Escape` stops the tour, `ArrowRight` advances, `ArrowLeft` goes back — all ignored while focus
  is in a text input, so typing isn't hijacked.
- The highlighted element receives `aria-describedby`, pointing at the step's body text.
- The spotlight respects `prefers-reduced-motion` and disables its transition when set.

## Missing targets

Each step is checked against its `target` (matched by a `data-guide` attribute) for up to
`targetTimeoutMs` (default 5 seconds, per-provider). If the target never appears, the step's own
`onMissingTarget` — or the provider's `onMissingTarget`, which defaults to `'wait'` — decides what
happens: `'skip'` moves to the next step, `'error'` stops the tour, and `'wait'` (the default)
pauses and resumes automatically if the target appears later, for instance after a slow async
render.

## Compatibility

| | Supported |
| --- | --- |
| React | 19 |
| MUI (`@guide/mui` only) | 7, 9 |
| Rendering | ESM and CommonJS, with `"use client"` for Next's App Router |

## Prior art

The spotlight-and-popover approach is inspired by [driver.js](https://driverjs.com) (MIT). Other
libraries worth knowing about in this space: [react-joyride](https://github.com/gilbarbara/react-joyride)
(MIT) and [reactour](https://github.com/elrumordelaluz/reactour) (MIT). `guide` differs from all
three mainly in splitting the state machine (`@guide/core`) from rendering (`@guide/mui`), so the
logic can be reused with a different design system.

## License

MIT — see [LICENSE](LICENSE).
