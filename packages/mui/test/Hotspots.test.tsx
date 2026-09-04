import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import {
  GuideProvider,
  HotspotProvider,
  createMemoryStorage,
} from '@apollovisionlabs/guide-core'
import type { Hotspot, Tour } from '@apollovisionlabs/guide-core'
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
