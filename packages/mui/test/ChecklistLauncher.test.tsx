import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import {
  ChecklistProvider,
  type Checklist as ChecklistDefinition,
  type GuideStorage,
} from '@apollovisionlabs/guide-core'
import { ChecklistLauncher } from '../src/ChecklistLauncher'

// The ButtonBase ripple triggers asynchronous updates that jsdom reports as an act() warning.
// It is disabled for the tests only; the production rendering keeps the MUI default behaviour.
const testTheme = createTheme({
  components: { MuiButtonBase: { defaultProps: { disableRipple: true } } },
})

const checklist: ChecklistDefinition = {
  id: 'demo',
  items: [
    { id: 'one', title: 'First' },
    { id: 'two', title: 'Second' },
    { id: 'three', title: 'Third' },
  ],
}

const activationChecklist: ChecklistDefinition = {
  id: 'demo',
  items: [
    { id: 'plain', title: 'Plain item' },
    { id: 'tour', title: 'Tour item', tourId: 'product' },
    { id: 'link', title: 'Link item', href: '/somewhere' },
  ],
}

function storageWithCompleted(itemIds: string[], dismissed = false): GuideStorage {
  return {
    read: async <T,>(key: string) => {
      if (key === 'checklist:demo') return { completed: itemIds, dismissed } as T
      return null
    },
    write: async () => {},
  }
}

function renderLauncher(
  ui: ReactElement,
  options: {
    storage?: GuideStorage
    checklists?: ChecklistDefinition[]
    navigate?: (path: string) => void
  } = {},
) {
  return render(
    <ThemeProvider theme={testTheme}>
      <ChecklistProvider
        checklists={options.checklists ?? [checklist]}
        storage={options.storage}
        navigate={options.navigate}
      >
        {ui}
      </ChecklistProvider>
    </ThemeProvider>,
  )
}

describe('ChecklistLauncher', () => {
  it('labels itself with the progress in words', async () => {
    renderLauncher(<ChecklistLauncher checklistId="demo" />, {
      storage: storageWithCompleted(['one']),
    })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /1 of 3/ })).toBeInTheDocument(),
    )
  })

  it('opens the checklist in a dialog and closes it again', async () => {
    const user = userEvent.setup()
    renderLauncher(<ChecklistLauncher checklistId="demo" />)
    await user.click(screen.getByRole('button', { name: /Checklist/ }))
    const dialog = await screen.findByRole('dialog')
    expect(screen.getByText('First')).toBeInTheDocument()
    expect(screen.getByText('Second')).toBeInTheDocument()
    expect(screen.getByText('Third')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Dismiss' }))
    await waitFor(() => expect(dialog).not.toBeInTheDocument())
  })

  it('shows a determinate ring reflecting the progress', async () => {
    renderLauncher(<ChecklistLauncher checklistId="demo" />, {
      storage: storageWithCompleted(['one']),
    })
    await waitFor(() =>
      expect(screen.getByRole('progressbar', { hidden: true })).toHaveAttribute(
        'aria-valuenow',
        '33',
      ),
    )
  })

  it('keeps the progress ring decorative to screen readers', async () => {
    renderLauncher(<ChecklistLauncher checklistId="demo" />, {
      storage: storageWithCompleted(['one']),
    })
    await screen.findByRole('button', { name: /1 of 3/ })
    // Default role queries respect aria-hidden: none should surface here, since the ring
    // only repeats what the Fab's own accessible name already says.
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    // The ring itself must still be the only role="progressbar" element in the closed state.
    expect(screen.getAllByRole('progressbar', { hidden: true })).toHaveLength(1)
  })

  it('paints below the tour overlay and above the application chrome', async () => {
    renderLauncher(<ChecklistLauncher checklistId="demo" />)
    const anchor = await screen.findByTestId('checklist-launcher-anchor')
    const zIndex = Number(getComputedStyle(anchor).zIndex)
    // Pinned to the ordering, not the literal numbers. Spotlight paints at theme.zIndex.modal
    // while a tour runs, so the launcher must stay behind it; and it must stay in front of a
    // host application's own chrome, which in MUI's scale is the app bar and the drawer.
    expect(zIndex).toBeLessThan(testTheme.zIndex.modal)
    expect(zIndex).toBeGreaterThan(testTheme.zIndex.drawer)
    expect(zIndex).toBeGreaterThan(testTheme.zIndex.appBar)
  })

  it('renders nothing once the checklist is dismissed', async () => {
    const { container } = renderLauncher(<ChecklistLauncher checklistId="demo" />, {
      storage: storageWithCompleted([], true),
    })
    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })

  it('stays visible when every item is complete', async () => {
    renderLauncher(<ChecklistLauncher checklistId="demo" />, {
      storage: storageWithCompleted(['one', 'two', 'three']),
    })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /3 of 3/ })).toBeInTheDocument(),
    )
  })

  it('closes the popover when the activated item carries a tourId', async () => {
    const user = userEvent.setup()
    renderLauncher(<ChecklistLauncher checklistId="demo" title="Get started" />, {
      checklists: [activationChecklist],
    })
    await user.click(screen.getByRole('button', { name: /Get started/ }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()

    await user.click(screen.getByText('Tour item'))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('closes the popover when the activated item carries an href', async () => {
    const user = userEvent.setup()
    renderLauncher(<ChecklistLauncher checklistId="demo" title="Get started" />, {
      checklists: [activationChecklist],
      navigate: vi.fn(),
    })
    await user.click(screen.getByRole('button', { name: /Get started/ }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()

    await user.click(screen.getByText('Link item'))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('leaves the popover open when the activated item is a plain tick', async () => {
    const user = userEvent.setup()
    renderLauncher(<ChecklistLauncher checklistId="demo" title="Get started" />, {
      checklists: [activationChecklist],
    })
    await user.click(screen.getByRole('button', { name: /Get started/ }))
    await screen.findByRole('dialog')

    await user.click(screen.getByText('Plain item'))
    // Proves the click landed (the item toggled) rather than merely that the dialog element
    // is still the same reference: if the popover had closed, this checkbox would not be
    // findable anywhere in the document.
    await waitFor(() =>
      expect(
        screen.getByRole('checkbox', { name: 'Mark Plain item as not complete' }),
      ).toBeChecked(),
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('returns focus to the launcher button after the dialog closes', async () => {
    const user = userEvent.setup()
    renderLauncher(<ChecklistLauncher checklistId="demo" />)
    const launcher = screen.getByRole('button', { name: /Checklist/ })
    await user.click(launcher)
    await screen.findByRole('dialog')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(launcher).toHaveFocus())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
