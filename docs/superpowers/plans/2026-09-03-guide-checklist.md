# Guide Checklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persisted first steps checklist to the guide library, sharing one storage contract with the tour, and render it in MUI as a list plus a floating launcher.

**Architecture:** `GuideStorage` becomes a generic key/value contract. A headless `ChecklistProvider` in the core holds per checklist state, persists it, and watches the guide state so that finishing a linked tour ticks its item. The MUI package renders that state as a `Checklist` list and a `ChecklistLauncher` floating button.

**Tech Stack:** React 19, TypeScript 5.9, Vitest with jsdom, Testing Library, Playwright, MUI 7 (peer allows 7 or 9), pnpm workspaces, tsup.

**Spec:** `docs/superpowers/specs/2026-09-03-guide-checklist-design.md`

## Global Constraints

- Never emit an em dash (U+2014) or an en dash (U+2013) in any authored text, including code comments, documentation, and commit messages. Rewrite the sentence instead.
- English for code, comments, commit messages and documentation.
- No Qualiresolve business vocabulary anywhere in this repository. Test and demo fixtures use neutral words such as `items`, `reports`, `projects`.
- Never consult the source of Intro.js or Shepherd.js. Both are AGPL or commercial and this package is MIT.
- Conventional Commits, lowercase type, imperative subject, no trailing period: `feat: ...`, `fix: ...`, `docs: ...`, `test: ...`, `chore: ...`.
- Every new public symbol is exported from the package `index.ts`.
- Components that use React state or effects carry the `'use client'` banner at the top of the file, as the existing ones do.
- Do not run `pnpm publish`, `npm publish`, `pnpm changeset version`, or push to `main`. Committing to the current branch is the end of a task.
- Test files live beside their peers in `packages/<pkg>/test/` and follow the existing naming, `<Subject>.test.tsx` or `<subject>.test.ts`.

---

### Task 1: Generalise the storage contract

**Files:**
- Modify: `packages/core/src/types.ts` (the `GuideStorage` interface)
- Modify: `packages/core/src/GuideProvider.tsx` (both storage call sites, around lines 190 to 291)
- Test: `packages/core/test/storage.test.ts`, `packages/core/test/GuideProvider.test.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `GuideStorage` with `read<T>(key: string): Promise<T | null>` and `write<T>(key: string, value: T): Promise<void>`, plus the exported guard `isTourProgress(value: unknown): value is TourProgress`. Every later task uses this contract.

- [ ] **Step 1: Write the failing tests**

Add to `packages/core/test/storage.test.ts`:

```ts
it('stores and reads back an arbitrary shape under any key', async () => {
  const storage = createMemoryStorage()
  await storage.write('checklist:onboarding', { completed: ['a'], dismissed: false })
  expect(await storage.read('checklist:onboarding')).toEqual({
    completed: ['a'],
    dismissed: false,
  })
})

it('keeps keys from different namespaces apart', async () => {
  const storage = createMemoryStorage()
  await storage.write('tour:x', { status: 'in-progress', stepIndex: 2 })
  await storage.write('checklist:x', { completed: [], dismissed: true })
  expect(await storage.read('tour:x')).toEqual({ status: 'in-progress', stepIndex: 2 })
  expect(await storage.read('checklist:x')).toEqual({ completed: [], dismissed: true })
})
```

Add to `packages/core/test/GuideProvider.test.tsx`, alongside the existing storage tests:

```ts
it('reads and writes tour progress under a namespaced key', async () => {
  const storage = createMemoryStorage()
  const write = vi.spyOn(storage, 'write')
  render(<Harness storage={storage} />)
  await user.click(screen.getByRole('button', { name: 'start' }))
  await waitFor(() => expect(write).toHaveBeenCalledWith('tour:demo', expect.anything()))
})

