import type { ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  ChecklistProvider,
  GuideProvider,
  useChecklist,
  type Checklist as ChecklistDefinition,
  type GuideStorage,
  type Tour,
} from '@apollovisionlabs/guide-core'
import { ChecklistLauncher } from '../src/ChecklistLauncher'
import { GuideTour } from '../src/GuideTour'

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

function renderLauncher(
  ui: ReactElement,
  options: {
    storage?: GuideStorage
    checklists?: ChecklistDefinition[]
    navigate?: (path: string) => void
  } = {},
) {
  return render(
    <ChecklistProvider
      checklists={options.checklists ?? [checklist]}
      storage={options.storage}
      navigate={options.navigate}
    >
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

describe('ChecklistLauncher', () => {
  it('labels itself with the progress in words', async () => {
    renderLauncher(<ChecklistLauncher checklistId="demo" />, {
      storage: storageWithCompleted(['one']),
    })
    await waitFor(() => expect(screen.getByRole('button', { name: /1 of 3/ })).toBeInTheDocument())
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
      expect(screen.getByRole('progressbar', { hidden: true })).toHaveAttribute('aria-valuenow', '33'),
    )
  })

  it('keeps the progress ring decorative to screen readers', async () => {
    renderLauncher(<ChecklistLauncher checklistId="demo" />, {
      storage: storageWithCompleted(['one']),
    })
    await screen.findByRole('button', { name: /1 of 3/ })
    // Default role queries respect aria-hidden: none should surface here, since the ring
    // only repeats what the launcher button's own accessible name already says.
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    // The ring itself must still be the only role="progressbar" element in the closed state.
    expect(screen.getAllByRole('progressbar', { hidden: true })).toHaveLength(1)
  })

  it('paints below the tour overlay and above the default stacking context', async () => {
    renderLauncher(<ChecklistLauncher checklistId="demo" />)
    const launcher = await screen.findByTestId('checklist-launcher-anchor')
    const zIndex = Number(getComputedStyle(launcher).zIndex)
    // Pinned to the ordering, not the literal numbers: Spotlight and StepPopover paint at
    // z-index 1300 while a tour runs, so the launcher must stay behind that, and above 0 so
    // it is not silently pulled beneath ordinary page content.
    expect(zIndex).toBeLessThan(1300)
    expect(zIndex).toBeGreaterThan(0)
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
    await waitFor(() => expect(screen.getByRole('button', { name: /3 of 3/ })).toBeInTheDocument())
  })

  it('renders nothing while a slow restore is in flight, then stays gone once it reports the checklist dismissed', async () => {
    const { storage, resolveRead } = controllableStorage()
    const { container } = renderLauncher(<ChecklistLauncher checklistId="demo" />, { storage })

    // The read is deliberately left unresolved: this is the race itself, asserted rather than
    // hoped past. Storage already says the checklist was dismissed, but the component does not
    // know that yet; drawing the launcher here would be exactly the flash this fix exists to
    // prevent, a launcher for a checklist the user dismissed long ago appearing before
    // vanishing again.
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByRole('button', { name: /Checklist/ })).not.toBeInTheDocument()

    await act(async () => {
      resolveRead({ completed: [], dismissed: true })
      await Promise.resolve()
      await Promise.resolve()
    })

    // Still nothing: the read landed and confirmed the dismissal, so there is nothing to draw
    // and no dismissal confirmation either, since dismissedHere was never set from inside this
    // session.
    await waitFor(() => expect(container).toBeEmptyDOMElement())
    expect(screen.queryByRole('button', { name: /Checklist/ })).not.toBeInTheDocument()
  })

  it('renders immediately with no storage prop at all', () => {
    renderLauncher(<ChecklistLauncher checklistId="demo" />)
    // getByRole, not findByRole: proves there is nothing to wait for, not merely that it
    // eventually appears.
    expect(screen.getByRole('button', { name: /0 of 3/ })).toBeInTheDocument()
  })

  it('renders the launcher once a storage read rejects, rather than hiding it forever', async () => {
    const { storage, rejectRead } = controllableStorage()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { container } = renderLauncher(<ChecklistLauncher checklistId="demo" />, { storage })

    expect(container).toBeEmptyDOMElement()

    await act(async () => {
      rejectRead(new Error('storage unavailable'))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(await screen.findByRole('button', { name: /0 of 3/ })).toBeInTheDocument()
    warn.mockRestore()
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
      expect(screen.getByRole('checkbox', { name: 'Mark Plain item as not complete' })).toBeChecked(),
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('leaves focus somewhere deliberate when the checklist is dismissed from the popover', async () => {
    const user = userEvent.setup()
    renderLauncher(<ChecklistLauncher checklistId="demo" title="Get started" />)
    await user.click(screen.getByRole('button', { name: /Get started/ }))
    await screen.findByRole('dialog')

    await user.click(screen.getByRole('button', { name: 'Dismiss' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    // The launcher button and the panel unmount in the same commit, so there is no anchor
    // left to restore focus to and a keyboard user would otherwise be dropped on document.body.
    expect(document.activeElement).not.toBe(document.body)
    // Queried by its text rather than by a role: the confirmation is deliberately not a live
    // region, because being focused is what announces it and a live region focused in the same
    // commit is read twice by several screen readers.
    const confirmation = screen.getByText('Get started dismissed')
    expect(confirmation).toHaveFocus()
    // The launcher itself is gone: this confirms the dismissal, it does not replace it.
    expect(screen.queryByRole('button', { name: /Get started/ })).not.toBeInTheDocument()
  })

  it('drops the dismissal confirmation once focus moves on', async () => {
    const user = userEvent.setup()
    renderLauncher(<ChecklistLauncher checklistId="demo" title="Get started" />)
    await user.click(screen.getByRole('button', { name: /Get started/ }))
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: 'Dismiss' }))
    await screen.findByText('Get started dismissed')

    await user.tab()
    await waitFor(() => expect(screen.queryByText('Get started dismissed')).not.toBeInTheDocument())
  })

  it('does not steal focus on a later dismissal once the checklist came back', async () => {
    const user = userEvent.setup()
    // The host drives reset and dismiss itself, without a click, the way a hotkey, a timer or a
    // server push would. That matters: going through a button would move focus, and the blur
    // handler would clear the flag as a side effect, hiding the bug this test exists for.
    let host: { reset: () => void; dismiss: () => void } | null = null
    function Harness() {
      const { reset, dismiss } = useChecklist('demo')
      host = { reset, dismiss }
      return (
        <>
          <ChecklistLauncher checklistId="demo" title="Get started" />
          <input aria-label="elsewhere" />
        </>
      )
    }
    renderLauncher(<Harness />)

    await user.click(screen.getByRole('button', { name: /Get started/ }))
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: 'Dismiss' }))
    const confirmation = await screen.findByText('Get started dismissed')
    expect(confirmation).toHaveFocus()

    // The checklist comes back while the confirmation still holds focus. Removing a focused
    // node fires no blur, so nothing clears the flag on the way out.
    await act(async () => {
      host!.reset()
    })
    await screen.findByRole('button', { name: /Get started/ })

    const elsewhere = screen.getByRole('textbox', { name: 'elsewhere' })
    await user.click(elsewhere)
    expect(elsewhere).toHaveFocus()

    // A later dismissal this launcher did not host must leave no confirmation, and must not
    // pull the user out of what they were typing in.
    await act(async () => {
      host!.dismiss()
    })
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Get started/ })).not.toBeInTheDocument(),
    )
    expect(screen.queryByText('Get started dismissed')).not.toBeInTheDocument()
    expect(elsewhere).toHaveFocus()
  })

  it('passes the fab label the title and both counts', async () => {
    renderLauncher(
      <ChecklistLauncher
        checklistId="demo"
        title="Get started"
        labels={{
          fabLabel: (title, completedCount, total) => `fab:${title}:${completedCount}/${total}`,
        }}
      />,
      { storage: storageWithCompleted(['one']) },
    )
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'fab:Get started:1/3' })).toBeInTheDocument(),
    )
  })

  it('passes the dismissed label the title', async () => {
    const user = userEvent.setup()
    renderLauncher(
      <ChecklistLauncher
        checklistId="demo"
        title="Get started"
        labels={{ dismissed: (title) => `bye:${title}` }}
      />,
    )
    await user.click(screen.getByRole('button', { name: /Get started/ }))
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: 'Dismiss' }))
    await screen.findByText('bye:Get started')
  })

  it('passes its own labels through to the checklist inside the popover', async () => {
    const user = userEvent.setup()
    renderLauncher(<ChecklistLauncher checklistId="demo" title="Get started" labels={{ dismiss: 'Ignorer' }} />)
    await user.click(screen.getByRole('button', { name: /Get started/ }))
    await screen.findByRole('dialog')
    expect(screen.getByRole('button', { name: 'Ignorer' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument()
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

// A tour whose single step targets an element that is actually present, so GuideTour mounts a
// real StepPopover instead of silently waiting for a missing target.
const focusTour: Tour = {
  id: 'product',
  steps: [{ target: 'focus-target', title: 'Tour title', body: 'Tour body' }],
}

const focusChecklist: ChecklistDefinition = {
  id: 'demo',
  items: [{ id: 'tour', title: 'Tour item', tourId: 'product' }],
}

function FocusHarness() {
  return (
    <GuideProvider tours={[focusTour]}>
      <ChecklistProvider checklists={[focusChecklist]}>
        <button data-guide="focus-target">Target</button>
        <ChecklistLauncher checklistId="demo" title="Get started" />
        <GuideTour />
      </ChecklistProvider>
    </GuideProvider>
  )
}

describe('ChecklistLauncher keyboard focus handoff', () => {
  it('moves focus into the tour dialog, not the checklist or the body, when a tour item is activated from the keyboard', async () => {
    const user = userEvent.setup()
    render(<FocusHarness />)

    // Keyboard-only from here: focus the launcher directly (the equivalent of having tabbed to
    // it), then Enter to open, Tab to the tour item's row, Enter to activate it.
    screen.getByRole('button', { name: /Get started/ }).focus()
    await user.keyboard('{Enter}')
    await screen.findByRole('dialog', { name: 'Get started' })

    let guard = 0
    while (
      !(
        document.activeElement?.matches('[role="button"], button') &&
        document.activeElement.textContent?.includes('Tour item')
      ) &&
      guard < 20
    ) {
      await user.tab()
      guard++
    }
    expect(document.activeElement?.textContent).toContain('Tour item')

    await user.keyboard('{Enter}')

    // Exactly one dialog on screen, and it is the tour's, not the checklist's: the checklist
    // popover (aria-label "Get started") is gone, and focus is inside the surviving dialog.
    await waitFor(() => {
      const dialogs = screen.getAllByRole('dialog')
      expect(dialogs).toHaveLength(1)
      expect(dialogs[0]).not.toHaveAttribute('aria-label', 'Get started')
      expect(dialogs[0]).toContainElement(document.activeElement as HTMLElement)
    })
    expect(document.activeElement).not.toBe(document.body)
  })
})
