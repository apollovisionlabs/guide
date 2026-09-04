# Advancing on an action, and hotspots: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A tour step can advance when the user clicks its target, and a hotspot can point at one element outside any tour.

**Architecture:** Both additions reuse the target resolution the core already owns. `advanceOn` is a field on `Step` honoured by `GuideProvider` and reflected by `StepPopover`. Hotspots follow the shape `ChecklistProvider` established: a provider holding declarative data plus persisted state, a hook, and one MUI component that renders it.

**Tech Stack:** TypeScript, React 18, Vitest with jsdom, Testing Library, Playwright, MUI 7 and MUI 9, pnpm workspaces, changesets.

**Spec:** `docs/superpowers/specs/2026-09-04-guide-actions-and-hotspots-design.md`

## Global Constraints

- Never read, fetch or consult the source of Intro.js or Shepherd.js. They are AGPL or commercially licensed and this package is MIT.
- No vocabulary from the maintainer's private products anywhere in this public repository. Demo content stays generic: projects, teams, settings.
- Never emit an em dash (U+2014) or an en dash (U+2013) in anything authored: source, comments, documentation, commit messages. Rewrite with a comma, a colon, or two sentences.
- English for code, comments, commit messages and documentation.
- Conventional Commits: lowercase type, colon, imperative subject, no trailing period, no dash.
- Both MUI majors must pass. Local runs pin MUI 7; the `mui9` CI job is the only place a MUI 9 incompatibility appears. Prefer `sx` over removed props, and `slotProps` over `inputProps`.
- Do not publish anything. The version bump and the release are a separate human decision.
- Every test must be proven to fail against the behaviour it claims to cover before the implementation is written. A test that passes on the unmodified code tests nothing.
- Run `pnpm test` and `pnpm typecheck` from the repository root before each commit.

---

### Task 1: A step advances on a click

**Files:**
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/GuideProvider.tsx`
- Test: `packages/core/test/GuideProvider.test.tsx`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `Step.advanceOn?: 'click'`; `ActiveStep.interactive: boolean`; `ActiveStep.awaitsAction: boolean`. Task 2 renders from these two derived fields and must not re-derive them.

- [ ] **Step 1: Write the failing tests**

Add to `packages/core/test/GuideProvider.test.tsx`. The fixture needs its own tour, because the shared `tour` has no `advanceOn`:

```tsx
const clickTour: Tour = {
  id: 'click',
  steps: [
    { target: 'one', title: 'First', advanceOn: 'click' },
    { target: 'two', title: 'Second', advanceOn: 'click' },
  ],
}

function ClickHarness({ onAppClick }: { onAppClick?: () => void } = {}) {
  const [count, setCount] = useState(0)
  return (
    <GuideProvider tours={[clickTour]}>
      <button
        data-guide="one"
        onClick={() => {
          setCount((value) => value + 1)
          onAppClick?.()
        }}
      >
        one
      </button>
      <button data-guide="two">two</button>
      <span>{`clicks:${count}`}</span>
      <ClickStarter />
      <StepReadout />
    </GuideProvider>
  )
}

function ClickStarter() {
  const { start } = useTour('click')
  return <button onClick={() => void start()}>start click</button>
}
```

`StepReadout` renders `active.title`, so it needs no change. Add a second readout for the derived flags, used by the last test:

```tsx
function FlagReadout() {
  const active = useGuideStep()
  if (!active) return null
  return <p>{`interactive:${active.interactive} awaits:${active.awaitsAction}`}</p>
}
```

Add `FlagReadout` inside `ClickHarness`, after `StepReadout`.

The tests:

```tsx
describe('advanceOn', () => {
  it('advances when the user clicks the target', async () => {
    const user = userEvent.setup()
    render(<ClickHarness />)
    await user.click(screen.getByText('start click'))
    expect(await screen.findByText('First')).toBeInTheDocument()

    await user.click(screen.getByText('one'))
    expect(await screen.findByText('Second')).toBeInTheDocument()
  })

  it('leaves the application handler working', async () => {
    const user = userEvent.setup()
    const onAppClick = vi.fn()
    render(<ClickHarness onAppClick={onAppClick} />)
    await user.click(screen.getByText('start click'))
    await screen.findByText('First')

    await user.click(screen.getByText('one'))
    expect(onAppClick).toHaveBeenCalledTimes(1)
    expect(screen.getByText('clicks:1')).toBeInTheDocument()
  })

  it('does not advance on a click elsewhere', async () => {
    const user = userEvent.setup()
    render(<ClickHarness />)
    await user.click(screen.getByText('start click'))
    await screen.findByText('First')

    await user.click(screen.getByText('two'))
    expect(screen.getByText('First')).toBeInTheDocument()
  })

  it('completes the tour when the last step is clicked', async () => {
    const user = userEvent.setup()
    const onEvent = vi.fn()
    render(
      <GuideProvider tours={[clickTour]} onEvent={onEvent}>
        <button data-guide="one">one</button>
        <button data-guide="two">two</button>
        <ClickStarter />
        <StepReadout />
      </GuideProvider>,
    )
    await user.click(screen.getByText('start click'))
    await screen.findByText('First')
    await user.click(screen.getByText('one'))
    await screen.findByText('Second')
    await user.click(screen.getByText('two'))

    await waitFor(() =>
      expect(onEvent).toHaveBeenCalledWith({ type: 'tour:complete', tourId: 'click' }),
    )
  })

  it('derives interactive and awaitsAction from advanceOn', async () => {
    const user = userEvent.setup()
    render(<ClickHarness />)
    await user.click(screen.getByText('start click'))
    expect(await screen.findByText('interactive:true awaits:true')).toBeInTheDocument()
  })

  it('leaves a plain step non-interactive and not awaiting', async () => {
    const user = userEvent.setup()
    render(
      <GuideProvider tours={[tour]}>
        <button data-guide="one">one</button>
        <button data-guide="two">two</button>
        <Starter />
        <FlagReadout />
      </GuideProvider>,
    )
    await user.click(screen.getByText('start'))
    expect(await screen.findByText('interactive:false awaits:false')).toBeInTheDocument()
  })
})
```

Import `useState` from `react` at the top of the test file if it is not already imported.

- [ ] **Step 2: Run the tests and watch them fail**

Run: `pnpm --filter @apollovisionlabs/guide-core test -- GuideProvider`

Expected: the four `advanceOn` behaviour tests fail because nothing listens for a click, and the two flag tests fail to compile because `interactive` and `awaitsAction` do not exist on `ActiveStep`. Record the exact failure text in the ledger. A test that passes here is testing nothing: fix the test, not the code.

- [ ] **Step 3: Add the field to the type**

In `packages/core/src/types.ts`, inside `Step`, after `interactive`:

```ts
  /**
   * Advances the tour when the user clicks the target. Implies `interactive`: a step that
   * waits for a click has to let the click through.
   */
  advanceOn?: 'click'
