import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { GuideProvider } from '../src/GuideProvider'
import { useTour } from '../src/useTour'
import { useGuideStep } from '../src/useGuideStep'
import { createMemoryStorage } from '../src/storage'
import type { GuideEvent, GuideStorage, Tour } from '../src/types'

const tour: Tour = {
  id: 'demo',
  steps: [
    { target: 'one', title: 'First' },
    { target: 'two', title: 'Second' },
  ],
}

function StepReadout() {
  const active = useGuideStep()
  if (!active) return <p>no step</p>
  return (
    <div>
      <p>{active.title}</p>
      <p>{`${active.stepIndex + 1}/${active.stepCount}`}</p>
      <button onClick={active.next}>next</button>
      <button onClick={active.stop}>stop</button>
    </div>
  )
}

function Starter() {
  const { start, status } = useTour('demo')
  return (
    <>
      <button onClick={() => void start()}>start</button>
      <span>{status}</span>
    </>
  )
}

function Harness(props: Partial<ComponentProps<typeof GuideProvider>> = {}) {
  return (
    <GuideProvider tours={[tour]} {...props}>
      <button data-guide="one">one</button>
      <button data-guide="two">two</button>
      <Starter />
      <StepReadout />
    </GuideProvider>
  )
}

describe('GuideProvider', () => {
  it('shows no step before the tour starts', () => {
    render(<Harness />)
    expect(screen.getByText('no step')).toBeInTheDocument()
  })

  it('starts the tour and exposes the first step', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByText('start'))
    expect(await screen.findByText('First')).toBeInTheDocument()
    expect(screen.getByText('1/2')).toBeInTheDocument()
  })

  it('moves forward then completes the tour', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByText('start'))
    await screen.findByText('First')
    await user.click(screen.getByText('next'))
    expect(await screen.findByText('Second')).toBeInTheDocument()
    await user.click(screen.getByText('next'))
    await waitFor(() => expect(screen.getByText('completed')).toBeInTheDocument())
  })

  it('resolves the target element and its rectangle', async () => {
    const user = userEvent.setup()
    function RectReadout() {
      const active = useGuideStep()
      return <span data-testid="resolved">{active?.element?.textContent ?? 'none'}</span>
    }
    render(
      <GuideProvider tours={[tour]}>
        <button data-guide="one">one</button>
        <Starter />
        <RectReadout />
      </GuideProvider>,
    )
    await user.click(screen.getByText('start'))
    await waitFor(() => expect(screen.getByTestId('resolved')).toHaveTextContent('one'))
  })

  it('emits the lifecycle events', async () => {
    const user = userEvent.setup()
    const events: GuideEvent[] = []
    render(<Harness onEvent={(event) => events.push(event)} />)
    await user.click(screen.getByText('start'))
    await screen.findByText('First')
    await user.click(screen.getByText('next'))
    await screen.findByText('Second')
    await user.click(screen.getByText('next'))

    await waitFor(() =>
      expect(events.map((event) => event.type)).toEqual(
        expect.arrayContaining(['tour:start', 'step:show', 'tour:complete']),
      ),
    )
  })

  it('resumes at the persisted step', async () => {
    const user = userEvent.setup()
    const storage = createMemoryStorage({ 'tour:demo': { status: 'in-progress', stepIndex: 1 } })
    render(<Harness storage={storage} />)
    await user.click(screen.getByText('start'))
    expect(await screen.findByText('Second')).toBeInTheDocument()
  })

  it('writes the progress to storage', async () => {
    const user = userEvent.setup()
    const storage = createMemoryStorage()
    render(<Harness storage={storage} />)
    await user.click(screen.getByText('start'))
    await screen.findByText('First')
    await waitFor(async () =>
      expect(await storage.read('tour:demo')).toEqual({ status: 'in-progress', stepIndex: 0 }),
    )
  })

  it('writes tour progress under a namespaced key', async () => {
    const user = userEvent.setup()
    const storage = createMemoryStorage()
    const write = vi.spyOn(storage, 'write')
    render(<Harness storage={storage} />)
    await user.click(screen.getByText('start'))
    await waitFor(() => expect(write).toHaveBeenCalledWith('tour:demo', expect.anything()))
  })

  it('ignores a stored value that is not tour progress', async () => {
    const user = userEvent.setup()
    const storage = createMemoryStorage()
    // A shape the old ad-hoc check would have accepted: the status is right and
    // only stepIndex is wrong, so this fails without isTourProgress.
    await storage.write('tour:demo', { status: 'in-progress', stepIndex: 'not-a-number' })
    render(<Harness storage={storage} />)
    await user.click(screen.getByText('start'))
    // A corrupted value must not be trusted: the tour starts at the first step.
    expect(await screen.findByText('First')).toBeInTheDocument()
    expect(screen.getByText('1/2')).toBeInTheDocument()
  })

  it('translates the text keys', async () => {
    const user = userEvent.setup()
    const translated: Tour = { id: 'demo', steps: [{ target: 'one', titleKey: 'a.title' }] }
    render(
      <GuideProvider tours={[translated]} translate={(key) => `translated:${key}`}>
        <button data-guide="one">one</button>
        <Starter />
        <StepReadout />
      </GuideProvider>,
    )
    await user.click(screen.getByText('start'))
    expect(await screen.findByText('translated:a.title')).toBeInTheDocument()
  })

  it('navigates when the step lives on another route', async () => {
    const user = userEvent.setup()
    const navigate = vi.fn()
    const routed: Tour = { id: 'demo', steps: [{ target: 'one', route: '/other' }] }
    render(
      <GuideProvider tours={[routed]} location="/" navigate={navigate}>
        <Starter />
        <StepReadout />
      </GuideProvider>,
    )
    await user.click(screen.getByText('start'))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/other'))
  })

  it('uses navigateTo when the route has a parameter', async () => {
    const user = userEvent.setup()
    const navigate = vi.fn()
    const routed: Tour = {
      id: 'demo',
      steps: [{ target: 'one', route: '/item/:id', navigateTo: '/item/42' }],
    }
    render(
      <GuideProvider tours={[routed]} location="/" navigate={navigate}>
        <Starter />
        <StepReadout />
      </GuideProvider>,
    )
    await user.click(screen.getByText('start'))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/item/42'))
  })

  it('skips the step when the target is missing and the policy is skip', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const partial: Tour = {
      id: 'demo',
      steps: [
        { target: 'absent', title: 'First' },
        { target: 'two', title: 'Second' },
      ],
    }
    render(
      <GuideProvider tours={[partial]} onMissingTarget="skip" targetTimeoutMs={500}>
        <button data-guide="two">two</button>
        <Starter />
        <StepReadout />
      </GuideProvider>,
    )
    await user.click(screen.getByText('start'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800)
    })
    expect(await screen.findByText('Second')).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('warns in development when a target expected on the current page is missing', async () => {
    const user = userEvent.setup()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const partial: Tour = {
      id: 'demo',
      steps: [
        { target: 'one', route: '/', title: 'First' },
        { target: 'absent', route: '/', title: 'Second' },
      ],
    }
    render(
      <GuideProvider tours={[partial]} location="/">
        <button data-guide="one">one</button>
        <Starter />
        <StepReadout />
      </GuideProvider>,
    )
    await user.click(screen.getByText('start'))
    await waitFor(() =>
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('absent')),
    )
    warn.mockRestore()
  })

  it('rejects two tours sharing the same id', () => {
    const duplicate: Tour = { id: 'demo', steps: [] }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() =>
      render(
        <GuideProvider tours={[tour, duplicate]}>
          <span />
        </GuideProvider>,
      ),
    ).toThrow(/duplicate tour id/)
    spy.mockRestore()
  })

  it('resumes after the timeout when the target eventually appears (wait policy)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const late: Tour = { id: 'demo', steps: [{ target: 'late', title: 'First' }] }

    render(
      <GuideProvider tours={[late]} targetTimeoutMs={500}>
        <Starter />
        <StepReadout />
      </GuideProvider>,
    )

    await user.click(screen.getByText('start'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800)
    })
    expect(await screen.findByText('paused')).toBeInTheDocument()

    const host = document.createElement('div')
    document.body.appendChild(host)
    host.innerHTML = '<button data-guide="late">late</button>'

    await waitFor(() => expect(screen.getByText('running')).toBeInTheDocument())
    vi.useRealTimers()
  })

  it('ignores a second start of the tour already running', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByText('start'))
    await screen.findByText('First')
    await user.click(screen.getByText('next'))
    await screen.findByText('Second')
    await user.click(screen.getByText('start'))
    expect(screen.getByText('Second')).toBeInTheDocument()
  })

  it('navigates only once when the location does not change between renders', async () => {
    const user = userEvent.setup()
    const navigate = vi.fn()
    const routed: Tour = { id: 'demo', steps: [{ target: 'one', route: '/other' }] }

    function Wrapper({ tick }: { tick: number }) {
      // navigate is recreated on every render, as an inline arrow function would be.
      const inlineNavigate = (path: string) => navigate(path)
      return (
        <GuideProvider tours={[routed]} location="/" navigate={inlineNavigate}>
          <Starter />
          <StepReadout />
          <span>{tick}</span>
        </GuideProvider>
      )
    }

    const { rerender } = render(<Wrapper tick={0} />)
    await user.click(screen.getByText('start'))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/other'))

    rerender(<Wrapper tick={1} />)
    rerender(<Wrapper tick={2} />)

    expect(navigate).toHaveBeenCalledTimes(1)
  })

  it('applies the policy when a step route never matches', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    // The route pattern matches nothing and navigate moves nothing: without an armed timer the
    // tour would stay running, invisible and with no way out.
    const unreachable: Tour = {
      id: 'demo',
      steps: [
        { target: 'one', route: '/never', title: 'First' },
        { target: 'two', title: 'Second' },
      ],
    }
    render(
      <GuideProvider
        tours={[unreachable]}
        location="/"
        navigate={() => {}}
        onMissingTarget="skip"
        targetTimeoutMs={500}
      >
        <button data-guide="two">two</button>
        <Starter />
        <StepReadout />
      </GuideProvider>,
    )
    await user.click(screen.getByText('start'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800)
    })
    expect(await screen.findByText('Second')).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('stops the tour when the route never matches and the policy is error', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const unreachable: Tour = {
      id: 'demo',
      steps: [{ target: 'one', route: '/never', title: 'First' }],
    }
    render(
      <GuideProvider
        tours={[unreachable]}
        location="/"
        navigate={() => {}}
        onMissingTarget="error"
        targetTimeoutMs={500}
      >
        <Starter />
        <StepReadout />
      </GuideProvider>,
    )
    await user.click(screen.getByText('start'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800)
    })
    expect(await screen.findByText('no step')).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('navigates again when the same tour is restarted on the same step', async () => {
    const user = userEvent.setup()
    const navigate = vi.fn()
    const routed: Tour = { id: 'demo', steps: [{ target: 'one', route: '/other' }] }
    render(
      <GuideProvider tours={[routed]} location="/" navigate={navigate}>
        <Starter />
        <StepReadout />
      </GuideProvider>,
    )
    await user.click(screen.getByText('start'))
    await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1))

    await user.click(screen.getByText('stop'))
    await user.click(screen.getByText('start'))
    await waitFor(() => expect(navigate).toHaveBeenCalledTimes(2))
  })

  it('restores focus to the element that started the tour', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const origin = screen.getByText('start')
    await user.click(origin)
    await screen.findByText('First')

    // The popover would move focus, so we simulate that move and then stop the tour.
    const elsewhere = screen.getByText('one')
    act(() => elsewhere.focus())
    expect(elsewhere).toHaveFocus()

    await user.click(screen.getByText('stop'))
    await waitFor(() => expect(origin).toHaveFocus())
  })

  it('starts anyway when storage fails on read', async () => {
    const user = userEvent.setup()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const failing: GuideStorage = {
      read: () => Promise.reject(new Error('offline')),
      write: () => Promise.reject(new Error('offline')),
    }
    render(<Harness storage={failing} />)
    await user.click(screen.getByText('start'))
    expect(await screen.findByText('First')).toBeInTheDocument()
    await waitFor(() =>
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('[guide]'), expect.anything()),
    )
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })

  it('refuses to start a tour with no steps', async () => {
    const user = userEvent.setup()
    const empty: Tour = { id: 'empty', steps: [] }
    let failure: unknown = null
    function EmptyStarter() {
      const { start } = useTour('empty')
      return (
        <button
          onClick={() => {
            start().catch((error: unknown) => {
              failure = error
            })
          }}
        >
          start
        </button>
      )
    }
    render(
      <GuideProvider tours={[empty]}>
        <EmptyStarter />
      </GuideProvider>,
    )
    await user.click(screen.getByText('start'))
    await waitFor(() => expect(failure).toBeInstanceOf(Error))
    expect((failure as Error).message).toMatch(/\[guide\] tour has no steps/)
  })
})
