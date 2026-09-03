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
import { Checklist } from '../src/Checklist'

const testTheme = createTheme({
  components: { MuiButtonBase: { defaultProps: { disableRipple: true } } },
})

const checklist: ChecklistDefinition = {
  id: 'demo',
  items: [
    { id: 'one', title: 'First' },
    { id: 'two', title: 'Second', href: '/second' },
    { id: 'three', title: 'Third' },
  ],
}

function storageWithCompleted(itemIds: string[]): GuideStorage {
  return {
    read: async <T,>(key: string) => {
      if (key === 'checklist:demo') return { completed: itemIds, dismissed: false } as T
      return null
    },
    write: async () => {},
  }
}

function renderChecklist(
  ui: ReactElement,
  options: { storage?: GuideStorage; navigate?: (path: string) => void } = {},
) {
  return render(
    <ThemeProvider theme={testTheme}>
      <ChecklistProvider
        checklists={[checklist]}
        storage={options.storage}
        navigate={options.navigate}
      >
        {ui}
      </ChecklistProvider>
    </ThemeProvider>,
  )
}

describe('Checklist', () => {
  it('shows the progress as text and as a bar', async () => {
    renderChecklist(<Checklist checklistId="demo" />, {
      storage: storageWithCompleted(['one']),
    })
    await screen.findByText('1 of 3')
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '33')
  })

  it('renders one row per item with the completed one marked', async () => {
    renderChecklist(<Checklist checklistId="demo" />, {
      storage: storageWithCompleted(['one']),
    })
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: 'Mark First as not complete' })).toBeChecked(),
    )
    expect(screen.getByRole('checkbox', { name: 'Mark Second as complete' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Mark Third as complete' })).not.toBeChecked()
  })

  it('does not nest the checkbox inside an element with role button', async () => {
    const { container } = renderChecklist(<Checklist checklistId="demo" />)
    await screen.findByText('First')
    expect(container.querySelector('[role="button"] input[type="checkbox"]')).toBeNull()
  })

  it('activates the item when the row is clicked', async () => {
    const user = userEvent.setup()
    const navigate = vi.fn()
    renderChecklist(<Checklist checklistId="demo" />, { navigate })
    await user.click(screen.getByText('Second'))
    expect(navigate).toHaveBeenCalledWith('/second')
  })

  it('toggles when the checkbox is clicked, without activating', async () => {
    const user = userEvent.setup()
    const navigate = vi.fn()
    renderChecklist(<Checklist checklistId="demo" />, { navigate })
    await user.click(screen.getByRole('checkbox', { name: 'Mark Second as complete' }))
    expect(navigate).not.toHaveBeenCalled()
    expect(screen.getByRole('checkbox', { name: 'Mark Second as not complete' })).toBeChecked()
  })

  it('calls onActivate with the resolved item after activating', async () => {
    const user = userEvent.setup()
    const navigate = vi.fn()
    const onActivate = vi.fn()
    renderChecklist(<Checklist checklistId="demo" onActivate={onActivate} />, { navigate })
    await user.click(screen.getByText('Second'))
    expect(navigate).toHaveBeenCalledWith('/second')
    expect(onActivate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'two', title: 'Second', href: '/second' }),
    )
  })

  it('still activates normally when no onActivate is passed', async () => {
    const user = userEvent.setup()
    const navigate = vi.fn()
    renderChecklist(<Checklist checklistId="demo" />, { navigate })
    await user.click(screen.getByText('Second'))
    expect(navigate).toHaveBeenCalledWith('/second')
  })

  it('renders nothing once dismissed', async () => {
    const user = userEvent.setup()
    const { container } = renderChecklist(<Checklist checklistId="demo" />)
    await user.click(screen.getByRole('button', { name: 'Dismiss' }))
    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })

  it('uses a supplied label in place of the default', async () => {
    renderChecklist(<Checklist checklistId="demo" labels={{ dismiss: 'Ignorer' }} />)
    await screen.findByText('First')
    expect(screen.getByRole('button', { name: 'Ignorer' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument()
  })

  it('keeps the English default for any label a partial override omits', async () => {
    renderChecklist(<Checklist checklistId="demo" labels={{ dismiss: 'Ignorer' }} />, {
      storage: storageWithCompleted(['one']),
    })
    await screen.findByText('1 of 3')
    expect(screen.getByRole('checkbox', { name: 'Mark Second as complete' })).toBeInTheDocument()
  })

  it('passes the completed and total counts to the progress label', async () => {
    renderChecklist(
      <Checklist
        checklistId="demo"
        labels={{ progress: (completedCount, total) => `progress:${completedCount}/${total}` }}
      />,
      { storage: storageWithCompleted(['one']) },
    )
    await screen.findByText('progress:1/3')
  })

  it('passes the item title to the checkbox accessible name labels', async () => {
    renderChecklist(
      <Checklist
        checklistId="demo"
        labels={{
          markComplete: (itemTitle) => `complete:${itemTitle}`,
          markNotComplete: (itemTitle) => `not-complete:${itemTitle}`,
        }}
      />,
      { storage: storageWithCompleted(['one']) },
    )
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: 'not-complete:First' })).toBeChecked(),
    )
    expect(screen.getByRole('checkbox', { name: 'complete:Second' })).not.toBeChecked()
  })
})