```

- [ ] **Step 4: Expose the derived flags**

In `packages/core/src/GuideProvider.tsx`, add to the `ActiveStep` interface, after `rect`:

```ts
  /**
   * Whether the page stays reachable during the step. True when the step declares
   * `interactive`, and also when it declares `advanceOn`, whose click has to reach the
   * element. Renderers read this instead of `step.interactive`, so the rule lives here.
   */
  interactive: boolean
  /** True when the step advances on a user action rather than on a button. */
  awaitsAction: boolean
```

In the `activeStep` `useMemo`, add the two entries after `rect`:

```ts
      interactive: step.interactive === true || step.advanceOn !== undefined,
      awaitsAction: step.advanceOn !== undefined,
```

- [ ] **Step 5: Attach the listener**

In `packages/core/src/GuideProvider.tsx`, after the `next` callback is defined and before the navigation effect, add:

```tsx
  // A step that waits for a click observes the element rather than wrapping it: bubble phase,
  // no preventDefault, no stopPropagation. The application's own handler runs first and keeps
  // working; the tour only notices that it ran.
  //
  // `next` is read through a ref so that a re-render does not detach and reattach the listener
  // on every step of every tour.
  const nextRef = useRef(next)
  nextRef.current = next

  useEffect(() => {
    if (state.status !== 'running' || !element || step?.advanceOn !== 'click') return
    const onClick = () => nextRef.current()
    element.addEventListener('click', onClick)
    return () => element.removeEventListener('click', onClick)
  }, [state.status, element, step?.advanceOn])
```

- [ ] **Step 6: Run the tests and watch them pass**

Run: `pnpm --filter @apollovisionlabs/guide-core test -- GuideProvider`
Expected: PASS, with no test left failing in the file.

- [ ] **Step 7: Run the whole suite and the typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: PASS. Read the exit code, not only the summary line: Vitest can print a green summary and still exit non-zero on an uncaught error.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/GuideProvider.tsx packages/core/test/GuideProvider.test.tsx
git commit -m "feat(core): advance a step when the user clicks its target"
```

---

### Task 2: The popover stops offering a way around the action

**Files:**
- Modify: `packages/mui/src/StepPopover.tsx`
- Modify: `packages/mui/src/GuideTour.tsx`
- Test: `packages/mui/test/StepPopover.test.tsx`
- Test: `packages/mui/test/GuideTour.test.tsx`

**Interfaces:**
- Consumes: `ActiveStep.interactive` and `ActiveStep.awaitsAction` from Task 1. Do not re-derive them from `step.interactive` or `step.advanceOn`.
- Produces: `StepPopoverProps.awaitsAction?: boolean` and `StepPopoverLabels.awaitingAction: string`.

- [ ] **Step 1: Write the failing tests**

Add to `packages/mui/test/StepPopover.test.tsx`:

```tsx
describe('a step awaiting an action', () => {
  it('offers no button that would skip the action', () => {
    setup({ awaitsAction: true })
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Finish' })).not.toBeInTheDocument()
  })

  it('says what the user is expected to do', () => {
    setup({ awaitsAction: true })
    expect(
      screen.getByText('Click the highlighted element to continue.'),
    ).toBeInTheDocument()
  })

  it('takes that sentence from the labels', () => {
    setup({ awaitsAction: true, labels: { awaitingAction: 'Cliquez pour continuer.' } })
    expect(screen.getByText('Cliquez pour continuer.')).toBeInTheDocument()
  })

  it('ignores ArrowRight, which would be a hidden way around', async () => {
    const user = userEvent.setup()
    const props = setup({ awaitsAction: true })
    await user.keyboard('{ArrowRight}')
    expect(props.onNext).not.toHaveBeenCalled()
  })

  it('still stops on Escape, so the user is never trapped', async () => {
    const user = userEvent.setup()
    const props = setup({ awaitsAction: true })
    await user.keyboard('{Escape}')
    expect(props.onStop).toHaveBeenCalled()
  })

  it('still offers Back', () => {
    setup({ awaitsAction: true, isFirst: false })
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
  })
})
```

Add to `packages/mui/test/GuideTour.test.tsx` a test that the wiring reaches the popover. Follow the file's existing harness; the assertion is:

```tsx
it('renders a step that advances on a click without a Next button', async () => {
  // Render the existing harness with a tour whose only step carries advanceOn: 'click',
  // start it, then:
  expect(await screen.findByRole('dialog')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument()
  expect(screen.getByTestId('guide-spotlight')).toHaveStyle({ pointerEvents: 'none' })
})
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `pnpm --filter @apollovisionlabs/guide-mui test`
Expected: the `awaitsAction` tests fail. The two that assert an absence are the dangerous ones: confirm each fails for the right reason by checking that the Next button IS found, not that the render threw. Record the failure text in the ledger.

- [ ] **Step 3: Add the label and the prop**

In `packages/mui/src/StepPopover.tsx`:

```ts
export interface StepPopoverLabels {
  next: string
  previous: string
  finish: string
  close: string
  /** Shown in place of the primary button while the step waits for a user action. */
  awaitingAction: string
}

