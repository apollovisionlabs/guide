import type { ComponentProps, ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { StepPopover } from '../src/StepPopover'

// The ButtonBase ripple triggers asynchronous updates that jsdom reports as an act() warning.
// It is disabled for the tests only; the production rendering keeps the MUI default behaviour.
const testTheme = createTheme({
  components: { MuiButtonBase: { defaultProps: { disableRipple: true } } },
})

function renderPopover(ui: ReactElement) {
  return render(<ThemeProvider theme={testTheme}>{ui}</ThemeProvider>)
}

function setup(overrides: Partial<ComponentProps<typeof StepPopover>> = {}) {
  const anchor = document.createElement('button')
  anchor.textContent = 'anchor'
  document.body.appendChild(anchor)

  const props = {
    anchorEl: anchor,
    open: true,
    title: 'Title',
    body: 'Body',
    stepIndex: 1,
    stepCount: 3,
    isFirst: false,
    isLast: false,
    onNext: vi.fn(),
    onPrevious: vi.fn(),
    onStop: vi.fn(),
    ...overrides,
  }
  renderPopover(<StepPopover {...props} />)
  return props
}

describe('StepPopover', () => {
  it('shows the title, the body and the progress', () => {
    setup()
    expect(screen.getByText('Title')).toBeInTheDocument()
    expect(screen.getByText('Body')).toBeInTheDocument()
    expect(screen.getByText('2 / 3')).toBeInTheDocument()
  })

  it('is a dialog named by its title', () => {
    setup()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAccessibleName('Title')
  })

  it('calls onNext when the next button is clicked', async () => {
    const user = userEvent.setup()
    const props = setup()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(props.onNext).toHaveBeenCalledOnce()
  })

  it('replaces next with finish on the last step', () => {
    setup({ isLast: true })
    expect(screen.getByRole('button', { name: 'Finish' })).toBeInTheDocument()
  })

  it('hides the back button on the first step', () => {
    setup({ isFirst: true, stepIndex: 0 })
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
  })

  it('closes on the Escape key', async () => {
    const user = userEvent.setup()
    const props = setup()
    await user.keyboard('{Escape}')
    expect(props.onStop).toHaveBeenCalledOnce()
  })

  it('navigates with the arrow keys', async () => {
    const user = userEvent.setup()
    const props = setup()
    await user.keyboard('{ArrowRight}')
    expect(props.onNext).toHaveBeenCalledOnce()
    await user.keyboard('{ArrowLeft}')
    expect(props.onPrevious).toHaveBeenCalledOnce()
  })

  it('accepts custom labels', () => {
    setup({ labels: { next: 'Suivant', close: 'Fermer' } })
    expect(screen.getByRole('button', { name: 'Suivant' })).toBeInTheDocument()
  })

  it('renders nothing when closed', () => {
    setup({ open: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('links the highlighted element to the popover description', () => {
    const highlighted = document.createElement('button')
    highlighted.textContent = 'highlighted target'
    document.body.appendChild(highlighted)

    setup({ describeElement: highlighted })

    const describedBy = highlighted.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(document.getElementById(describedBy!)).toHaveTextContent('Body')
  })

  it('removes the description when the popover unmounts', () => {
    const highlighted = document.createElement('button')
    document.body.appendChild(highlighted)

    const anchor = document.createElement('button')
    document.body.appendChild(anchor)

    const view = renderPopover(
      <StepPopover
        anchorEl={anchor}
        open
        title="Title"
        body="Body"
        stepIndex={0}
        stepCount={1}
        isFirst
        isLast
        describeElement={highlighted}
        onNext={() => {}}
        onPrevious={() => {}}
        onStop={() => {}}
      />,
    )
    expect(highlighted).toHaveAttribute('aria-describedby')
    view.unmount()
    expect(highlighted).not.toHaveAttribute('aria-describedby')
  })

  it('ignores the arrow keys and Escape while focus is in a text input', async () => {
    const user = userEvent.setup()
    const props = setup()

    const input = document.createElement('input')
    document.body.appendChild(input)
    act(() => {
      input.focus()
    })

    await user.keyboard('{ArrowRight}')
    await user.keyboard('{ArrowLeft}')
    await user.keyboard('{Escape}')

    expect(props.onNext).not.toHaveBeenCalled()
    expect(props.onPrevious).not.toHaveBeenCalled()
    expect(props.onStop).not.toHaveBeenCalled()
  })

  it('carries aria-modal by default, and not when modal is false', () => {
    setup()
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')

    setup({ modal: false })
    const dialogs = screen.getAllByRole('dialog')
    expect(dialogs[dialogs.length - 1]).not.toHaveAttribute('aria-modal')
  })

  it('does not move focus into the popover when modal is false', () => {
    const previouslyFocused = document.createElement('button')
    document.body.appendChild(previouslyFocused)
    previouslyFocused.focus()

    setup({ modal: false })

    expect(document.activeElement).toBe(previouslyFocused)
  })
  it('gives focus to the popover container, not to the close button', () => {
    setup()
    // A reflex Enter after an arrow key must not stop the tour.
    expect(screen.getByRole('dialog')).toHaveFocus()
  })
})