it('ignores a stored value that is not tour progress', async () => {
  const storage = createMemoryStorage()
  await storage.write('tour:demo', { nonsense: true })
  render(<Harness storage={storage} />)
  await user.click(screen.getByRole('button', { name: 'start' }))
  // A corrupted value must not be trusted: the tour starts at the first step.
  await waitFor(() => expect(screen.getByTestId('step-index')).toHaveTextContent('0'))
})
```

If the existing harness in that file does not expose a `step-index` test id or a `start` button, use whatever the file already uses to assert the current step and to start the tour, and keep the two assertions above intact in meaning.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @apollovisionlabs/guide-core test`
Expected: FAIL. The storage tests fail to typecheck or return null, the provider tests fail on the key name and on the corrupted value being trusted.

- [ ] **Step 3: Widen the contract**

In `packages/core/src/types.ts`, replace the `GuideStorage` interface with:

```ts
export interface GuideStorage {
  /**
   * Reads a previously written value. The key is namespaced by the caller,
   * `tour:<id>` or `checklist:<id>`, so one storage serves both.
   */
  read<T>(key: string): Promise<T | null>
  write<T>(key: string, value: T): Promise<void>
}
```

`createMemoryStorage` and `createBrowserStorage` in `packages/core/src/storage.ts` need their parameter names changed from `tourId` to `key` and their `Map`/JSON types widened to `unknown`. `createMemoryStorage`'s `initial` parameter becomes `Record<string, unknown>`. Neither factory gains validation: the storage is a dumb pipe and the caller decides what a valid value is.

- [ ] **Step 4: Validate at the read site**

Add to `packages/core/src/storage.ts`:

```ts
/**
 * A stored value survives code changes, browser extensions and hand editing,
 * so nothing read back is trusted until its shape is checked.
 */
export function isTourProgress(value: unknown): value is TourProgress {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.stepIndex === 'number' &&
    Number.isInteger(candidate.stepIndex) &&
    candidate.stepIndex >= 0 &&
    (candidate.status === 'in-progress' || candidate.status === 'completed')
  )
}
```

In `packages/core/src/GuideProvider.tsx`, change the read site so the key is namespaced and the value is guarded:

```ts
const stored = await storage.read<unknown>(`tour:${tourId}`)
const progress = isTourProgress(stored) ? stored : null
```

Keep the surrounding logic that decides `stepIndex` from `progress` exactly as it is. Change the write site to `storage.write(\`tour:${state.tourId}\`, { status, stepIndex: state.stepIndex })`.

- [ ] **Step 5: Run the full core suite**

Run: `pnpm --filter @apollovisionlabs/guide-core test && pnpm --filter @apollovisionlabs/guide-core typecheck`
Expected: PASS, including every pre-existing test.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/storage.ts packages/core/src/GuideProvider.tsx packages/core/test
git commit -m "feat(core): generic storage contract shared by tours and checklists"
```

---

### Task 2: Checklist types and provider

**Files:**
- Modify: `packages/core/src/types.ts`
- Create: `packages/core/src/ChecklistProvider.tsx`
- Create: `packages/core/src/useChecklist.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/ChecklistProvider.test.tsx`

**Interfaces:**
- Consumes: `GuideStorage` from Task 1, `GuideContext` and `Translate` from the existing core.
- Produces: `ChecklistItem`, `Checklist`, `ChecklistProgress`, `ResolvedChecklistItem`, `ChecklistContext`, `ChecklistProvider`, `ChecklistProviderProps`, `useChecklist`, `UseChecklistResult`, `isChecklistProgress`. Tasks 4 and 5 render from `useChecklist`.

- [ ] **Step 1: Add the types**

In `packages/core/src/types.ts`:

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

export interface ResolvedChecklistItem {
  id: string
  title: string
  body: string
  completed: boolean
  tourId?: string
  href?: string
}
```

Extend the `GuideEvent` union with three variants:

```ts
  | { type: 'checklist:item-complete'; checklistId: string; itemId: string }
  | { type: 'checklist:complete'; checklistId: string }
  | { type: 'checklist:dismiss'; checklistId: string }
```