const DEFAULT_LABELS: StepPopoverLabels = {
  next: 'Next',
  previous: 'Back',
  finish: 'Finish',
  close: 'Close',
  awaitingAction: 'Click the highlighted element to continue.',
}
```

Add to `StepPopoverProps`, after `modal`:

```ts
  /** The step advances on a user action, so the popover offers no way around it. */
  awaitsAction?: boolean
```

and to the destructured parameters, `awaitsAction = false,`.

- [ ] **Step 4: Honour it in the keyboard handler and the button row**

In `onKeyDown`, change the `ArrowRight` branch:

```tsx
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        // A step that waits for an action must not be advanced from the keyboard either:
        // the arrow would be a way around the very thing the step is asking for.
        if (!awaitsAction) onNext()
      } else if (event.key === 'ArrowLeft') {
```

and add `awaitsAction` to the `useCallback` dependency array.

In the button row, replace the unconditional primary button:

```tsx
          {awaitsAction ? (
            <Typography variant="caption" color="text.secondary">
              {text.awaitingAction}
            </Typography>
          ) : (
            <Button size="small" variant="contained" onClick={onNext}>
              {isLast ? text.finish : text.next}
            </Button>
          )}
```

- [ ] **Step 5: Wire it from the tour**

In `packages/mui/src/GuideTour.tsx`, read the derived flags rather than the raw step:

```tsx
        interactive={active.interactive}
```

on `Spotlight`, and on `StepPopover`:

```tsx
        modal={!active.interactive}
        awaitsAction={active.awaitsAction}
```

- [ ] **Step 6: Run the tests and watch them pass**

Run: `pnpm --filter @apollovisionlabs/guide-mui test`
Expected: PASS.

- [ ] **Step 7: Run the whole suite and the typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/mui/src packages/mui/test
git commit -m "feat(mui): hide the primary button while a step waits for an action"
```

---

### Task 3: Hotspots in the core

**Files:**
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/storage.ts`
- Create: `packages/core/src/HotspotProvider.tsx`
- Create: `packages/core/src/useHotspots.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/storage.test.ts`
- Test: `packages/core/test/HotspotProvider.test.tsx` (create)

**Interfaces:**
- Consumes: `GuideContext` from `GuideProvider`, `resolveText`, `isHotspotsProgress`.
- Produces: `Hotspot`, `ResolvedHotspot`, `HotspotsProgress`, `isHotspotsProgress`, `HotspotProvider`, `HotspotContext`, `useHotspots`, and the events `hotspot:show` and `hotspot:open`. Task 4 renders from `useHotspots()`.

- [ ] **Step 1: Write the failing tests**

Add to `packages/core/test/storage.test.ts`:

```ts
describe('isHotspotsProgress', () => {
  it('accepts a list of seen ids', () => {
    expect(isHotspotsProgress({ seen: ['a', 'b'] })).toBe(true)
    expect(isHotspotsProgress({ seen: [] })).toBe(true)
  })

  it('rejects anything else', () => {
    expect(isHotspotsProgress(null)).toBe(false)
    expect(isHotspotsProgress({})).toBe(false)
    expect(isHotspotsProgress({ seen: 'a' })).toBe(false)
    expect(isHotspotsProgress({ seen: [1] })).toBe(false)
  })
})
```

Create `packages/core/test/HotspotProvider.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HotspotProvider } from '../src/HotspotProvider'
import { useHotspots } from '../src/useHotspots'
import { GuideProvider } from '../src/GuideProvider'
import { createMemoryStorage } from '../src/storage'
import type { GuideEvent, Hotspot, Tour } from '../src/types'

const hotspots: Hotspot[] = [
  { id: 'filters', target: 'filters', title: 'Filters', body: 'Narrow the list.' },
  { id: 'share', target: 'share', title: 'Share', body: 'Send a link.', tourId: 'demo' },
]

function Readout() {
  const { hotspots: resolved, open, reset } = useHotspots()
  return (
    <div>
      {resolved.map((entry) => (
        <p key={entry.id}>{`${entry.id}:${entry.title}:${entry.seen}`}</p>
      ))}
      <button onClick={() => open('filters')}>open filters</button>
      <button onClick={() => open('nope')}>open unknown</button>
      <button onClick={reset}>reset</button>
    </div>
  )
}

