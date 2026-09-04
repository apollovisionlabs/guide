import { useState, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import {
  GuideProvider,
  HotspotProvider,
  createMemoryStorage,
  useTour,
} from '@apollovisionlabs/guide-core'
import type { GuideEvent, GuideStorage, Hotspot, Tour } from '@apollovisionlabs/guide-core'
import { GuideTour } from '../src/GuideTour'
import { Hotspots } from '../src/Hotspots'

function createControllableStorage() {
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

function TourStarter({ tourId }: { tourId: string }) {
  const { start, status } = useTour(tourId)
  return (
    <>
      <button onClick={() => void start()}>start tour</button>
      <span data-testid="tour-status">{status}</span>
    </>
  )
}

/**
 * The collision the whole-branch review found in the shipped demo: one element is both the
 * target of a tour step that advances on a click and the target of a hotspot. The marker is
 * `position: fixed` over the target's top-right corner, so in a browser
 * `document.elementFromPoint` at the marker's centre returns the marker, not the target.
 */
const collisionTour: Tour = {
  id: 'demo',
  steps: [
    {
      target: 'filters',
      title: 'Click it',
      body: 'This step waits for a click on the real element.',
      advanceOn: 'click',
    },
  ],
}

const collisionHotspots: Hotspot[] = [
  { id: 'filters', target: 'filters', title: 'Filters', body: 'Narrow the list.', tourId: 'demo' },
]

function Collision({
  onTourEvent,
  onHotspotEvent,
  tours = [collisionTour],
  ...rest
}: {
  onTourEvent?: (event: GuideEvent) => void
  onHotspotEvent?: (event: GuideEvent) => void
  tours?: Tour[]
} & Record<string, unknown>) {
  return (
    <ThemeProvider theme={testTheme}>
      <GuideProvider tours={tours} onEvent={onTourEvent} {...rest}>
        <HotspotProvider hotspots={collisionHotspots} onEvent={onHotspotEvent}>
          <button data-guide="filters">filters</button>
          <TourStarter tourId="demo" />
          <Hotspots />
          <GuideTour />
        </HotspotProvider>
      </GuideProvider>
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

  it('draws no marker and emits no hotspot:show for a target that is present but not rendered', async () => {
    const onEvent = vi.fn()
    render(
      <ThemeProvider theme={testTheme}>
        <HotspotProvider hotspots={hotspots} onEvent={onEvent}>
          <button data-guide="filters" style={{ display: 'none' }}>
            filters
          </button>
          <Hotspots />
        </HotspotProvider>
      </ThemeProvider>,
    )

    // The element is in the DOM, so useTargetElement finds it and useElementRect measures it:
    // an all-zero rect, which is truthy. Drawing on that puts a pulsing dot in the top-left
    // corner of the viewport pointing at nothing, announces an impression for a marker nobody
    // saw, and lets a click retire the hotspot before the user ever met the element it
    // explains.
    await act(async () => {
      await Promise.resolve()
    })
    expect(
      screen.queryByRole('button', { name: /Show what is new/ }),
    ).not.toBeInTheDocument()
    expect(onEvent).not.toHaveBeenCalledWith({ type: 'hotspot:show', hotspotId: 'filters' })
  })

  it('draws the marker again once the target is rendered', async () => {
    function Toggling() {
      const [hidden, setHidden] = useState(true)
      return (
        <ThemeProvider theme={testTheme}>
          <HotspotProvider hotspots={hotspots}>
            <button data-guide="filters" style={hidden ? { display: 'none' } : undefined}>
              filters
            </button>
            <button onClick={() => setHidden(false)}>reveal</button>
            <Hotspots />
          </HotspotProvider>
        </ThemeProvider>
      )
    }
    const user = userEvent.setup()
    render(<Toggling />)
    expect(
      screen.queryByRole('button', { name: /Show what is new/ }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByText('reveal'))
    // In a browser the element gaining a box is itself what re-measures it, through the
    // ResizeObserver useElementRect attaches. jsdom's ResizeObserver is a stub that never
    // fires, so the re-measure is triggered here through the other listener the same hook
    // installs. What is under test is the gate re-opening once the rect has size, not which
    // event carried the news.
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })
    expect(
      await screen.findByRole('button', { name: 'Show what is new: Filters' }),
    ).toBeInTheDocument()
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

  it('emits hotspot:open once, and a second click on the marker closes its bubble', async () => {
    const user = userEvent.setup()
    const onEvent = vi.fn()
    render(<Page onEvent={onEvent} />)
    const marker = await screen.findByRole('button', { name: /Filters/ })

    await user.click(marker)
    await screen.findByRole('dialog', { name: 'Filters' })
    expect(
      onEvent.mock.calls.filter(([event]) => event.type === 'hotspot:open'),
    ).toHaveLength(1)

    // The marker stays clickable while its own bubble is open, and the bubble is anchored to
    // it, so a second click is easy to make by accident. Announcing another opening for a
    // bubble already on screen counts clicks rather than openings, and over-counts any funnel
    // built on onEvent; the sibling event hotspot:show is deduplicated for exactly this reason.
    await user.click(marker)
    expect(
      onEvent.mock.calls.filter(([event]) => event.type === 'hotspot:open'),
    ).toHaveLength(1)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(marker).toHaveAttribute('aria-expanded', 'false')
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
    expect(document.activeElement).toBe(marker)
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

  it('closing on an outside click that lands nowhere focusable returns focus to the marker', async () => {
    const user = userEvent.setup()
    render(
      <Page>
        <div data-testid="empty-area">nothing focusable here</div>
      </Page>,
    )
    const marker = await screen.findByRole('button', { name: /Filters/ })
    await user.click(marker)
    await screen.findByRole('dialog', { name: 'Filters' })

    await user.click(screen.getByTestId('empty-area'))

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    // A plain div cannot itself hold focus, so without an explicit recovery the browser's
    // own blur-on-mousedown-outside would strand focus on document.body.
    await waitFor(() => expect(document.activeElement).toBe(marker))
  })

  it('closing on an outside click that lands on a real control leaves focus there', async () => {
    const user = userEvent.setup()
    render(
      <Page>
        <button type="button">elsewhere</button>
      </Page>,
    )
    const marker = await screen.findByRole('button', { name: /Filters/ })
    await user.click(marker)
    await screen.findByRole('dialog', { name: 'Filters' })

    const elsewhere = screen.getByRole('button', { name: 'elsewhere' })
    await user.click(elsewhere)

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    // The click landed on a real control, which already claimed focus. Pulling focus back to
    // the marker here would be focus theft: the user deliberately clicked somewhere else and
    // must keep the focus they put there.
    await waitFor(() => expect(document.activeElement).toBe(elsewhere))
    expect(document.activeElement).not.toBe(marker)
  })

  it('renders no marker and emits no hotspot:show while a hotspot already seen is still restoring', async () => {
    const onEvent = vi.fn()
    const { storage, resolveRead } = createControllableStorage()

    render(<Page storage={storage} onEvent={onEvent} />)

    // The read is deliberately never resolved yet: this is the race itself, asserted rather
    // than hoped past. Before the restore lands, the hotspot is indistinguishable from a
    // genuinely unseen one, and drawing the marker or announcing it here would be exactly the
    // spurious flash and spurious event this fix exists to prevent.
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(
      screen.queryByRole('button', { name: /Show what is new/ }),
    ).not.toBeInTheDocument()
    expect(onEvent).not.toHaveBeenCalledWith({ type: 'hotspot:show', hotspotId: 'filters' })

    // Now the read settles: the hotspot was already seen all along.
    await act(async () => {
      resolveRead({ seen: ['filters'] })
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(
      screen.queryByRole('button', { name: /Show what is new/ }),
    ).not.toBeInTheDocument()
    expect(onEvent).not.toHaveBeenCalledWith({ type: 'hotspot:show', hotspotId: 'filters' })
  })

  it('renders the marker and emits hotspot:show immediately with no storage at all', async () => {
    const onEvent = vi.fn()
    render(<Page onEvent={onEvent} />)

    // No storage means nothing to wait for: this must not block on a restore that was never
    // going to happen.
    expect(
      await screen.findByRole('button', { name: 'Show what is new: Filters' }),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(onEvent).toHaveBeenCalledWith({ type: 'hotspot:show', hotspotId: 'filters' }),
    )
  })

  it('renders the marker once a storage read rejects, rather than hiding it forever', async () => {
    const { storage, rejectRead } = createControllableStorage()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    render(<Page storage={storage} />)

    await act(async () => {
      rejectRead(new Error('storage unavailable'))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(
      await screen.findByRole('button', { name: 'Show what is new: Filters' }),
    ).toBeInTheDocument()
    warn.mockRestore()
  })

  it('describes the bubble through aria-describedby, distinct from its accessible name', async () => {
    const user = userEvent.setup()
    render(<Page />)
    await user.click(await screen.findByRole('button', { name: /Filters/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Filters' })
    expect(dialog).toHaveAccessibleDescription('Narrow the list.')
  })

  it('starts the named tour from the bubble', async () => {
    const user = userEvent.setup()
    const onEvent = vi.fn()
    const tour: Tour = {
      id: 'demo',
      steps: [{ target: 'filters', title: 'First', body: 'Body one' }],
    }
    const tourHotspots: Hotspot[] = [
      { id: 'filters', target: 'filters', title: 'Filters', body: 'Narrow the list.', tourId: 'demo' },
    ]

    render(
      <ThemeProvider theme={testTheme}>
        <GuideProvider tours={[tour]} onEvent={onEvent}>
          <HotspotProvider hotspots={tourHotspots}>
            <button data-guide="filters">filters</button>
            <Hotspots />
          </HotspotProvider>
        </GuideProvider>
      </ThemeProvider>,
    )

    await user.click(await screen.findByRole('button', { name: /Filters/ }))
    await screen.findByRole('dialog', { name: 'Filters' })
    await user.click(screen.getByRole('button', { name: 'Show me' }))

    await waitFor(() =>
      expect(onEvent).toHaveBeenCalledWith({ type: 'tour:start', tourId: 'demo', stepIndex: 0 }),
    )
  })
})

describe('Hotspots against a running tour', () => {
  it('draws no marker over the element a running tour points at, so the tour keeps the click', async () => {
    const user = userEvent.setup()
    const onTourEvent = vi.fn()
    const onHotspotEvent = vi.fn()
    render(<Collision onTourEvent={onTourEvent} onHotspotEvent={onHotspotEvent} />)

    // Before the tour, the ambient hint is exactly where it belongs.
    expect(
      await screen.findByRole('button', { name: 'Show what is new: Filters' }),
    ).toBeInTheDocument()

    await user.click(screen.getByText('start tour'))
    await screen.findByRole('dialog', { name: 'Click it' })

    // The marker sits on the step's own target. While the tour owns the screen it must not.
    expect(
      screen.queryByRole('button', { name: /Show what is new/ }),
    ).not.toBeInTheDocument()

    // And the click the step is waiting for reaches the step rather than the bubble.
    await user.click(screen.getByRole('button', { name: 'filters' }))
    await waitFor(() =>
      expect(onTourEvent).toHaveBeenCalledWith({ type: 'tour:complete', tourId: 'demo' }),
    )
    expect(onHotspotEvent).not.toHaveBeenCalledWith({
      type: 'hotspot:open',
      hotspotId: 'filters',
    })
  })

  it('draws no marker while the tour is paused waiting for a target', async () => {
    const user = userEvent.setup()
    const pausingTour: Tour = {
      id: 'demo',
      steps: [{ target: 'nowhere', title: 'Waiting', body: 'The target is not here.' }],
    }
    render(<Collision tours={[pausingTour]} targetTimeoutMs={10} />)

    expect(
      await screen.findByRole('button', { name: 'Show what is new: Filters' }),
    ).toBeInTheDocument()

    await user.click(screen.getByText('start tour'))
    await waitFor(() =>
      expect(screen.getByTestId('tour-status')).toHaveTextContent('paused'),
    )

    // A paused tour still owns the screen: it is waiting, not finished.
    expect(
      screen.queryByRole('button', { name: /Show what is new/ }),
    ).not.toBeInTheDocument()
  })

  it('leaves focus on a real element after a tour started from the bubble ends', async () => {
    const user = userEvent.setup()
    render(<Collision />)

    await user.click(await screen.findByRole('button', { name: /Show what is new: Filters/ }))
    await screen.findByRole('dialog', { name: 'Filters' })
    await user.click(screen.getByRole('button', { name: 'Show me' }))
    await screen.findByRole('dialog', { name: 'Click it' })

    await user.keyboard('{Escape}')
    await waitFor(() =>
      expect(screen.getByTestId('tour-status')).toHaveTextContent('idle'),
    )

    // Both restore targets are detached by now: GuideProvider captured the "Show me" button,
    // the bubble's focus trap captured the marker, and the tour unmounted both. Landing on
    // document.body means no focus ring, nothing announced, and the next Tab restarting at the
    // top of the page.
    await waitFor(() => expect(document.activeElement).not.toBe(document.body))
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'filters' }))
  })

  it('brings the markers back once the tour is over', async () => {
    const user = userEvent.setup()
    render(<Collision />)

    await user.click(screen.getByText('start tour'))
    await screen.findByRole('dialog', { name: 'Click it' })
    expect(
      screen.queryByRole('button', { name: /Show what is new/ }),
    ).not.toBeInTheDocument()

    await user.keyboard('{Escape}')
    await waitFor(() =>
      expect(screen.getByTestId('tour-status')).toHaveTextContent('idle'),
    )

    // Suppression during a tour is deference, not retirement: the hotspot was never opened,
    // so it still has something to say.
    expect(
      await screen.findByRole('button', { name: 'Show what is new: Filters' }),
    ).toBeInTheDocument()
  })

  it('still works with no GuideProvider anywhere in the tree', async () => {
    render(<Page />)
    expect(
      await screen.findByRole('button', { name: 'Show what is new: Filters' }),
    ).toBeInTheDocument()
  })
})