- [ ] **Step 2: Write the failing tests**

Create `packages/core/test/ChecklistProvider.test.tsx`. Build a harness that renders `ChecklistProvider` with one checklist of three items and a child that calls `useChecklist`, exposing buttons and text nodes for the assertions. The third item carries `tourId: 'demo'`, the second carries `href: '/reports'`.

```tsx
const checklist: Checklist = {
  id: 'onboarding',
  items: [
    { id: 'profile', title: 'Fill in your profile' },
    { id: 'reports', title: 'Open a report', href: '/reports' },
    { id: 'tour', title: 'Take the tour', tourId: 'demo' },
  ],
}
```

Tests to write:

```tsx
it('starts with nothing completed', () => { /* completedCount is 0, total is 3 */ })

it('toggles an item in both directions', async () => {
  // toggle('profile') marks it completed, toggle('profile') again clears it
})

it('restores progress from storage on mount', async () => {
  const storage = createMemoryStorage({
    'checklist:onboarding': { completed: ['profile'], dismissed: false },
  })
  // completedCount is 1 and the profile item reads as completed
})

it('ignores a stored value that is not checklist progress', async () => {
  const storage = createMemoryStorage({ 'checklist:onboarding': { completed: 'profile' } })
  // completedCount is 0, nothing throws
})

it('persists a tick', async () => {
  // after toggle('profile'), storage.write was called with
  // 'checklist:onboarding' and { completed: ['profile'], dismissed: false }
})

it('emits item-complete on a tick and not on an untick', async () => {
  // onEvent receives exactly one checklist:item-complete across toggle, toggle
})

it('emits complete once when the last item is ticked', async () => {
  // tick all three; exactly one checklist:complete event
})

it('dismisses, persists the dismissal and emits', async () => {})

it('resets to nothing completed and not dismissed', async () => {})

it('navigates when an item carries an href and no tour', async () => {
  // activate('reports') calls navigate with '/reports' and does not tick it
})

it('toggles when an item carries neither tour nor href', async () => {
  // activate('profile') marks it completed
})

it('warns and does nothing for an unknown item id', async () => {
  // console.warn spy called, completedCount still 0
})

it('throws for an unknown checklist id', () => {
  // rendering a child calling useChecklist('missing') throws
})
```

Assert `console.warn` with `vi.spyOn(console, 'warn').mockImplementation(() => {})` and restore it, as the existing core tests do.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm --filter @apollovisionlabs/guide-core test ChecklistProvider`
Expected: FAIL, the module does not exist.

- [ ] **Step 4: Implement the provider**

Create `packages/core/src/ChecklistProvider.tsx`:

```tsx
'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type {
  Checklist,
  ChecklistProgress,
  GuideEvent,
  GuideStorage,
  ResolvedChecklistItem,
  Translate,
} from './types'
import { GuideContext } from './GuideProvider'

export function isChecklistProgress(value: unknown): value is ChecklistProgress {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    Array.isArray(candidate.completed) &&
    candidate.completed.every((entry) => typeof entry === 'string') &&
    typeof candidate.dismissed === 'boolean'
  )
}

export interface ChecklistContextValue {
  checklists: Checklist[]
  progress: Record<string, ChecklistProgress>
  translate?: Translate
  activate: (checklistId: string, itemId: string) => void
  toggle: (checklistId: string, itemId: string) => void
  dismiss: (checklistId: string) => void
  reset: (checklistId: string) => void
}

export const ChecklistContext = createContext<ChecklistContextValue | null>(null)