describe('HotspotProvider', () => {
  it('resolves every hotspot, unseen at first', () => {
    render(
      <HotspotProvider hotspots={hotspots}>
        <Readout />
      </HotspotProvider>,
    )
    expect(screen.getByText('filters:Filters:false')).toBeInTheDocument()
    expect(screen.getByText('share:Share:false')).toBeInTheDocument()
  })

  it('marks a hotspot seen when it is opened, and emits', async () => {
    const user = userEvent.setup()
    const onEvent = vi.fn()
    render(
      <HotspotProvider hotspots={hotspots} onEvent={onEvent}>
        <Readout />
      </HotspotProvider>,
    )
    await user.click(screen.getByText('open filters'))
    expect(await screen.findByText('filters:Filters:true')).toBeInTheDocument()
    expect(onEvent).toHaveBeenCalledWith({ type: 'hotspot:open', hotspotId: 'filters' })
  })

  it('persists the seen state and restores it', async () => {
    const user = userEvent.setup()
    const storage = createMemoryStorage()
    const { unmount } = render(
      <HotspotProvider hotspots={hotspots} storage={storage}>
        <Readout />
      </HotspotProvider>,
    )
    await user.click(screen.getByText('open filters'))
    await screen.findByText('filters:Filters:true')
    unmount()

    render(
      <HotspotProvider hotspots={hotspots} storage={storage}>
        <Readout />
      </HotspotProvider>,
    )
    expect(await screen.findByText('filters:Filters:true')).toBeInTheDocument()
  })

  it('ignores a stored value of the wrong shape', async () => {
    const storage = createMemoryStorage({ 'hotspots:seen': { seen: 'filters' } })
    render(
      <HotspotProvider hotspots={hotspots} storage={storage}>
        <Readout />
      </HotspotProvider>,
    )
    await waitFor(() =>
      expect(screen.getByText('filters:Filters:false')).toBeInTheDocument(),
    )
  })

  it('warns and changes nothing for an unknown id', async () => {
    const user = userEvent.setup()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(
      <HotspotProvider hotspots={hotspots}>
        <Readout />
      </HotspotProvider>,
    )
    await user.click(screen.getByText('open unknown'))
    expect(warn).toHaveBeenCalledWith('[guide] unknown hotspot "nope"')
    expect(screen.getByText('filters:Filters:false')).toBeInTheDocument()
    warn.mockRestore()
  })

  it('throws on duplicate ids, which are a wiring mistake', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() =>
      render(
        <HotspotProvider hotspots={[hotspots[0]!, hotspots[0]!]}>
          <Readout />
        </HotspotProvider>,
      ),
    ).toThrow('[guide] duplicate hotspot id: filters')
    error.mockRestore()
  })

  it('resolves titleKey and bodyKey through translate', () => {
    render(
      <HotspotProvider
        hotspots={[{ id: 'filters', target: 'filters', titleKey: 'a', bodyKey: 'b' }]}
        translate={(key) => (key === 'a' ? 'Filtres' : 'Réduire la liste.')}
      >
        <Readout />
      </HotspotProvider>,
    )
    expect(screen.getByText('filters:Filtres:false')).toBeInTheDocument()
  })

  it('reset clears the seen state', async () => {
    const user = userEvent.setup()
    render(
      <HotspotProvider hotspots={hotspots}>
        <Readout />
      </HotspotProvider>,
    )
    await user.click(screen.getByText('open filters'))
    await screen.findByText('filters:Filters:true')
    await user.click(screen.getByText('reset'))
    expect(await screen.findByText('filters:Filters:false')).toBeInTheDocument()
  })

  it('warns when a hotspot names a tour with no GuideProvider above', async () => {
    const user = userEvent.setup()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    function StartShare() {
      const { startTour } = useHotspots()
      return <button onClick={() => startTour('share')}>start share</button>
    }
    render(
      <HotspotProvider hotspots={hotspots}>
        <StartShare />
      </HotspotProvider>,
    )
    await user.click(screen.getByText('start share'))
    expect(warn).toHaveBeenCalledWith(
      '[guide] a hotspot needs a GuideProvider to launch a tour',
    )
    warn.mockRestore()
  })

  it('starts the tour a hotspot names', async () => {
    const user = userEvent.setup()
    const onEvent = vi.fn<(event: GuideEvent) => void>()
    const tour: Tour = { id: 'demo', steps: [{ target: 'share', title: 'Here' }] }
    function StartShare() {
      const { startTour } = useHotspots()
      return <button onClick={() => startTour('share')}>start share</button>
    }
    render(
      <GuideProvider tours={[tour]} onEvent={onEvent}>
        <HotspotProvider hotspots={hotspots}>
          <button data-guide="share">share</button>
          <StartShare />
        </HotspotProvider>
      </GuideProvider>,
    )
    await user.click(screen.getByText('start share'))
    await waitFor(() =>
      expect(onEvent).toHaveBeenCalledWith({
        type: 'tour:start',
        tourId: 'demo',
        stepIndex: 0,
      }),
    )
  })
})
```

Note the extra member this reveals: `startTour(hotspotId)`. It belongs on the hook rather than in the MUI component, so that the "a tour needs a GuideProvider" warning lives in one place, next to the checklist's identical warning.

- [ ] **Step 2: Run the tests and watch them fail**

Run: `pnpm --filter @apollovisionlabs/guide-core test`
Expected: `HotspotProvider.test.tsx` fails to resolve its imports, and the `storage` describe fails on an undefined `isHotspotsProgress`. Record it in the ledger.

- [ ] **Step 3: Add the types**

In `packages/core/src/types.ts`, after the checklist types:

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

Extend the comment on `GuideStorage.read` so the third key shape is documented:

```ts
  /**
   * Reads a previously written value. The key is namespaced by the caller,
   * `tour:<id>`, `checklist:<id>`, or `hotspots:seen`, so one storage serves them all.
   */
```

Add the two events to `GuideEvent`:

```ts
  | { type: 'hotspot:show'; hotspotId: string }
  | { type: 'hotspot:open'; hotspotId: string }
```

- [ ] **Step 4: Add the guard**

In `packages/core/src/storage.ts`, import `HotspotsProgress` and add:

```ts
/**
 * Same defensive posture as the two guards above: a stored hotspot value is never trusted
 * until its shape is checked.
 */
