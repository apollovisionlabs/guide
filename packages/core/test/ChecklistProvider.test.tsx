import { describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { ChecklistProvider } from '../src/ChecklistProvider'
import { useChecklist } from '../src/useChecklist'
import { GuideProvider } from '../src/GuideProvider'
import { useGuideStep } from '../src/useGuideStep'
import { useTour } from '../src/useTour'
import { createMemoryStorage } from '../src/storage'
import type { Checklist, GuideEvent, GuideStorage, Tour } from '../src/types'

const checklist: Checklist = {
  id: 'onboarding',
  items: [
    { id: 'profile', title: 'Fill in your profile' },
    { id: 'reports', title: 'Open a report', href: '/reports' },
    { id: 'tour', title: 'Take the tour', tourId: 'demo' },
  ],
}

const demoTour: Tour = {
  id: 'demo',
  steps: [{ target: 'one', title: 'First' }],
}

function ChecklistReadout() {
  const {
    items,
    completedCount,
    total,
    isComplete,
    dismissed,
    restored,
    activate,
    toggle,
    complete,
    dismiss,
    reset,
  } = useChecklist('onboarding')
  return (
    <div>
      <p>{`${completedCount}/${total}`}</p>
      <p>{isComplete ? 'complete' : 'incomplete'}</p>
      <p>{dismissed ? 'dismissed' : 'not-dismissed'}</p>
      <p>{restored ? 'restored' : 'not-restored'}</p>
      {items.map((item) => (
        <p key={item.id}>{`${item.id}:${item.completed ? 'done' : 'todo'}`}</p>
      ))}
      {items.map((item) => (
        <button key={item.id} onClick={() => toggle(item.id)}>{`toggle-${item.id}`}</button>
      ))}
      {items.map((item) => (
        <button key={item.id} onClick={() => complete(item.id)}>{`complete-${item.id}`}</button>
      ))}
      {items.map((item) => (
        <button key={item.id} onClick={() => activate(item.id)}>{`activate-${item.id}`}</button>
      ))}
      <button onClick={dismiss}>dismiss</button>
      <button onClick={reset}>reset</button>
    </div>
  )
}

function Harness(props: Partial<ComponentProps<typeof ChecklistProvider>> = {}) {
  return (
    <ChecklistProvider checklists={[checklist]} {...props}>
      <ChecklistReadout />
    </ChecklistProvider>
  )
}

function UnknownChecklistReader() {
  useChecklist('missing')
  return null
}

describe('ChecklistProvider', () => {
  it('starts with nothing completed', () => {
    render(<Harness />)
    expect(screen.getByText('0/3')).toBeInTheDocument()
  })

  it('toggles an item in both directions', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByText('toggle-profile'))
    expect(await screen.findByText('profile:done')).toBeInTheDocument()
    await user.click(screen.getByText('toggle-profile'))
    expect(await screen.findByText('profile:todo')).toBeInTheDocument()
  })

  it('restores progress from storage on mount', async () => {
    const storage = createMemoryStorage({
      'checklist:onboarding': { completed: ['profile'], dismissed: false },
    })
    render(<Harness storage={storage} />)
    expect(await screen.findByText('1/3')).toBeInTheDocument()
    expect(screen.getByText('profile:done')).toBeInTheDocument()
  })

  // A memory storage resolves before any assertion can run, so it can never distinguish
  // "restored is true because it started true" from "restored is true because the read already
  // landed". A controllable storage, resolved or rejected by hand, is what makes the flag's
  // three required states each their own observation rather than a hope that a race is won.
  function controllableStorage() {
    let resolveRead!: (value: unknown) => void
    let rejectRead!: (reason?: unknown) => void
    const pending = new Promise<unknown>((resolve, reject) => {
      resolveRead = resolve
      rejectRead = reject
    })
    const storage: GuideStorage = {
      read: () => pending as Promise<never>,
      write: async () => {},
    }
    return { storage, resolveRead, rejectRead }
  }

  it('is restored immediately with no storage prop at all', () => {
    render(<Harness />)
    expect(screen.getByText('restored')).toBeInTheDocument()
  })

  it('is not restored while a storage read is still in flight, and becomes restored once it resolves', async () => {
    const { storage, resolveRead } = controllableStorage()
    render(<Harness storage={storage} />)

    // The read is deliberately left unresolved: this is the race itself, asserted rather than
    // hoped past. A provider that started `restored` true regardless of `storage` would pass
    // this assertion trivially, which is exactly why it has to be checked before the resolve
    // below, not only after.
    expect(screen.getByText('not-restored')).toBeInTheDocument()
    expect(screen.queryByText('restored')).not.toBeInTheDocument()

    await act(async () => {
      resolveRead({ completed: [], dismissed: false })
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(await screen.findByText('restored')).toBeInTheDocument()
  })

  it('becomes restored once a storage read rejects, rather than staying unsettled forever', async () => {
    const { storage, rejectRead } = controllableStorage()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(<Harness storage={storage} />)

    expect(screen.getByText('not-restored')).toBeInTheDocument()

    await act(async () => {
      rejectRead(new Error('storage unavailable'))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(await screen.findByText('restored')).toBeInTheDocument()
    warn.mockRestore()
  })

  // Round 2: settling once for the whole provider, as round 1 did, meant a hung read for one
  // checklist blocked the loop before it ever reached the next, so a perfectly healthy checklist
  // never restored either. This is the test that pins the fix: two checklists, one storage read
  // that never settles and one that does, and the resolving one must restore on its own.
  it('a hanging read for one checklist does not hold another checklist restored forever', async () => {
    const checklistA: Checklist = { id: 'a', items: [{ id: 'x', title: 'X' }] }
    const checklistB: Checklist = { id: 'b', items: [{ id: 'y', title: 'Y' }] }

    let resolveB!: (value: unknown) => void
    const storage: GuideStorage = {
      // 'a' never settles, deliberately: this is the hang, not a slow-but-finite read.
      read: (key: string) =>
        (key === 'checklist:a'
          ? new Promise<never>(() => {})
          : new Promise<unknown>((resolve) => {
              resolveB = resolve
            })) as Promise<never>,
      write: async () => {},
    }

    function TwoChecklistReadout() {
      const a = useChecklist('a')
      const b = useChecklist('b')
      return (
        <div>
          <p>{`a:${a.restored ? 'restored' : 'not-restored'}`}</p>
          <p>{`b:${b.restored ? 'restored' : 'not-restored'}`}</p>
        </div>
      )
    }

    render(
      <ChecklistProvider checklists={[checklistA, checklistB]} storage={storage}>
        <TwoChecklistReadout />
      </ChecklistProvider>,
    )

    expect(screen.getByText('a:not-restored')).toBeInTheDocument()
    expect(screen.getByText('b:not-restored')).toBeInTheDocument()

    await act(async () => {
      resolveB({ completed: [], dismissed: false })
      await Promise.resolve()
      await Promise.resolve()
    })

    // b settled even though a's read never will, and never went through a's rejection path
    // either: this is the concurrency property, not the reject property covered above.
    expect(await screen.findByText('b:restored')).toBeInTheDocument()
    expect(screen.getByText('a:not-restored')).toBeInTheDocument()
  })

  it('ignores a stored value that is not checklist progress', async () => {
    // The fixture below carries no `dismissed` field and a string `completed`, so it only
    // survives if isChecklistProgress is actually applied. A guard that accepted it would
    // read as one item completed (a string's `includes` matches on substring), so waiting
    // for the read to settle and then asserting '0/3' fails loudly if the guard is skipped
    // rather than silently agreeing with the pre-restore DOM.
    const storage = createMemoryStorage({ 'checklist:onboarding': { completed: 'profile' } })
    const read = vi.spyOn(storage, 'read')
    render(<Harness storage={storage} />)
    await waitFor(() => expect(read).toHaveBeenCalledWith('checklist:onboarding'))
    // Flush the restore effect's continuation (the code after the awaited storage.read call)
    // by awaiting the same promise it awaited, inside act so any resulting state update commits.
    await act(async () => {
      await Promise.all(read.mock.results.map((result) => result.value))
    })
    expect(screen.getByText('0/3')).toBeInTheDocument()
    expect(screen.queryByText('1/3')).not.toBeInTheDocument()
  })

  // A memory storage resolves before the user can do anything, so it can never show what a
  // server-backed one does: the list is painted and interactive for as long as the read takes.
  // These two hold the read open across a real user action and release it afterwards.
  function gatedStorage(stored: unknown) {
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const storage: GuideStorage = {
      read: async <T,>(key: string) => {
        await gate
        return (key === 'checklist:onboarding' ? stored : null) as T
      },
      write: async () => {},
    }
    return { storage, release }
  }

  it('keeps a tick made while the storage read was still in flight', async () => {
    const user = userEvent.setup()
    const { storage, release } = gatedStorage({ completed: ['reports'], dismissed: false })
    render(<Harness storage={storage} />)

    // The read has not resolved: this is the launcher painting 0 of 3 and the user acting on it.
    expect(screen.getByText('profile:todo')).toBeInTheDocument()
    await user.click(screen.getByText('toggle-profile'))
    expect(screen.getByText('profile:done')).toBeInTheDocument()

    await act(async () => {
      release()
      await Promise.resolve()
    })

    // The stored item lands, and the tick the user could already see survives it.
    await waitFor(() => expect(screen.getByText('reports:done')).toBeInTheDocument())
    expect(screen.getByText('profile:done')).toBeInTheDocument()
    expect(screen.getByText('2/3')).toBeInTheDocument()
  })

  it('keeps a dismissal made while the storage read was still in flight', async () => {
    const user = userEvent.setup()
    const { storage, release } = gatedStorage({ completed: ['reports'], dismissed: false })
    render(<Harness storage={storage} />)

    await user.click(screen.getByText('dismiss'))
    expect(screen.getByText('dismissed')).toBeInTheDocument()

    await act(async () => {
      release()
      await Promise.resolve()
    })

    // The stored entry says the list is not dismissed, but that value predates the user
    // closing it. Restoring it would put the launcher back on screen after they dismissed it.
    await waitFor(() => expect(screen.getByText('reports:done')).toBeInTheDocument())
    expect(screen.getByText('dismissed')).toBeInTheDocument()
  })

  it('persists a tick', async () => {
    const user = userEvent.setup()
    const storage = createMemoryStorage()
    const write = vi.spyOn(storage, 'write')
    render(<Harness storage={storage} />)
    await user.click(screen.getByText('toggle-profile'))
    await waitFor(() =>
      expect(write).toHaveBeenCalledWith('checklist:onboarding', {
        completed: ['profile'],
        dismissed: false,
      }),
    )
  })

  it('emits item-complete on a tick and not on an untick', async () => {
    const user = userEvent.setup()
    const events: GuideEvent[] = []
    render(<Harness onEvent={(event) => events.push(event)} />)
    await user.click(screen.getByText('toggle-profile'))
    await screen.findByText('profile:done')
    await user.click(screen.getByText('toggle-profile'))
    await screen.findByText('profile:todo')
    const itemCompleteEvents = events.filter((event) => event.type === 'checklist:item-complete')
    expect(itemCompleteEvents).toHaveLength(1)
  })

  it('emits complete once when the last item is ticked', async () => {
    const user = userEvent.setup()
    const events: GuideEvent[] = []
    render(<Harness onEvent={(event) => events.push(event)} />)
    await user.click(screen.getByText('toggle-profile'))
    await user.click(screen.getByText('toggle-reports'))
    await user.click(screen.getByText('toggle-tour'))
    await waitFor(() => expect(screen.getByText('complete')).toBeInTheDocument())
    const completeEvents = events.filter((event) => event.type === 'checklist:complete')
    expect(completeEvents).toHaveLength(1)
  })

  it('completes an item', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByText('complete-profile'))
    expect(await screen.findByText('profile:done')).toBeInTheDocument()
  })

  it('does nothing and emits nothing when completing an already completed item', async () => {
    const user = userEvent.setup()
    const events: GuideEvent[] = []
    render(<Harness onEvent={(event) => events.push(event)} />)
    await user.click(screen.getByText('complete-profile'))
    await screen.findByText('profile:done')
    events.length = 0

    await user.click(screen.getByText('complete-profile'))
    // Nothing should happen on the second click: give a wrongly-async no-op a moment to
    // surface before asserting the events array is still empty.
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByText('profile:done')).toBeInTheDocument()
    expect(events).toHaveLength(0)
  })

  it('emits checklist:complete once when completing the last item', async () => {
    const user = userEvent.setup()
    const events: GuideEvent[] = []
    render(<Harness onEvent={(event) => events.push(event)} />)
    await user.click(screen.getByText('complete-profile'))
    await user.click(screen.getByText('complete-reports'))
    await user.click(screen.getByText('complete-tour'))
    await waitFor(() => expect(screen.getByText('complete')).toBeInTheDocument())
    const completeEvents = events.filter((event) => event.type === 'checklist:complete')
    expect(completeEvents).toHaveLength(1)
  })

  it('dismisses, persists the dismissal and emits', async () => {
    const user = userEvent.setup()
    const storage = createMemoryStorage()
    const events: GuideEvent[] = []
    render(<Harness storage={storage} onEvent={(event) => events.push(event)} />)
    await user.click(screen.getByText('dismiss'))
    expect(await screen.findByText('dismissed')).toBeInTheDocument()
    await waitFor(() =>
      expect(events.map((event) => event.type)).toContain('checklist:dismiss'),
    )
    await waitFor(async () =>
      expect(await storage.read('checklist:onboarding')).toEqual({
        completed: [],
        dismissed: true,
      }),
    )
  })

  it('resets to nothing completed and not dismissed', async () => {
    const user = userEvent.setup()
    const storage = createMemoryStorage({
      'checklist:onboarding': { completed: ['profile', 'reports'], dismissed: true },
    })
    render(<Harness storage={storage} />)
    await screen.findByText('2/3')
    await user.click(screen.getByText('reset'))
    expect(await screen.findByText('0/3')).toBeInTheDocument()
    expect(screen.getByText('not-dismissed')).toBeInTheDocument()
  })

  it('navigates when an item carries an href and no tour', async () => {
    const user = userEvent.setup()
    const navigate = vi.fn()
    render(<Harness navigate={navigate} />)
    await user.click(screen.getByText('activate-reports'))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/reports'))
    expect(screen.getByText('reports:todo')).toBeInTheDocument()
  })

  it('toggles when an item carries neither tour nor href', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByText('activate-profile'))
    expect(await screen.findByText('profile:done')).toBeInTheDocument()
  })

  it('warns and does nothing for an unknown item id', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    function BadActivate() {
      const { activate } = useChecklist('onboarding')
      return <button onClick={() => activate('missing')}>activate-missing</button>
    }
    const user = userEvent.setup()
    render(
      <ChecklistProvider checklists={[checklist]}>
        <ChecklistReadout />
        <BadActivate />
      </ChecklistProvider>,
    )
    await user.click(screen.getByText('activate-missing'))
    expect(warn).toHaveBeenCalled()
    expect(screen.getByText('0/3')).toBeInTheDocument()
    warn.mockRestore()
  })

  it('throws for an unknown checklist id', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() =>
      render(
        <ChecklistProvider checklists={[checklist]}>
          <UnknownChecklistReader />
        </ChecklistProvider>,
      ),
    ).toThrow(/unknown checklist/)
    spy.mockRestore()
  })

  it('starts a tour when an item carries a tourId', async () => {
    const user = userEvent.setup()
    function StepReadout() {
      const active = useGuideStep()
      return <p>{active ? active.title : 'no step'}</p>
    }
    render(
      <GuideProvider tours={[demoTour]}>
        <button data-guide="one">one</button>
        <ChecklistProvider checklists={[checklist]}>
          <ChecklistReadout />
        </ChecklistProvider>
        <StepReadout />
      </GuideProvider>,
    )
    await user.click(screen.getByText('activate-tour'))
    expect(await screen.findByText('First')).toBeInTheDocument()
  })

  it('warns once when a tour item is activated without a GuideProvider', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByText('activate-tour'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('GuideProvider'))
    expect(screen.getByText('tour:todo')).toBeInTheDocument()
    warn.mockRestore()
  })

  it('warns once when an href item is activated without a navigate function', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByText('activate-reports'))
    await user.click(screen.getByText('activate-reports'))
    const navigateWarnings = warn.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes('navigate function'),
    )
    expect(navigateWarnings).toHaveLength(1)
    expect(screen.getByText('reports:todo')).toBeInTheDocument()
    warn.mockRestore()
  })

  it('warns and does not reject when an item names a tour the provider does not hold', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const user = userEvent.setup()
    const unhandled: unknown[] = []
    const onUnhandledRejection = (reason: unknown) => {
      unhandled.push(reason)
    }
    // process.on/off are not in this package's TS lib shape (no @types/node dependency),
    // but the real Node process object is present at test runtime.
    const nodeProcess = process as unknown as {
      on: (event: 'unhandledRejection', listener: (reason: unknown) => void) => void
      off: (event: 'unhandledRejection', listener: (reason: unknown) => void) => void
    }
    nodeProcess.on('unhandledRejection', onUnhandledRejection)

    const brokenChecklist: Checklist = {
      id: 'onboarding',
      items: [{ id: 'tour', title: 'Take the tour', tourId: 'missing' }],
    }

    render(
      <GuideProvider tours={[demoTour]}>
        <button data-guide="one">one</button>
        <ChecklistProvider checklists={[brokenChecklist]}>
          <ChecklistReadout />
        </ChecklistProvider>
      </GuideProvider>,
    )
    await user.click(screen.getByText('activate-tour'))
    await waitFor(() =>
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('[guide]'),
        expect.objectContaining({ message: expect.stringContaining('missing') }),
      ),
    )

    // Give a real unhandled rejection several ticks to surface: Node reports it only after
    // the microtask queue that could still attach a handler has drained.
    for (let tick = 0; tick < 5; tick += 1) {
      await act(async () => {
        await Promise.resolve()
      })
    }

    nodeProcess.off('unhandledRejection', onUnhandledRejection)
    expect(unhandled).toHaveLength(0)
    warn.mockRestore()
  })

  describe('completion by tour', () => {
    const twoStepTour: Tour = {
      id: 'demo',
      steps: [
        { target: 'one', title: 'First' },
        { target: 'two', title: 'Second' },
      ],
    }

    const otherChecklist: Checklist = {
      id: 'other',
      items: [{ id: 'unrelated', title: 'Not linked to a tour' }],
    }

    function StepReadout() {
      const active = useGuideStep()
      if (!active) return <p>no step</p>
      return (
        <div>
          <p>{active.title}</p>
          <button onClick={active.next}>next</button>
        </div>
      )
    }

    function OtherChecklistReadout() {
      const { items } = useChecklist('other')
      return (
        <div>
          {items.map((item) => (
            <p key={item.id}>{`${item.id}:${item.completed ? 'done' : 'todo'}`}</p>
          ))}
        </div>
      )
    }

    function TourHarness({
      checklists = [checklist],
      onEvent,
    }: {
      checklists?: Checklist[]
      onEvent?: (event: GuideEvent) => void
    }) {
      return (
        <GuideProvider tours={[twoStepTour]}>
          <button data-guide="one">one</button>
          <button data-guide="two">two</button>
          <ChecklistProvider checklists={checklists} onEvent={onEvent}>
            <ChecklistReadout />
            {checklists.some((entry) => entry.id === 'other') && <OtherChecklistReadout />}
          </ChecklistProvider>
          <StepReadout />
        </GuideProvider>
      )
    }

    it('ticks the item whose tour completes', async () => {
      const user = userEvent.setup()
      render(<TourHarness />)
      await user.click(screen.getByText('activate-tour'))
      await screen.findByText('First')
      await user.click(screen.getByText('next'))
      await screen.findByText('Second')
      await user.click(screen.getByText('next'))
      expect(await screen.findByText('tour:done')).toBeInTheDocument()
    })

    it('ticks it once even when the provider re renders', async () => {
      const user = userEvent.setup()
      const events: GuideEvent[] = []
      render(<TourHarness onEvent={(event) => events.push(event)} />)
      await user.click(screen.getByText('activate-tour'))
      await screen.findByText('First')
      await user.click(screen.getByText('next'))
      await screen.findByText('Second')
      await user.click(screen.getByText('next'))
      await screen.findByText('tour:done')

      // A completed tour keeps re-rendering (focus restoration, step readouts, and so on).
      // Give any such extra render a moment to run the watcher effect again.
      await act(async () => {
        await Promise.resolve()
      })

      const itemCompleteEvents = events.filter(
        (event) => event.type === 'checklist:item-complete' && event.itemId === 'tour',
      )
      expect(itemCompleteEvents).toHaveLength(1)
    })

    it('leaves other items alone when an unrelated tour completes', async () => {
      const user = userEvent.setup()
      render(<TourHarness checklists={[checklist, otherChecklist]} />)
      await user.click(screen.getByText('activate-tour'))
      await screen.findByText('First')
      await user.click(screen.getByText('next'))
      await screen.findByText('Second')
      await user.click(screen.getByText('next'))
      await screen.findByText('tour:done')
      expect(screen.getByText('unrelated:todo')).toBeInTheDocument()
    })

    it('does not re tick an item that was already completed', async () => {
      const user = userEvent.setup()
      const storage = createMemoryStorage({
        'checklist:onboarding': { completed: ['tour'], dismissed: false },
      })
      const events: GuideEvent[] = []
      render(
        <GuideProvider tours={[twoStepTour]}>
          <button data-guide="one">one</button>
          <button data-guide="two">two</button>
          <ChecklistProvider
            checklists={[checklist]}
            storage={storage}
            onEvent={(event) => events.push(event)}
          >
            <ChecklistReadout />
          </ChecklistProvider>
          <StepReadout />
        </GuideProvider>,
      )
      await screen.findByText('tour:done')

      // Running the same tour again must not re-tick an item that storage already marks
      // completed.
      await user.click(screen.getByText('activate-tour'))
      await screen.findByText('First')
      await user.click(screen.getByText('next'))
      await screen.findByText('Second')
      await user.click(screen.getByText('next'))

      await act(async () => {
        await Promise.resolve()
      })

      const itemCompleteEvents = events.filter((event) => event.type === 'checklist:item-complete')
      expect(itemCompleteEvents).toHaveLength(0)
    })

    const sameTourChecklist: Checklist = {
      id: 'both',
      items: [
        { id: 'a', title: 'First half', tourId: 'demo' },
        { id: 'b', title: 'Second half', tourId: 'demo' },
      ],
    }

    function SameTourReadout() {
      const { items } = useChecklist('both')
      return (
        <div>
          {items.map((item) => (
            <p key={item.id}>{`${item.id}:${item.completed ? 'done' : 'todo'}`}</p>
          ))}
        </div>
      )
    }

    function Starter() {
      const { start } = useTour('demo')
      return <button onClick={() => void start()}>start</button>
    }

    it('ticks every item sharing a tourId when it completes', async () => {
      const user = userEvent.setup()
      const events: GuideEvent[] = []
      render(
        <GuideProvider tours={[twoStepTour]}>
          <button data-guide="one">one</button>
          <button data-guide="two">two</button>
          <ChecklistProvider
            checklists={[sameTourChecklist]}
            onEvent={(event) => events.push(event)}
          >
            <SameTourReadout />
          </ChecklistProvider>
          <Starter />
          <StepReadout />
        </GuideProvider>,
      )
      await user.click(screen.getByText('start'))
      await screen.findByText('First')
      await user.click(screen.getByText('next'))
      await screen.findByText('Second')
      await user.click(screen.getByText('next'))

      expect(await screen.findByText('a:done')).toBeInTheDocument()
      expect(screen.getByText('b:done')).toBeInTheDocument()

      const itemCompleteEvents = events.filter((event) => event.type === 'checklist:item-complete')
      expect(itemCompleteEvents).toHaveLength(2)
    })
  })
})
