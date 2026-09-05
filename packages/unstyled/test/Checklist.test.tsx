import type { ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  ChecklistProvider,
  type Checklist as ChecklistDefinition,
  type GuideStorage,
} from '@apollovisionlabs/guide-core'
import { Checklist } from '../src/Checklist'

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

// A storage backed by a real async function resolves before any assertion between render and
// the next await can run, so it can never distinguish "nothing drawn because restore is
// pending" from "nothing drawn regardless of storage". Resolving or rejecting this by hand
// makes the race itself the thing under test, rather than something hoped past.
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

function renderChecklist(
  ui: ReactElement,
  options: { storage?: GuideStorage; navigate?: (path: string) => void } = {},
) {
  return render(
    <ChecklistProvider checklists={[checklist]} storage={options.storage} navigate={options.navigate}>
      {ui}
    </ChecklistProvider>,
  )
}

// useAnnouncer's live region is a document.body singleton appended outside any React tree, so
// RTL's automatic unmount between tests never removes it. Left in place, a later test's plain
// text query can match stale content this singleton is still holding from an earlier test.
afterEach(() => {
  document.querySelector('[data-guide-announcer]')?.remove()
})

describe('Checklist', () => {
  it('shows the progress as text and as a bar', async () => {
    renderChecklist(<Checklist checklistId="demo" />, {
      storage: storageWithCompleted(['one']),
    })
    await screen.findByText('1 of 3', { selector: '.guide-checklist-progress' })
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '33')
  })

  it('draws the filled portion of the bar, not only aria-valuenow', async () => {
    // The track alone told two audiences different things: a screen reader heard "33" while a
    // sighted user saw a flat bar that never moved. The width is data-driven geometry, so it
    // is inline; the fill's colour and height stay in the stylesheet.
    const { container } = renderChecklist(<Checklist checklistId="demo" />, {
      storage: storageWithCompleted(['one']),
    })
    await screen.findByText('1 of 3', { selector: '.guide-checklist-progress' })
    const fill = container.querySelector<HTMLElement>('[data-guide-part="checklist-bar-fill"]')
    expect(fill).not.toBeNull()
    expect(fill).toHaveClass('guide-checklist-bar-fill')
    expect(fill?.style.width).toBe('33%')
  })

  it('draws the bar itself with no stylesheet, through custom properties an adopter can set', async () => {
    // The fill's width alone was not enough: with no stylesheet the track had height 0 and the
    // fill no background, so a component that claims to render a progress bar rendered
    // literally nothing. Absent is not plain. Same indirection as every other legibility
    // default in this package: works with no CSS, still rethemes from one variable.
    const { container } = renderChecklist(<Checklist checklistId="demo" />, {
      storage: storageWithCompleted(['one']),
    })
    await screen.findByText('1 of 3', { selector: '.guide-checklist-progress' })
    const track = container.querySelector<HTMLElement>('[data-guide-part="checklist-bar"]')
    const fill = container.querySelector<HTMLElement>('[data-guide-part="checklist-bar-fill"]')
    expect(track?.style.height).toBe('var(--guide-bar-height, 4px)')
    expect(track?.style.background).toBe('var(--guide-border, #d9d9d9)')
    expect(fill?.style.height).toBe('100%')
    expect(fill?.style.background).toBe('var(--guide-primary, #2563eb)')
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
    // A plain <button> already carries the button role implicitly: the check above must not
    // pass merely because nothing in the tree was given an explicit role="button".
    expect(container.querySelector('button input[type="checkbox"]')).toBeNull()
  })

  it('marks a completed item for a stylesheet to strike through', async () => {
    const { container } = renderChecklist(<Checklist checklistId="demo" />, {
      storage: storageWithCompleted(['one']),
    })
    await screen.findByText('1 of 3', { selector: '.guide-checklist-progress' })
    const row = container.querySelector('[data-guide-part="checklist-item"][data-guide-complete="true"]')
    expect(row).not.toBeNull()
    expect(row?.textContent).toContain('First')
  })

  it('renders the list as a real list', async () => {
    renderChecklist(<Checklist checklistId="demo" />)
    await screen.findByText('First')
    expect(screen.getByRole('list')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
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
    await screen.findByText('1 of 3', { selector: '.guide-checklist-progress' })
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
    await screen.findByText('progress:1/3', { selector: '.guide-checklist-progress' })
  })

  it('renders nothing while a slow restore is in flight, then the real progress once it resolves', async () => {
    const { storage, resolveRead } = controllableStorage()
    const { container } = renderChecklist(<Checklist checklistId="demo" />, { storage })

    // The read is deliberately left unresolved: this is the race itself, asserted rather than
    // hoped past. Before it resolves, storage says one item is complete but the component does
    // not know that yet; drawing "0 of 3" here, or any row at all, would be exactly the flash
    // this fix exists to prevent.
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByText(/of 3/)).not.toBeInTheDocument()

    await act(async () => {
      resolveRead({ completed: ['one'], dismissed: false })
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(
      await screen.findByText('1 of 3', { selector: '.guide-checklist-progress' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Mark First as not complete' })).toBeChecked()
  })

  it('renders immediately with no storage prop at all', () => {
    renderChecklist(<Checklist checklistId="demo" />)
    // getByText, not findByText: proves there is nothing to wait for, not merely that it
    // eventually appears.
    expect(screen.getByText('First')).toBeInTheDocument()
    expect(screen.getByText('0 of 3', { selector: '.guide-checklist-progress' })).toBeInTheDocument()
  })

  it('renders once a storage read rejects, rather than hiding the checklist forever', async () => {
    const { storage, rejectRead } = controllableStorage()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { container } = renderChecklist(<Checklist checklistId="demo" />, { storage })

    expect(container).toBeEmptyDOMElement()

    await act(async () => {
      rejectRead(new Error('storage unavailable'))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(await screen.findByText('First')).toBeInTheDocument()
    expect(screen.getByText('0 of 3', { selector: '.guide-checklist-progress' })).toBeInTheDocument()
    warn.mockRestore()
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