export function isHotspotsProgress(value: unknown): value is HotspotsProgress {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    Array.isArray(candidate.seen) &&
    candidate.seen.every((entry) => typeof entry === 'string')
  )
}
```

- [ ] **Step 5: Write the provider**

Create `packages/core/src/HotspotProvider.tsx`:

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
import type { GuideEvent, GuideStorage, Hotspot, Translate } from './types'
import { GuideContext } from './GuideProvider'
import { isHotspotsProgress } from './storage'

const STORAGE_KEY = 'hotspots:seen'

export interface HotspotContextValue {
  hotspots: Hotspot[]
  seen: string[]
  translate?: Translate
  open: (hotspotId: string) => void
  startTour: (hotspotId: string) => void
  reset: () => void
  notifyShown: (hotspotId: string) => void
}

export const HotspotContext = createContext<HotspotContextValue | null>(null)

export interface HotspotProviderProps {
  hotspots: Hotspot[]
  children: ReactNode
  storage?: GuideStorage
  translate?: Translate
  onEvent?: (event: GuideEvent) => void
}

export function HotspotProvider({
  hotspots,
  children,
  storage,
  translate,
  onEvent,
}: HotspotProviderProps) {
  const hotspotsById = useMemo(() => {
    const map = new Map<string, Hotspot>()
    for (const candidate of hotspots) {
      // Silence here would hide a wiring mistake until production, the same way a duplicate
      // tour id would.
      if (map.has(candidate.id)) {
        throw new Error(`[guide] duplicate hotspot id: ${candidate.id}`)
      }
      map.set(candidate.id, candidate)
    }
    return map
  }, [hotspots])

  const [seen, setSeen] = useState<string[]>([])

  // Synchronous mirror of `seen`, for the same reason ChecklistProvider keeps one: two calls
  // in a single tick would otherwise both compute their next value from the same stale
  // render-time closure, and the first write would be dropped.
  const seenRef = useRef(seen)

  const guide = useContext(GuideContext)

  const storageWarnedRef = useRef(false)
  const warnStorageFailure = useCallback((error: unknown) => {
    if (storageWarnedRef.current) return
    storageWarnedRef.current = true
    console.warn('[guide] storage failed; hotspot state will not be persisted', error)
  }, [])

  const noGuideWarnedRef = useRef(false)
  const warnNoGuide = useCallback(() => {
    if (noGuideWarnedRef.current) return
    noGuideWarnedRef.current = true
    console.warn('[guide] a hotspot needs a GuideProvider to launch a tour')
  }, [])

  const tourStartFailedWarnedRef = useRef(false)
  const warnTourStartFailure = useCallback((error: unknown) => {
    if (tourStartFailedWarnedRef.current) return
    tourStartFailedWarnedRef.current = true
    console.warn('[guide] starting a tour for a hotspot failed', error)
  }, [])

  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent
  const emit = useCallback((event: GuideEvent) => onEventRef.current?.(event), [])

  // Restore once on mount. `seen` only ever grows, so merging by union is correct even when a
  // slow read lands after the user has already opened a hotspot: nothing the union does can
  // un-see one. `reset` is the single move that subtracts and therefore loses that race, the
  // same bounded window ChecklistProvider documents at the same place.
  useEffect(() => {
    if (!storage) return
    let cancelled = false
    void (async () => {
      let stored: unknown = null
      try {
        stored = await storage.read<unknown>(STORAGE_KEY)
      } catch (error) {
        warnStorageFailure(error)
        return
      }
      if (cancelled || !isHotspotsProgress(stored)) return
      const merged = seenRef.current.concat(
        stored.seen.filter((id) => !seenRef.current.includes(id)),
      )
      seenRef.current = merged
      setSeen(merged)
    })()
    return () => {
      cancelled = true
    }
  }, [storage, warnStorageFailure])

  const applySeen = useCallback(
    (next: string[]) => {
      seenRef.current = next
      setSeen(next)
      if (!storage) return
      try {
        void Promise.resolve(storage.write(STORAGE_KEY, { seen: next })).catch(
          warnStorageFailure,
        )
      } catch (error) {
        warnStorageFailure(error)
      }
    },
    [storage, warnStorageFailure],
  )

  const resolve = useCallback(
    (hotspotId: string): Hotspot | null => {
      const hotspot = hotspotsById.get(hotspotId)
      if (!hotspot) {
        console.warn(`[guide] unknown hotspot "${hotspotId}"`)
        return null
      }
      return hotspot
    },
    [hotspotsById],
  )

  const open = useCallback(
    (hotspotId: string) => {
      if (!resolve(hotspotId)) return
      emit({ type: 'hotspot:open', hotspotId })
      if (seenRef.current.includes(hotspotId)) return
      applySeen([...seenRef.current, hotspotId])
    },
    [resolve, applySeen, emit],
  )

  const startTour = useCallback(
    (hotspotId: string) => {
      const hotspot = resolve(hotspotId)
      if (!hotspot?.tourId) return
      if (!guide) {
        warnNoGuide()
        return
      }
      void guide.start(hotspot.tourId).catch(warnTourStartFailure)
    },
    [resolve, guide, warnNoGuide, warnTourStartFailure],
  )

  const reset = useCallback(() => applySeen([]), [applySeen])

  // Emitted by the renderer, which is the only layer that knows whether a marker is actually
  // on screen. Once per hotspot per mount: a scroll that re-measures must not re-announce.
  const shownRef = useRef<Set<string>>(new Set())
  const notifyShown = useCallback(
    (hotspotId: string) => {
      if (shownRef.current.has(hotspotId)) return
      shownRef.current.add(hotspotId)
      emit({ type: 'hotspot:show', hotspotId })
    },
    [emit],
  )

  const value = useMemo<HotspotContextValue>(
    () => ({ hotspots, seen, translate, open, startTour, reset, notifyShown }),
    [hotspots, seen, translate, open, startTour, reset, notifyShown],
  )

  return <HotspotContext.Provider value={value}>{children}</HotspotContext.Provider>
}
```

- [ ] **Step 6: Write the hook**

Create `packages/core/src/useHotspots.ts`:

```ts
'use client'

import { useContext, useMemo } from 'react'
import { HotspotContext } from './HotspotProvider'
import { resolveText } from './resolveText'
import type { ResolvedHotspot } from './types'

export interface UseHotspotsResult {
  /**
   * Every hotspot, each carrying its own `seen`, rather than the unseen ones alone. A
   * renderer has to keep a marker mounted while its own bubble closes, so it needs the seen
   * one too; filtering is one line at the call site.
   */
  hotspots: ResolvedHotspot[]
  open: (hotspotId: string) => void
  startTour: (hotspotId: string) => void
  reset: () => void
  notifyShown: (hotspotId: string) => void
}

export function useHotspots(): UseHotspotsResult {
  const context = useContext(HotspotContext)
  if (!context)
    throw new Error('[guide] useHotspots must be used inside a HotspotProvider')

  const { seen, translate, open, startTour, reset, notifyShown } = context

  const hotspots = useMemo<ResolvedHotspot[]>(
    () =>
      context.hotspots.map((hotspot) => ({
        id: hotspot.id,
        target: hotspot.target,
        title: resolveText(hotspot.title, hotspot.titleKey, translate),
        body: resolveText(hotspot.body, hotspot.bodyKey, translate),
        seen: seen.includes(hotspot.id),
        tourId: hotspot.tourId,
        placement: hotspot.placement,
      })),
    [context.hotspots, seen, translate],
  )

  return useMemo(
    () => ({ hotspots, open, startTour, reset, notifyShown }),
    [hotspots, open, startTour, reset, notifyShown],
  )
}
```

- [ ] **Step 7: Export both**

In `packages/core/src/index.ts`, after the checklist exports:

```ts
export * from './HotspotProvider'
export * from './useHotspots'
```

- [ ] **Step 8: Run the tests and watch them pass**

