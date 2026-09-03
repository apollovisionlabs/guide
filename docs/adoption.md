---
type: Playbook
title: Adoption playbook
description: How to go from an empty React application to a working multi-page tour, and the decisions that follow.
tags: [adoption, integration, onboarding, tour, playbook]
status: stable
generated:
  by: claude-opus-5
  at: 2026-09-02T21:50:47Z
  directed_by: human:remy dème
---

# Adoption playbook

This is the integration sequence, for a developer adding `guide` to an application that has none.
Follow it in order: each step says what to do, shows the smallest code that works, and says how to
tell it worked. At the end you have a tour crossing several pages of your own application.

This playbook does not repeat the API reference. Every prop, event and option is listed in
[README.md](../README.md), and the mechanisms behind them in [ARCHITECTURE.md](../ARCHITECTURE.md).
What follows is the order to do things in, and the choices you have to make.

The working example this playbook points at is `apps/demo`, a three-page application in this
repository that integrates the library exactly as described here. `e2e/` drives it.

## 1. Install the two packages

```bash
pnpm add @apollovisionlabs/guide-core @apollovisionlabs/guide-mui @mui/material @emotion/react @emotion/styled
```

`@apollovisionlabs/guide-core` is the engine: the state machine, target resolution, route matching,
persistence, and the accessibility primitives. It renders nothing and has no runtime dependency.

`@apollovisionlabs/guide-mui` is one rendering of that engine, built on MUI: a spotlight overlay
and a step popover. Its only runtime dependency is the core.

If you intend to draw your own popover, install the core alone and read `activeStep` from
`useGuideStep()`. Everything below assumes the MUI layer, because that is the shortest path to a
running tour.

**Worked when**: both packages resolve, and `import { GuideProvider } from '@apollovisionlabs/guide-core'`
typechecks. React 19 and MUI 7 or 9 are the supported peers.

## 2. Declare the tour as data

A tour is a plain object: an id and an ordered list of steps. Put it in its own module, at module
scope. That is not a style preference: see the trap in "Declaring tours inline" below.

```ts
// src/tours.ts
import type { Tour } from '@apollovisionlabs/guide-core'

export const productTour: Tour = {
  id: 'product',
  steps: [
    {
      target: 'nav.projects',
      title: 'Your projects live here',
      body: 'Everything you create is grouped under a project.',
      placement: 'bottom',
    },
  ],
}
```

`target` is a **logical key**, not a CSS selector. The engine resolves it by looking for
`[data-guide="<key>"]`, so the element you want to highlight declares its own participation:

```tsx
<Button data-guide="nav.projects">Projects</Button>
```

The reason is that a CSS selector couples the tour to markup that changes for unrelated reasons: a
class renamed by a design change, a wrapper added by a layout refactor, a generated class name from
a styling library. A `data-guide` attribute is a contract, visible in the element's own source, that
a reviewer can see they are about to break. See
[ADR 0002](adr/0002-logical-targets-via-data-attribute.md).

Pick keys with a namespace, as in `nav.projects` or `projects.create`. They appear in the
`step:show` and `target:missing` events, so they end up in whatever you log.

**Worked when**: `document.querySelector('[data-guide="nav.projects"]')` finds your element in the
browser console.

## 3. Mount the provider and the one component

`GuideProvider` holds the state. `GuideTour` draws it. Both must be inside your MUI
`ThemeProvider`, because the spotlight and the popover read the theme.

```tsx
import { GuideProvider } from '@apollovisionlabs/guide-core'
import { GuideTour } from '@apollovisionlabs/guide-mui'
import { productTour } from './tours'

export function App() {
  return (
    <GuideProvider tours={[productTour]}>
      <AppRoutes />
      <GuideTour />
    </GuideProvider>
  )
}
```

Start it from any component under the provider:

```tsx
import { useTour } from '@apollovisionlabs/guide-core'

function StartButton() {
  const tour = useTour('product')
  return <Button onClick={() => tour.start()}>Start the tour</Button>
}
```

`useTour` also returns `next`, `previous`, `stop`, `status` and `stepIndex`, so you can build your
own controls. Note that there is no `complete()`: a tour completes when `next()` is called on its
last step.

### If you are on Next's App Router

Two things matter.

Both packages are built with a `"use client"` banner on every emitted file, so importing them does
not by itself break a server build. But `GuideProvider` uses React state and context, so the
component that renders it is a client component: a root `layout.tsx` is a server component, and you
need your own `'use client'` wrapper between the two.

`GuideTour` renders `null` until it has mounted in the browser. Nothing about the tour appears in
server-rendered HTML, which is what you want: the tour depends on measuring real elements.

**Worked when**: clicking your start button shows the popover over the highlighted element, and the
rest of the page dims.

