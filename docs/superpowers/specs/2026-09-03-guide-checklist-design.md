# Guide checklist, design

Date: 2026-09-03
Status: approved by the maintainer, ready for an implementation plan

## 1. Goal

Add the second component the library was always meant to have: a first steps
checklist. A new user sees a short list of the things worth doing first, ticks
them off, and can launch the guided tour that teaches any one of them.

The tour, shipped in 0.1.0, teaches a single flow end to end. A checklist is
what makes an onboarding survive the first session: it persists, it shows how
far someone got, and it gives them somewhere to come back to.

## 2. Scope

In scope:

- a checklist in `@apollovisionlabs/guide-core`, headless, with persistence
- a generalised `GuideStorage` contract shared by tours and checklists
- `Checklist` and `ChecklistLauncher` in `@apollovisionlabs/guide-mui`
- two completion sources: finishing a linked tour, and a manual tick

Out of scope, deliberately:

- programmatic completion driven by application state. The hook that ticks an
  item is exported anyway, since the manual tick needs it, but no separate
  mechanism is built and none is documented as a feature until someone asks.
- a checklist demo on the apollovisionlabs website
- any change to how the tour itself behaves

## 3. The storage contract becomes generic

Today the contract is written for one consumer:

```ts
export interface GuideStorage {
  read(tourId: string): Promise<TourProgress | null>
  write(tourId: string, progress: TourProgress): Promise<void>
}
```

A checklist does not store a `TourProgress`, so it becomes:

```ts
export interface GuideStorage {
  read<T>(key: string): Promise<T | null>
  write<T>(key: string, value: T): Promise<void>
}
```

Callers namespace their own keys: the provider reads and writes `tour:<tourId>`,
the checklist `checklist:<checklistId>`. `createBrowserStorage` keeps its own
`guide` prefix on top, so a stored key becomes `guide:tour:onboarding`.

This is a breaking change, in two ways. Anyone who implemented `GuideStorage`
against a database must widen their signature, and any tour progress already in
a browser is orphaned by the key change, so a user mid tour restarts it once.
Both are acceptable at 0.1.1 with no known adopter, and both belong in a 0.2.0
release note rather than in silence.

### Reads are validated

`createBrowserStorage` currently hands whatever `JSON.parse` returns straight to
the caller. A corrupted or foreign value therefore reaches the tour reducer as
if it were progress. The generic signature makes this worse, since `T` is a
promise the storage cannot keep, so validation moves to the two read sites:

- the provider accepts a stored tour progress only if it has a numeric
  `stepIndex` and a `status` of `in-progress` or `completed`
- the checklist accepts stored state only if `completed` is an array of strings
  and `dismissed` is a boolean

Anything else is treated as absent. This closes a hole that already exists for
tours, which is why it is in this spec rather than left for later.

## 4. Core

### Types

```ts
export interface ChecklistItem {
  id: string
  title?: string
  titleKey?: string
  body?: string
  bodyKey?: string
  /** Tour launched when the item is activated. Completing it completes the item. */
  tourId?: string
  /** Path navigated to when the item is activated and carries no tour. */
  href?: string
}

export interface Checklist {
  id: string
  items: ChecklistItem[]
}

export interface ChecklistProgress {
  completed: string[]
  dismissed: boolean
}
```

`title`/`titleKey` and `body`/`bodyKey` follow the rule steps already use: a
literal wins, a key goes through `translate`, and a key with no `translate`
renders as itself.

### Provider

`ChecklistProvider` takes `checklists`, `storage`, `translate`, `navigate` and
`onEvent`, and sits inside `GuideProvider` so it can start tours. It reads
`GuideContext` with `useContext` and tolerates a null: a project that wants a
checklist and no tours does not have to declare an empty `GuideProvider`. An
item carrying a `tourId` in that situation warns once and does nothing, rather
than throwing during a click.

State is held per checklist id. On mount, each checklist's progress is read from
storage; every later change is written back. A storage rejection warns once and
is otherwise ignored, matching what the tour provider already does, because
persistence is a convenience and losing it must not break onboarding.