export interface ChecklistProviderProps {
  checklists: Checklist[]
  children: ReactNode
  storage?: GuideStorage
  translate?: Translate
  navigate?: (path: string) => void
  onEvent?: (event: GuideEvent) => void
}
```

The body holds `progress` in a `useState<Record<string, ChecklistProgress>>`, seeded with an empty entry per checklist. One effect per mount reads every checklist from storage under `checklist:<id>`, guards the value with `isChecklistProgress`, and merges what survives. A `writeProgress` helper sets state and writes the same value back to storage. Storage rejections warn once through a ref, mirroring `GuideProvider`'s `warnStorageFailure`.

`toggle` adds or removes the item id, emits `checklist:item-complete` only on the add, and emits `checklist:complete` when the resulting completed set covers every item and did not before. `dismiss` sets `dismissed` and emits. `reset` writes `{ completed: [], dismissed: false }`.

`activate` looks the item up and branches: `tourId` first, then `href`, then `toggle`. For `tourId` it calls `guide.start(tourId)` from `useContext(GuideContext)`; when that context is null it warns once that a checklist item needs a `GuideProvider` to launch a tour, and does nothing else. For `href` it calls `navigate`, warning if no `navigate` was given.

An unknown item id warns and returns. An unknown checklist id inside `toggle`, `activate`, `dismiss` or `reset` warns and returns; the throw for an unknown id lives in the hook, where the caller is.

- [ ] **Step 5: Implement the hook**

Create `packages/core/src/useChecklist.ts`:

```ts
'use client'

import { useContext, useMemo } from 'react'
import { ChecklistContext } from './ChecklistProvider'
import type { ResolvedChecklistItem } from './types'

export interface UseChecklistResult {
  items: ResolvedChecklistItem[]
  completedCount: number
  total: number
  isComplete: boolean
  dismissed: boolean
  activate: (itemId: string) => void
  toggle: (itemId: string) => void
  dismiss: () => void
  reset: () => void
}

export function useChecklist(checklistId: string): UseChecklistResult {
  const context = useContext(ChecklistContext)
  if (!context)
    throw new Error('[guide] useChecklist must be used inside a ChecklistProvider')

  const checklist = context.checklists.find((entry) => entry.id === checklistId)
  if (!checklist) throw new Error(`[guide] unknown checklist "${checklistId}"`)
  // ... resolve items and memoise
}
```

Resolve `title` and `body` with the same rule steps use. Reuse `GuideProvider`'s `resolveText` by exporting it from a shared module rather than copying it: move `resolveText` into `packages/core/src/resolveText.ts`, import it in both places, and export it from the index. Duplicating it would be two rules to keep in step.

- [ ] **Step 6: Export and run the suite**

Add `export * from './ChecklistProvider'`, `export * from './useChecklist'` and `export * from './resolveText'` to `packages/core/src/index.ts`.

Run: `pnpm --filter @apollovisionlabs/guide-core test && pnpm --filter @apollovisionlabs/guide-core typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src packages/core/test
git commit -m "feat(core): headless checklist with persisted progress"
```

---

### Task 3: Complete an item when its tour finishes

**Files:**
- Modify: `packages/core/src/ChecklistProvider.tsx`
- Test: `packages/core/test/ChecklistProvider.test.tsx`

**Interfaces:**
- Consumes: `GuideContext` and its `state` from the existing core, the provider from Task 2.
- Produces: no new symbol. Behaviour only.

- [ ] **Step 1: Write the failing tests**

The harness for these tests wraps `ChecklistProvider` in a real `GuideProvider` holding a two step tour with id `demo`, whose targets exist in the rendered DOM so the tour can run to its end.

```tsx
it('ticks the item whose tour completes', async () => {
  // start the demo tour, click next twice, the 'tour' item reads completed
})

it('ticks it once even when the provider re renders', async () => {
  // onEvent receives exactly one checklist:item-complete for the tour item
})

it('leaves other items alone when an unrelated tour completes', async () => {
  // a tour with no matching item completes, completedCount stays 0
})