Run: `pnpm --filter @apollovisionlabs/guide-core test`
Expected: PASS.

- [ ] **Step 9: Run the whole suite and the typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add packages/core/src packages/core/test
git commit -m "feat(core): hotspots, pointing at one element outside a tour"
```

---

### Task 4: Hotspots in MUI

**Files:**
- Create: `packages/mui/src/Hotspots.tsx`
- Modify: `packages/mui/src/index.ts`
- Test: `packages/mui/test/Hotspots.test.tsx` (create)

**Interfaces:**
- Consumes: `useHotspots`, `useTargetElement`, `useElementRect`, `useFocusTrap`, `usePrefersReducedMotion` from `@apollovisionlabs/guide-core`.
- Produces: `Hotspots`, `HotspotLabels`.

- [ ] **Step 1: Write the failing tests**

Create `packages/mui/test/Hotspots.test.tsx`:

```tsx
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { HotspotProvider, createMemoryStorage } from '@apollovisionlabs/guide-core'
import type { Hotspot } from '@apollovisionlabs/guide-core'
import { Hotspots } from '../src/Hotspots'

const testTheme = createTheme({
  components: { MuiButtonBase: { defaultProps: { disableRipple: true } } },
})

const hotspots: Hotspot[] = [
  { id: 'filters', target: 'filters', title: 'Filters', body: 'Narrow the list.' },
]

function Page({ children, ...rest }: { children?: ReactNode } & Record<string, unknown>) {
  return (
    <ThemeProvider theme={testTheme}>
      <HotspotProvider hotspots={hotspots} {...rest}>
        <button data-guide="filters">filters</button>
        <Hotspots />
        {children}
      </HotspotProvider>
    </ThemeProvider>
  )
}

describe('Hotspots', () => {
  it('marks an unseen hotspot with a labelled button', async () => {
    render(<Page />)
    expect(
      await screen.findByRole('button', { name: 'Show what is new: Filters' }),
    ).toBeInTheDocument()
  })

  it('renders nothing for a target that is not on the page', () => {
    render(
      <ThemeProvider theme={testTheme}>
        <HotspotProvider hotspots={hotspots}>
          <Hotspots />
        </HotspotProvider>
      </ThemeProvider>,
    )
    expect(
      screen.queryByRole('button', { name: /Show what is new/ }),
    ).not.toBeInTheDocument()
  })

  it('opens a labelled dialog carrying the body', async () => {
    const user = userEvent.setup()
    render(<Page />)
    await user.click(await screen.findByRole('button', { name: /Filters/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Filters' })
    expect(dialog).toHaveTextContent('Narrow the list.')
  })

  it('emits hotspot:show once the marker is on screen', async () => {
    const onEvent = vi.fn()
    render(<Page onEvent={onEvent} />)
    await waitFor(() =>
      expect(onEvent).toHaveBeenCalledWith({ type: 'hotspot:show', hotspotId: 'filters' }),
    )
  })

  it('marks the hotspot seen, so it is gone after a reload', async () => {
    const user = userEvent.setup()
    const storage = createMemoryStorage()
    const { unmount } = render(<Page storage={storage} />)
    await user.click(await screen.findByRole('button', { name: /Filters/ }))
    await screen.findByRole('dialog', { name: 'Filters' })
    unmount()

    render(<Page storage={storage} />)
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: /Show what is new/ }),
      ).not.toBeInTheDocument(),
    )
  })

  it('keeps the marker mounted while its own bubble is open', async () => {
    const user = userEvent.setup()
    render(<Page />)
    const marker = await screen.findByRole('button', { name: /Filters/ })
    await user.click(marker)
    await screen.findByRole('dialog', { name: 'Filters' })
    // The provider now reports the hotspot as seen. If the marker unmounted on that, the
    // bubble would have lost its anchor at the moment it opened.
    expect(screen.getByRole('button', { name: /Filters/ })).toBeInTheDocument()
  })

  it('closes on Escape and leaves focus on the marker', async () => {
    const user = userEvent.setup()
    render(<Page />)
    const marker = await screen.findByRole('button', { name: /Filters/ })
    await user.click(marker)
    await screen.findByRole('dialog', { name: 'Filters' })
    await user.keyboard('{Escape}')
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    expect(document.activeElement).not.toBe(document.body)
  })

  it('offers a tour button only when the hotspot names a tour', async () => {
    const user = userEvent.setup()
    render(<Page />)
    await user.click(await screen.findByRole('button', { name: /Filters/ }))
    await screen.findByRole('dialog', { name: 'Filters' })
    expect(screen.queryByRole('button', { name: 'Show me' })).not.toBeInTheDocument()
  })

  it('takes its wording from the labels', async () => {
    render(
      <ThemeProvider theme={testTheme}>
        <HotspotProvider hotspots={hotspots}>
          <button data-guide="filters">filters</button>
          <Hotspots labels={{ marker: (title) => `Nouveau : ${title}` }} />
        </HotspotProvider>
      </ThemeProvider>,
    )
    expect(
      await screen.findByRole('button', { name: 'Nouveau : Filters' }),
    ).toBeInTheDocument()
  })
})
```

A tenth test covers the tour button. Add a second fixture whose hotspot carries `tourId: 'demo'`, wrap it in a `GuideProvider` holding that tour, open the bubble, click `Show me`, and assert the tour's dialog is reachable through `onEvent` receiving `tour:start`.

- [ ] **Step 2: Run the tests and watch them fail**

Run: `pnpm --filter @apollovisionlabs/guide-mui test -- Hotspots`
Expected: the import of `../src/Hotspots` fails. Record it in the ledger.

- [ ] **Step 3: Write the component**

Create `packages/mui/src/Hotspots.tsx`:

```tsx
'use client'