## 4. Cross several pages

The core depends on no router. You supply two props, and it does the rest:

- `location`: the current pathname, so the engine can tell whether a step's page is already open.
- `navigate`: a function it calls when the step's page is not the current one.

With React Router, as in `apps/demo/src/App.tsx`:

```tsx
import { useLocation, useNavigate } from 'react-router'

const navigate = useNavigate()
const location = useLocation()

<GuideProvider
  tours={[productTour]}
  navigate={(path) => navigate(path)}
  location={location.pathname}
>
```

With Next's App Router the same two props come from `next/navigation`:

```tsx
'use client'
import { usePathname, useRouter } from 'next/navigation'

const router = useRouter()
const pathname = usePathname()

<GuideProvider tours={[productTour]} navigate={(path) => router.push(path)} location={pathname}>
```

A step then declares where it lives:

```ts
{
  target: 'project.share',
  route: '/projects/:id',
  navigateTo: '/projects/42',
  title: 'Share it',
  body: 'This step lives on another page, and you were moved here automatically.',
}
```

`route` and `navigateTo` are two different things, and confusing them is the usual first mistake.

- `route` is a **pattern**, used only to answer one question: does the page currently open already
  satisfy this step? It accepts `:param` segments and a `*` wildcard. `/projects/:id` matches
  `/projects/42` and `/projects/7`. The wildcard is not restricted to the end: `matchRoute` returns
  true as soon as it reaches a `*`, so `/projects/*` matches everything under `/projects`, and a `*`
  in the middle matches every path that agrees on the segments before it.
- `navigateTo` is a **concrete path**, the exact string handed to your `navigate` function. A
  pattern cannot be navigated to, because `:id` is not a real path segment.

When `route` is literal (it contains neither `:` nor `*`), `navigateTo` can be omitted and the route
is used as the destination. As soon as the pattern has a parameter or a wildcard, `navigateTo` is
required, otherwise the step has no destination and nothing moves. See
[ADR 0003](adr/0003-delegated-navigation.md).

**Worked when**: starting the tour on page one and pressing Next changes the URL and shows the next
step on the new page, with no code of yours in between.

## 5. Choose a missing target policy

A step's target may not be on screen when the step comes up: a slow request, a collapsed panel, a
feature the user does not have. The engine waits `targetTimeoutMs` (5000 by default) with a
`MutationObserver`, and then applies a policy. Set the default on the provider and override it per
step:

```tsx
<GuideProvider tours={[productTour]} onMissingTarget="skip" targetTimeoutMs={3000}>
```

```ts
{ target: 'billing.upgrade', onMissingTarget: 'skip', title: 'Upgrade', body: '…' }
```

What each one means for the person looking at the screen:

| Policy | What they see |
| --- | --- |
| `wait` (default) | Nothing, for as long as the target is absent. The tour is paused, not dead: it resumes on its own the moment the element appears. Correct when the element is late, wrong when it is never coming. |
| `skip` | The tour moves to the next step after the timeout. They notice a pause, then continue. Correct for a step that is optional, or tied to a feature not everyone has. |
| `error` | The tour stops. They are back to the page with nothing on it. Correct when the rest of the tour makes no sense without this step. |

Whatever the policy, a `target:missing` event is emitted first, so you can count how often this
happens in production. See [ADR 0004](adr/0004-missing-target-policy.md).

**Worked when**: with `onMissingTarget="skip"` and a step pointing at a key that exists nowhere, the
tour advances past it after the timeout instead of hanging.

## 6. Wire persistence

Without a `storage` prop, nothing is remembered: a reload restarts the tour from step one. Pass an
implementation of `GuideStorage`, which is two generic async methods, and the provider writes on
every advance and on completion, under the key `tour:<id>`.

The read is narrower than the write. `start()` consults storage only when it is given neither a
`from` index nor `resume: false`, and it resumes only a record whose status is `in-progress`: a
record left as `completed` starts the tour again from its first step. So a tour started with an
explicit `from` never reads at all, which is what you want when a checklist item or a button
deliberately restarts it.

Two implementations ship with the core:

```ts
import { createMemoryStorage, createBrowserStorage } from '@apollovisionlabs/guide-core'

createMemoryStorage() // lives for the page's lifetime; for tests
createBrowserStorage('my-app') // localStorage, keyed "<namespace>:<key>"
```

Neither talks to a server. That is deliberate: the packages make no network calls at all
([ADR 0007](adr/0007-pluggable-persistence-no-network.md)), so if progress has to follow a user, you
write the implementation.