it('does not re tick an item that was already completed', async () => {
  // seed storage with the tour item completed, run the tour to the end,
  // no checklist:item-complete event is emitted
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter @apollovisionlabs/guide-core test ChecklistProvider`
Expected: FAIL on the tick assertions.

- [ ] **Step 3: Implement the watcher**

In `ChecklistProvider`, add an effect that reads `guide?.state`:

```tsx
const handledCompletionRef = useRef<string | null>(null)

useEffect(() => {
  const state = guide?.state
  if (!state || state.status !== 'completed' || !state.tourId) {
    // A tour that leaves the completed state clears the guard, so running the
    // same tour a second time can tick its item again after a reset.
    handledCompletionRef.current = null
    return
  }
  if (handledCompletionRef.current === state.tourId) return
  handledCompletionRef.current = state.tourId
  completeItemsForTour(state.tourId)
}, [guide?.state, completeItemsForTour])
```

`completeItemsForTour` walks every checklist, finds items whose `tourId` matches, and marks the ones not already completed, emitting one `checklist:item-complete` each and `checklist:complete` where a list is finished by it. An item already completed produces no event, which is what the fourth test asserts.

- [ ] **Step 4: Run the suite**

Run: `pnpm --filter @apollovisionlabs/guide-core test && pnpm --filter @apollovisionlabs/guide-core typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/ChecklistProvider.tsx packages/core/test/ChecklistProvider.test.tsx
git commit -m "feat(core): complete a checklist item when its linked tour finishes"
```

---

### Task 4: The MUI Checklist component

**Files:**
- Create: `packages/mui/src/Checklist.tsx`
- Modify: `packages/mui/src/index.ts`
- Test: `packages/mui/test/Checklist.test.tsx`

**Interfaces:**
- Consumes: `useChecklist` and `ChecklistProvider` from Task 2.
- Produces: `Checklist` and `ChecklistProps`. Task 5 renders this component inside its popover.

Note the name clash: the core exports a `Checklist` type and this package exports a `Checklist` component. They live in different packages, so both are legal, but inside `packages/mui` import the core type as `type Checklist as ChecklistDefinition` if it is needed at all.

- [ ] **Step 1: Write the failing tests**

Create `packages/mui/test/Checklist.test.tsx`, wrapping the component in a `ChecklistProvider` with three items, one of them pre completed.

```tsx
it('shows the progress as text and as a bar', () => {
  // '1 of 3' is in the document, the progressbar has aria-valuenow 33
})

it('renders one row per item with the completed one marked', () => {})

it('activates the item when the row is clicked', async () => {
  // an item with an href calls navigate
})

it('toggles when the checkbox is clicked, without activating', async () => {
  // navigate is not called, the item becomes completed
})

it('renders nothing once dismissed', async () => {
  // clicking the dismiss button empties the container
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter @apollovisionlabs/guide-mui test Checklist`
Expected: FAIL, the module does not exist.

- [ ] **Step 3: Implement**

Create `packages/mui/src/Checklist.tsx` with the `'use client'` banner:

```tsx
export interface ChecklistProps {
  checklistId: string
  title?: string
  onDismiss?: () => void
}
```

Structure: a `Box` holding a `Stack` header with the `title` as a `Typography`, the progress as `{completedCount} of {total}`, a `LinearProgress` in determinate mode with `value={total === 0 ? 0 : (completedCount / total) * 100}`, and an `IconButton` that calls `dismiss()` then `onDismiss?.()`. Then a `List` of `ListItemButton`s, each with a `Checkbox` in a `ListItemIcon` and a `ListItemText` whose primary carries `sx={{ textDecoration: completed ? 'line-through' : 'none' }}`.

The checkbox handler calls `event.stopPropagation()` before `toggle(item.id)`, so a click on it does not also reach the row's `activate`. That single line is the difference between the third and the fourth test.

Return `null` when `dismissed`.

Use MUI's `@mui/material` icons only if the package already depends on `@mui/icons-material`; it does not, so draw the dismiss affordance as a `Button` with the text `Dismiss`, and the check state through the `Checkbox` alone. Adding an icon dependency for two glyphs is not worth a new peer.

- [ ] **Step 4: Run the suite**

Run: `pnpm --filter @apollovisionlabs/guide-mui test && pnpm --filter @apollovisionlabs/guide-mui typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/mui/src packages/mui/test
git commit -m "feat(mui): checklist list with progress and per item activation"
```

---

### Task 5: The MUI ChecklistLauncher

**Files:**
- Create: `packages/mui/src/ChecklistLauncher.tsx`
- Modify: `packages/mui/src/index.ts`
- Test: `packages/mui/test/ChecklistLauncher.test.tsx`

**Interfaces:**
- Consumes: `useChecklist` from Task 2, the `Checklist` component from Task 4.
- Produces: `ChecklistLauncher` and `ChecklistLauncherProps`.

- [ ] **Step 1: Write the failing tests**

```tsx
it('labels itself with the progress in words', () => {
  // the button's accessible name contains '1 of 3'
})

it('opens the checklist in a dialog and closes it again', async () => {
  // clicking the fab reveals a dialog containing the item titles
})

it('shows a determinate ring reflecting the progress', () => {
  // the progressbar inside the button has aria-valuenow 33
})

it('renders nothing once the checklist is dismissed', async () => {})

it('stays visible when every item is complete', () => {
  // seeded all complete, the button is still in the document
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter @apollovisionlabs/guide-mui test ChecklistLauncher`
Expected: FAIL.

- [ ] **Step 3: Implement**

```tsx
export interface ChecklistLauncherProps {
  checklistId: string
  title?: string
  placement?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
}
```

A `Box` with `position: 'fixed'` and the corner offsets derived from `placement`, holding a `Fab` and, absolutely positioned over it, a `CircularProgress` in `determinate` variant sized just larger than the fab. The fab's `aria-label` is `${title ?? 'Checklist'}, ${completedCount} of ${total} complete`. Clicking it sets the anchor element and opens a `Popover` whose `slotProps` give it `role="dialog"` and an `aria-label`, holding `<Checklist checklistId={checklistId} title={title} onDismiss={close} />`.

Return `null` when `dismissed`.

- [ ] **Step 4: Run both package suites**

Run: `pnpm test && pnpm typecheck`
Expected: PASS across core and mui.

- [ ] **Step 5: Commit**

```bash
git add packages/mui/src packages/mui/test
git commit -m "feat(mui): floating checklist launcher with a progress ring"
```

---

### Task 6: Wire the demo app and cover it end to end

**Files:**
- Create: `apps/demo/src/checklists.ts`
- Modify: `apps/demo/src/App.tsx`
- Create: `e2e/checklist.spec.ts`

**Interfaces:**
- Consumes: everything from Tasks 2 to 5.
- Produces: the demo checklist `onboarding`, used by the Playwright spec.

- [ ] **Step 1: Define the checklist**

Create `apps/demo/src/checklists.ts`:

```ts
import type { Checklist } from '@apollovisionlabs/guide-core'

export const onboardingChecklist: Checklist = {
  id: 'onboarding',
  items: [
    { id: 'tour', title: 'Take the product tour', body: 'Two minutes, three screens.', tourId: 'product' },
    { id: 'projects', title: 'Open the projects page', body: 'See what a list looks like.', href: '/projects' },
    { id: 'theme', title: 'Try dark mode', body: 'The tour follows your theme.' },
  ],
}
```

Use the real id of the tour exported by `apps/demo/src/tours.ts` for `tourId`; read that file rather than assuming it is `product`.

- [ ] **Step 2: Mount the provider and the launcher**

In `apps/demo/src/App.tsx`, wrap the existing children in a `ChecklistProvider` placed inside `GuideProvider`, given the same `storage`, `navigate` and `onEvent`, and render `<ChecklistLauncher checklistId="onboarding" title="Get started" />` next to `<GuideTour />`.

- [ ] **Step 3: Write the end to end spec**

Create `e2e/checklist.spec.ts`, following the structure of `e2e/tour.spec.ts` for the base URL and setup:

```ts
test('an item launches the tour, and finishing it ticks the item', async ({ page }) => {
  // open the launcher, click the tour row, walk the tour to its end,
  // reopen the launcher, the tour row reads as completed
})

test('a ticked item survives a reload', async ({ page }) => {
  // tick an item by its checkbox, reload, reopen, it is still ticked
})

test('the launcher is reachable and operable from the keyboard', async ({ page }) => {
  // focus the fab, press Enter, the dialog opens and holds focus
})
```

- [ ] **Step 4: Run the end to end suite**

Run: `pnpm build && pnpm test:e2e`
Expected: PASS. The build is required first because the demo app imports the packages from their `dist`.

If a pre-existing snapshot test fails on a platform suffix, do not regenerate baselines; report it as a pre-existing condition in the task report. This plan adds no snapshot.

- [ ] **Step 5: Commit**

```bash
git add apps/demo/src e2e/checklist.spec.ts
git commit -m "test(e2e): checklist launches a tour and persists its progress"
```

---

### Task 7: Documentation and changeset

**Files:**
- Modify: `packages/core/README.md`, `packages/mui/README.md`, `README.md`
- Modify: `docs/adoption.md`, `docs/index.md`, `docs/log.md`
- Create: `docs/adr/0016-one-storage-contract-for-tours-and-checklists.md`
- Create: `.changeset/<any-name>.md`

**Interfaces:**
- Consumes: the finished API from every earlier task. Read the actual exported signatures before writing; do not document this plan's intent where the code ended up different.

- [ ] **Step 1: Write the ADR**

`docs/adr/0016-one-storage-contract-for-tours-and-checklists.md`, with the OKF frontmatter every ADR in that directory carries (`type: ADR`, `title`, `description`, `tags`, `status: stable`, and a `generated` block with `by`, `at` as an ISO 8601 UTC timestamp, and `directed_by: human:remy dème`). Follow the section shape of the neighbouring ADRs: Status, Context, Decision, Consequences, Alternatives considered.

The decision is the generic contract. The consequences state both breaks plainly: a custom `GuideStorage` implementation must widen its signature, and tour progress stored under the old key is orphaned so a user mid tour starts it again once. The alternative considered is a second `ChecklistStorage` interface, rejected because a project wiring persistence to its own backend would implement two interfaces for one job.

- [ ] **Step 2: Document the checklist**

Add a checklist section to `packages/core/README.md` and `packages/mui/README.md` showing the provider, the hook and the two components with a runnable snippet each, and note the storage key namespaces. Add a section to `docs/adoption.md` that carries a real trap, the same way its tour sections do: a checklist item whose `tourId` names a tour the `GuideProvider` does not hold warns and does nothing, which is silent in production unless `onEvent` is wired.

Update the root `README.md` feature list so the checklist is no longer described as planned.

- [ ] **Step 3: Update the documentation map**

Add the new spec, plan and ADR to `docs/index.md`, and add an entry to `docs/log.md` under a `## 2026-09-03` heading, newest first.

- [ ] **Step 4: Write the changeset**

Create a file under `.changeset/` marking both `@apollovisionlabs/guide-core` and `@apollovisionlabs/guide-mui` as `minor`, whose body names the feature and both breaking consequences. Do not run `changeset version`.

- [ ] **Step 5: Verify the whole repository**

Run: `pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e`
Expected: PASS.

Then check the branch for forbidden dashes:

```bash
git diff main -U0 | grep -nP '^\+.*[\x{2014}\x{2013}]'
```
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add README.md packages/core/README.md packages/mui/README.md docs .changeset
git commit -m "docs: checklist usage, the storage decision and a 0.2.0 changeset"
```