import { useCallback, useEffect, useId, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Popper from '@mui/material/Popper'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import {
  useElementRect,
  useFocusTrap,
  useHotspots,
  usePrefersReducedMotion,
  useTargetElement,
  type Placement,
  type ResolvedHotspot,
} from '@apollovisionlabs/guide-core'

export interface HotspotLabels {
  /** Accessible name of the marker. A function, because word order varies by language. */
  marker: (title: string) => string
  startTour: string
  close: string
}

const DEFAULT_LABELS: HotspotLabels = {
  marker: (title) => `Show what is new: ${title}`,
  startTour: 'Show me',
  close: 'Close',
}

const MARKER_SIZE = 14

export interface HotspotsProps {
  labels?: Partial<HotspotLabels>
  placement?: Placement
  /**
   * Stacking level of the markers. The default sits above the app bar, since the element a
   * hotspot points at is often in one, and below a running tour's spotlight, which is at
   * `theme.zIndex.modal`. A hotspot whose target lives inside a modal dialog is therefore
   * covered; raise this to bring it out.
   */
  zIndex?: number
}

export function Hotspots({ labels, placement = 'bottom', zIndex }: HotspotsProps = {}) {
  const { hotspots } = useHotspots()
  const [openId, setOpenId] = useState<string | null>(null)

  const text = { ...DEFAULT_LABELS, ...labels }

  return (
    <>
      {hotspots.map((hotspot) => (
        <HotspotMarker
          key={hotspot.id}
          hotspot={hotspot}
          labels={text}
          placement={hotspot.placement ?? placement}
          zIndex={zIndex}
          isOpen={openId === hotspot.id}
          onOpen={() => setOpenId(hotspot.id)}
          onClose={() => setOpenId((current) => (current === hotspot.id ? null : current))}
        />
      ))}
    </>
  )
}

interface HotspotMarkerProps {
  hotspot: ResolvedHotspot
  labels: HotspotLabels
  placement: Placement
  zIndex?: number
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
}

function HotspotMarker({
  hotspot,
  labels,
  placement,
  zIndex,
  isOpen,
  onOpen,
  onClose,
}: HotspotMarkerProps) {
  const theme = useTheme()
  const titleId = useId()
  const bodyId = useId()
  const reducedMotion = usePrefersReducedMotion()
  const { open, startTour, notifyShown } = useHotspots()

  const { element } = useTargetElement(hotspot.target)
  const rect = useElementRect(element)

  const [marker, setMarker] = useState<HTMLButtonElement | null>(null)
  const [bubble, setBubble] = useState<HTMLElement | null>(null)

  // Opening marks the hotspot seen, so the provider stops listing it as unseen. Without this
  // local flag the marker would unmount at that instant and the bubble would lose its anchor.
  // It is cleared on blur rather than on close, so focus, which the trap returns to the
  // marker, never falls through to document.body.
  const [openedHere, setOpenedHere] = useState(false)

  useFocusTrap(bubble, isOpen)

  useEffect(() => {
    if (rect) notifyShown(hotspot.id)
  }, [rect, hotspot.id, notifyShown])

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onClose()
    },
    [onClose],
  )

  useEffect(() => {
    if (!isOpen) return
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onKeyDown])

  useEffect(() => {
    if (!isOpen || !bubble) return
    const onPointerDown = (event: MouseEvent) => {
      const node = event.target as Node
      if (bubble.contains(node)) return
      if (marker?.contains(node)) return
      onClose()
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [isOpen, bubble, marker, onClose])

  if (!rect) return null
  if (hotspot.seen && !openedHere) return null

  const onMarkerClick = () => {
    setOpenedHere(true)
    open(hotspot.id)
    onOpen()
  }

  return (
    <>
      <Box
        component="button"
        type="button"
        ref={setMarker}
        aria-label={labels.marker(hotspot.title)}
        aria-expanded={isOpen}
        onClick={onMarkerClick}
        onBlur={() => {
          if (!isOpen) setOpenedHere(false)
        }}
        sx={{
          position: 'fixed',
          top: rect.top - MARKER_SIZE / 2,
          left: rect.left + rect.width - MARKER_SIZE / 2,
          width: MARKER_SIZE,
          height: MARKER_SIZE,
          p: 0,
          border: 0,
          borderRadius: '50%',
          cursor: 'pointer',
          backgroundColor: theme.palette.primary.main,
          zIndex: zIndex ?? theme.zIndex.drawer + 1,
          '&::after': {
            content: '""',
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            backgroundColor: theme.palette.primary.main,
            animation: reducedMotion ? 'none' : 'guide-hotspot-pulse 1800ms ease-out infinite',
          },
          '@keyframes guide-hotspot-pulse': {
            '0%': { transform: 'scale(1)', opacity: 0.6 },
            '100%': { transform: 'scale(2.4)', opacity: 0 },
          },
        }}
      />

      {isOpen && (
        <Popper
          open
          anchorEl={marker}
          placement={placement}
          sx={{ zIndex: (zIndex ?? theme.zIndex.drawer + 1) + 1 }}
          modifiers={[{ name: 'offset', options: { offset: [0, 12] } }]}
        >
          <Paper
            ref={setBubble}
            elevation={8}
            role="dialog"
            aria-labelledby={titleId}
            aria-describedby={bodyId}
            sx={{ maxWidth: 300, p: 2, borderRadius: 2 }}
          >
            <Typography id={titleId} variant="subtitle2" sx={{ fontWeight: 600 }}>
              {hotspot.title}
            </Typography>
            <Typography id={bodyId} variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {hotspot.body}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 2, justifyContent: 'flex-end' }}>
              {hotspot.tourId && (
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => {
                    onClose()
                    startTour(hotspot.id)
                  }}
                >
                  {labels.startTour}
                </Button>
              )}
              <Button size="small" onClick={onClose}>
                {labels.close}
              </Button>
            </Box>
          </Paper>
        </Popper>
      )}
    </>
  )
}
```

- [ ] **Step 4: Export it**

In `packages/mui/src/index.ts`, add `export * from './Hotspots'`.

- [ ] **Step 5: Run the tests and watch them pass**

Run: `pnpm --filter @apollovisionlabs/guide-mui test`
Expected: PASS. If the marker is not found, check that `useTargetElement` resolved the element: the fixture must render the `data-guide` element before `Hotspots`.

- [ ] **Step 6: Run the whole suite and the typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/mui/src packages/mui/test
git commit -m "feat(mui): render hotspots as a marker and a bubble"
```

