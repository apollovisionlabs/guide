import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import {
  GuideProvider,
  HotspotProvider,
  createMemoryStorage,
} from '@apollovisionlabs/guide-core'
import type { GuideStorage, Hotspot, Tour } from '@apollovisionlabs/guide-core'
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