### Hook

```ts
useChecklist(checklistId: string): {
  items: ResolvedChecklistItem[]   // id, title, body, completed, tourId, href
  completedCount: number
  total: number
  isComplete: boolean
  dismissed: boolean
  activate(itemId: string): void
  toggle(itemId: string): void
  dismiss(): void
  reset(): void
}
```

`activate` is what a click on a row calls. It starts the linked tour if the item
has one, navigates to `href` if it has one instead, and otherwise toggles the
item. That ordering is the whole point of the design: an item that teaches
something launches the teaching rather than claiming it is done.

`toggle` is the manual tick, on the checkbox itself. It moves in both
directions, so a mis-tick is recoverable.

An unknown `checklistId` throws, the way `useTour` does for an unknown provider:
it is a wiring mistake, and failing quietly would hide it until production.
An unknown `itemId` passed to `activate` or `toggle` warns and does nothing.

### Completion by a linked tour

The checklist watches the guide state rather than subscribing to events, since
`onEvent` is a single callback prop that a consumer already owns and a second
subscriber would have to fight for.

When `state.status` becomes `completed`, `state.tourId` names the tour that
finished, and every item carrying that `tourId` is marked done. A ref holds the
last handled completion so a re render cannot tick the same item twice, and so
that a tour completed while its item was already ticked is a no operation.

### Events

`GuideEvent` gains three variants, so analytics stays one surface:

```ts
| { type: 'checklist:item-complete'; checklistId: string; itemId: string }
| { type: 'checklist:complete'; checklistId: string }
| { type: 'checklist:dismiss'; checklistId: string }
```

`checklist:item-complete` fires on a transition to done, not on an untick.
`checklist:complete` fires once, when the last item is ticked.

## 5. MUI rendering

### `Checklist`

Props: `checklistId`, optional `title`, optional `onDismiss`.

A heading with the progress as text and a `LinearProgress` bar, then one
`ListItemButton` per item. Each row carries a checkbox on the left, the title,
the body as secondary text, and a strike through when done. Clicking the row
calls `activate`; clicking the checkbox calls `toggle` and does not bubble into
`activate`. A dismiss button sits in the header.

The component renders nothing when the checklist is dismissed.

### `ChecklistLauncher`

Props: `checklistId`, optional `placement` defaulting to `bottom-right`,
optional `title`.

A `Fab` fixed to a corner, ringed by a `CircularProgress` in determinate mode
showing the fraction complete, opening a `Popover` that holds a `Checklist`. Its
`aria-label` carries the progress in words, since a ring is invisible to a
screen reader.

It stays visible once everything is ticked, until the user dismisses it.
Vanishing at the moment someone finishes takes away the one screen that tells
them they did.

## 6. Accessibility

The list is a real list of buttons, reachable and operable from the keyboard
with no extra handlers. The popover is a dialog with a label and returns focus
to the launcher on close, which is MUI's own behaviour and is asserted rather
than assumed. Ticking an item announces the new progress through the announcer
the core already owns, so the change is not silent.

## 7. Testing

Core, in Vitest and jsdom:

- progress persists and is restored on mount
- a corrupted stored value is ignored rather than trusted
- finishing a linked tour ticks its item, once
- `activate` starts a tour, navigates, or toggles, in that priority
- dismissal persists
- an unknown checklist id throws, an unknown item id warns

MUI, in Testing Library:

- progress text and bar reflect the state
- a row click activates, a checkbox click toggles without activating
- the launcher opens the popover and its label carries the progress

Playwright, against the demo app:

- a checklist item launches a tour, the tour completes, the item is ticked
- the ticked state survives a reload

No new pixel snapshot. The existing baselines are per platform and need the
Linux container to regenerate; an assertion on roles and labels catches the
regressions that matter here without that cost.

## 8. Release

A changeset marking both packages minor, whose note states the two breaking
consequences of the storage change in plain words. The version bump and the
publish are a separate, human decision, not part of this work.