A server-backed implementation has to provide exactly this: `read<T>(key)` returning the stored
value or `null`, and `write<T>(key, value)` storing it. `GuideProvider` calls it with
`tour:<id>` keys and `TourProgress` values (a status, `'in-progress'` or `'completed'`, and a step
index); if you also use `ChecklistProvider`, the same storage instance receives `checklist:<id>`
keys, so one implementation serves both ([ADR 0016](adr/0016-one-storage-contract-for-tours-and-checklists.md)).
The full example is in the README's Persistence section; do not copy it twice.

Two things to get right in your own implementation:

- **Resolve, do not throw, on "nothing stored".** `read` returning `null` is the normal first-visit
  case. A rejected promise is tolerated (the tour starts from the beginning and one warning is
  logged) but it is not the way to say "no progress".
- **Scope the key to the user, on the server side.** The `tourId` is all the library gives you.

**Browser storage is the wrong choice on a shared workstation.** `localStorage` belongs to the
browser profile, not to the person signed in. On a workstation several people use in turn, the first
person's completed tour silently suppresses it for the second, who is the one who actually needed
it, and progress from one account bleeds into another's session. Where accounts share a machine, put
progress behind the account: use a server-backed `GuideStorage`.

**Worked when**: advance two steps, reload, start the tour again, and it resumes on step three.
`e2e/tour.spec.ts` asserts exactly that against `createBrowserStorage`.

## 7. Supply the text

There are two kinds of text, and they are supplied differently.

**Step copy** is yours. Either write it inline with `title` and `body`, or give `titleKey` and
`bodyKey` and let your translation library resolve them through the provider's `translate` prop:

```tsx
import { useTranslation } from 'react-i18next'

const { t } = useTranslation()

<GuideProvider tours={[productTour]} translate={(key) => t(key)}>
```

```ts
{ target: 'nav.projects', titleKey: 'tour.projects.title', bodyKey: 'tour.projects.body' }
```

`translate` takes a key and returns a string, which is the lowest common denominator of every
translation library, so any of them fits in one line. If you set a key and forget `translate`, the
raw key is displayed: that is the symptom to recognise, not a crash.

**Button labels** belong to the MUI layer, which ships English defaults so the popover is usable out
of the box. Override any subset through `labels` on `GuideTour`:

```tsx
<GuideTour labels={{ next: t('common.next'), previous: t('common.back'), finish: t('common.finish'), close: t('common.close') }} />
```

`close` is also the accessible name of the close button, so translating it is not cosmetic.

**Worked when**: switching your application's language changes both the step body and the buttons.

## 8. Mark a step interactive when the user must act

A normal step is a demonstration: the element is highlighted, and the overlay swallows clicks, so
the highlighted element is **not** clickable. When the step asks the user to do something, say so:

```ts
{
  target: 'project.share',
  route: '/projects/:id',
  navigateTo: '/projects/42',
  title: 'Share it',
  body: 'Click the button yourself, this step is interactive.',
  interactive: true,
  placement: 'left',
}
```

`interactive: true` changes two things. The overlay becomes click-through, so the element under the
spotlight receives the click. And the popover is rendered **non-modal**: no focus trap, and no
`aria-modal`.

That second change is the accessibility point, and it is deliberate. A modal dialog is a keyboard
prison by design: Tab cycles inside it and never reaches the page. A step that tells someone to
click a button while trapping their keyboard away from that button is telling them to do something
they cannot do. So an interactive step gives the keyboard back. Mouse users see only the
click-through overlay; keyboard users get the only version of the step that is actually followable.

The cost is that an interactive step is easier to lose track of, because focus is no longer held.
Use it for the steps that ask for an action, not as a default. See
[ADR 0008](adr/0008-accessibility-in-the-core.md).

**Worked when**: on that step, clicking the highlighted element performs its real action instead of
dismissing the tour, and Tab reaches it.

## 9. Verify

What this repository's end-to-end suite already proves, against `apps/demo`, so you do not have to
prove it again about the library itself:

- `e2e/tour.spec.ts`: a tour crosses three pages and completes; it resumes where it was interrupted
  after a reload; the spotlight follows the target when the page scrolls; an interactive step lets
  the page be clicked.
- `e2e/a11y.spec.ts`: the full keyboard walkthrough (focus lands on the dialog, arrow keys move,
  Escape stops); the step position is announced in the `aria-live` region as `"1 / 3"`; both light
  and dark themes render legibly, against screenshot baselines.

What is yours to test, because it depends on your application and not on the library:

- **Every target exists.** A rendering test per page asserting that the `data-guide` keys the tour
  names are in the DOM. This is the test that fails when someone deletes an attribute, and it is the
  one worth having. In development the provider already warns on `start()` about targets absent from
  the current page, but a warning is not a failing build.
- **Navigation reaches each page.** One end-to-end run through the tour, asserting the URL after
  each step, as `e2e/tour.spec.ts` does. This is what catches a `route` pattern that never matches.