---

### Task 5: The demo exercises both, end to end

**Files:**
- Create: `apps/demo/src/hotspots.ts`
- Modify: `apps/demo/src/tours.ts`
- Modify: `apps/demo/src/App.tsx`
- Modify: `apps/demo/src/pages/Projects.tsx` (or wherever the target lives)
- Create: `e2e/hotspots.spec.ts`
- Create or modify: `e2e/tour.spec.ts` for the click-to-advance scenario

**Interfaces:**
- Consumes: everything from Tasks 1 to 4.
- Produces: nothing other tasks read.

- [ ] **Step 1: Add a step that waits for a click**

In `apps/demo/src/tours.ts`, give one existing step `advanceOn: 'click'`. Pick the step whose target is a real button the user can press, so the Playwright scenario is honest. Keep the demo's own copy generic.

- [ ] **Step 2: Declare the hotspots**

Create `apps/demo/src/hotspots.ts`:

```ts
import type { Hotspot } from '@apollovisionlabs/guide-core'

export const hotspots: Hotspot[] = [
  {
    id: 'filters',
    target: 'filters',
    title: 'Filter your projects',
    body: 'Narrow the list down to what you are working on right now.',
  },
  {
    id: 'share',
    target: 'share',
    title: 'Share a project',
    body: 'Send a link to anyone on your team.',
    tourId: 'product',
  },
]
```

Use the tour id the demo actually declares. Add a `data-guide="filters"` element to the projects page if none exists.

- [ ] **Step 3: Wire the provider and the renderer**

In `apps/demo/src/App.tsx`, wrap the tree in `HotspotProvider` inside `GuideProvider`, passing the same `storage`, and render `<Hotspots />` next to `<GuideTour />`.

- [ ] **Step 4: Write the failing end to end tests**

Create `e2e/hotspots.spec.ts`:

```ts
import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => window.localStorage.clear())
  await page.goto('/')
})

test('a hotspot explains one element and then stays gone', async ({ page }) => {
  await page.goto('/projects')
  const marker = page.getByRole('button', { name: /Filter your projects/ })
  await expect(marker).toBeVisible()

  await marker.click()
  const bubble = page.getByRole('dialog', { name: 'Filter your projects' })
  await expect(bubble).toContainText('Narrow the list down')

  await page.keyboard.press('Escape')
  await expect(bubble).toBeHidden()

  await page.reload()
  await expect(page.getByRole('button', { name: /Filter your projects/ })).toBeHidden()
})
```

And in `e2e/tour.spec.ts`, a scenario that starts the tour, reaches the step carrying `advanceOn`, asserts there is no Next button, clicks the real element, and asserts the tour moved on.

- [ ] **Step 5: Run them and watch them fail, then pass**

Run: `pnpm exec playwright test`
Expected: red before Steps 1 to 3 are in place, green after. If the demo was already wired when the tests were written, remove the wiring, watch them fail, and put it back. A test that has never been red proves nothing.

- [ ] **Step 6: Commit**

```bash
git add apps/demo e2e
git commit -m "test(e2e): a step waiting on a click, and a hotspot seen once"
```

---

### Task 6: Say what it does, and prepare the release

**Files:**
- Modify: `README.md`
- Modify: `packages/core/README.md` and `packages/mui/README.md` if they carry the same tables
- Modify: `docs/adoption.md`
- Create: `docs/adr/0017-advancing-on-an-action-implies-an-interactive-step.md`
- Modify: `docs/adr/index.md`
- Modify: `docs/index.md` and `docs/log.md`
- Create: `.changeset/<name>.md`

**Interfaces:**
- Consumes: the behaviour as it was actually implemented in Tasks 1 to 5, not as this plan described it. Read the merged code before writing a word.

- [ ] **Step 1: Verify before documenting**

Read the implemented source. Every sentence written here must be checked against it. If the implementation diverged from the plan, the documentation follows the implementation and the divergence is noted in the ledger. Do not document behaviour you have not seen a test assert.

- [ ] **Step 2: Extend the README**

Add `advanceOn` to the `Step` table, `awaitingAction` to the `labels` row for `GuideTour`, a section on hotspots with `HotspotProvider` props, `useHotspots`, and `Hotspots` props, and the two new events to the events table. State the stacking limit plainly: a hotspot whose target is inside a modal dialog is covered by it unless `zIndex` is raised.

- [ ] **Step 3: Write the ADR**

`docs/adr/0017-advancing-on-an-action-implies-an-interactive-step.md`, following the template in `docs/adr/template.md`. The decision: `advanceOn` derives `interactive` in the core rather than requiring the caller to set both, because a step that waits for a click and does not let the click through is a dead end, and because a renderer reading `step.interactive` directly would get it wrong. Record the consequence: `ActiveStep` now carries derived `interactive` and `awaitsAction`, and renderers must read those.

- [ ] **Step 4: Update the bundle indexes**

Add the ADR to `docs/adr/index.md` and anything new to `docs/index.md`. Add a dated entry to `docs/log.md`, newest first.

- [ ] **Step 5: Write the changeset**

```bash
cat > .changeset/actions-and-hotspots.md <<'EOF'
---
'@apollovisionlabs/guide-core': minor
'@apollovisionlabs/guide-mui': minor
---

A step can now advance when the user clicks its target, through `advanceOn: 'click'`. Such a
step is interactive by construction, and its popover offers no button and no arrow key that
would skip the action it is asking for.

Hotspots are new: a marker on one element, outside any tour, opening a short explanation that
can start a tour. Opening one marks it seen, for good, through the same storage the tour and
the checklist use.

Nothing here is breaking.
EOF
```

- [ ] **Step 6: Check the prose for dashes**

Run: `git diff -U0 | grep -nP '^\+.*[\x{2014}\x{2013}]'`
Expected: no output. Fix every hit by rewriting the sentence.

- [ ] **Step 7: Run everything**

Run: `pnpm test && pnpm typecheck && pnpm build`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add README.md packages/*/README.md docs .changeset
git commit -m "docs: advancing on an action, and hotspots"
```