- **Persistence round trip.** If you wrote a server-backed `GuideStorage`, test `read` after `write`
  and the first-visit `null` directly, against your API.

Use `createMemoryStorage()` in tests so runs do not leak progress into each other.

## 10. Add a checklist (optional)

A checklist is a separate feature from the tour: a fixed list of items, completed by finishing a
linked tour or by a manual tick. An `href` item navigates and nothing more; arriving on a page is
not evidence that anyone did anything there, so only the user's own tick closes it. Nest `ChecklistProvider` inside
`GuideProvider`, the way `apps/demo/src/App.tsx` does, so items with a `tourId` can start it:

```tsx
import { ChecklistProvider } from '@apollovisionlabs/guide-core'
import { ChecklistLauncher } from '@apollovisionlabs/guide-mui'
import { onboardingChecklist } from './checklists'

<GuideProvider tours={[productTour]} navigate={navigate} storage={storage}>
  <ChecklistProvider checklists={[onboardingChecklist]} navigate={navigate} storage={storage}>
    <AppRoutes />
    <GuideTour />
    <ChecklistLauncher checklistId="onboarding" title="Get started" />
  </ChecklistProvider>
</GuideProvider>
```

The full props and the `useChecklist` hook are in the README's Checklist section. Sharing the same
`storage` instance between the two providers is the normal case: tour progress and checklist
progress live at different keys in it, `tour:<id>` and `checklist:<id>`
([ADR 0016](adr/0016-one-storage-contract-for-tours-and-checklists.md)).

**Worked when**: the launcher's badge reads `0/3`, ticking an item updates it, and reloading keeps
the tick.

## Traps a first integration falls into

These four are real, and each has cost time in this repository.

**Declaring the tour inline.** A tour built as a literal inside a component body is a new object on
every render, and so is every step in it. The route timeout keys on step object **identity**: it
stores the step that expired rather than a boolean, so that the next step cannot inherit the
previous one's expiry. Recreate the step objects each render and that effect restarts each render,
the timer never reaches its deadline, and the missing-target policy silently never fires. The
symptom is a tour that hangs forever on a step whose page it never reached, with `onMissingTarget`
apparently ignored. Declare tours as module constants, as `apps/demo/src/tours.ts` does. If a tour
genuinely has to be built at runtime, build it once and hold it in a `useMemo` with stable
dependencies.

**Expecting something on screen while a target is awaited.** During the wait, `GuideTour` renders
nothing: no spinner, no dimmed overlay, no popover. That is on purpose, because drawing a spotlight
with no hole in it over a page is worse than drawing nothing. The tour is running, and you can see
it in `useTour(id).status`. The one thing that is mounted during the wait is an Escape key handler,
so the user is never stuck: Escape ends the tour even when nothing is drawn. If your users need
feedback during a long wait, render it yourself from `status`.

**Assuming the highlighted element is clickable.** It is not, unless the step sets
`interactive: true`. The SVG mask cuts the *rendering* of the overlay, not its hit area, so the
overlay is still there over the hole. A click inside the hole is ignored rather than treated as a
dismissal, which is why the button seems inert rather than closing the tour. A click outside the
hole stops the tour. If a step asks for a click, mark it interactive.

**A checklist item's `tourId` naming no tour on the `GuideProvider`.** `start()` rejects with
`[guide] unknown tour: <id>`, and `activate(itemId)` catches it and warns once with
`[guide] starting a tour for a checklist item failed` (`packages/core/src/ChecklistProvider.tsx`).
Nothing else happens: no `onEvent`, no change on screen, and the item does not tick. So the
failure is visible in a development console and invisible everywhere else, since a warning is
all it is. Keep checklist `tourId` values and `Tour.id` values in the same module, or covered by
the same test, so a typo in either fails loudly instead of costing a user their first tour.

The warning fires once per provider, not once per click. That is deliberate, and it matches how
the missing `navigate` and the failing storage behave, but it does mean a second broken item
after the first one warns is silent.

## What this library does not do

So you stop looking for it:

- **No tour builder.** There is no visual editor, no recorder, no admin UI. Tours and checklists
  are TypeScript objects in your repository, reviewed like any other code.
- **No analytics.** Nothing is sent anywhere, ever. The packages make no network call of their own.
  What you get is `onEvent`, on `GuideProvider` (`tour:start`, `tour:complete`, `tour:stop`,
  `step:show`, `target:missing`) and on `ChecklistProvider` (`checklist:item-complete`,
  `checklist:complete`, `checklist:dismiss`). Forward them to whatever you already use:

  ```tsx
  <GuideProvider tours={[productTour]} onEvent={(event) => analytics.track(event.type, event)}>
  ```

  The decision of what to record, where to send it, and what consent it needs is the application's,
  not the library's. See [security.md](security.md).
