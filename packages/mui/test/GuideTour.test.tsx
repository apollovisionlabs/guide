import type { ReactElement } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { GuideProvider, useTour, type Tour } from '@guide/core'
import { GuideTour } from '../src/GuideTour'

// The ButtonBase ripple triggers asynchronous updates that jsdom reports as an act() warning.
// It is disabled for the tests only; the production rendering keeps the MUI default behaviour.
const testTheme = createTheme({
  components: { MuiButtonBase: { defaultProps: { disableRipple: true } } },
})

function renderTour(ui: ReactElement) {
  return render(<ThemeProvider theme={testTheme}>{ui}</ThemeProvider>)
}

const tour: Tour = {
  id: 'demo',
  steps: [
    { target: 'one', title: 'First', body: 'Body one' },
    { target: 'two', title: 'Second', body: 'Body two', interactive: true },
  ],
}

function Starter() {
  const { start } = useTour('demo')
  return <button onClick={() => void start()}>start</button>
}

function Harness() {
  return (
    <GuideProvider tours={[tour]}>
      <button data-guide="one">one</button>
      <button data-guide="two">two</button>
      <Starter />
      <GuideTour />
    </GuideProvider>
  )
}

describe('GuideTour', () => {
  it('renders nothing while no tour is running', () => {
    renderTour(<Harness />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByTestId('guide-spotlight')).not.toBeInTheDocument()
  })

  it('shows the spotlight and the popover when the tour starts', async () => {
    const user = userEvent.setup()
    renderTour(<Harness />)
    await user.click(screen.getByText('start'))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByTestId('guide-spotlight')).toBeInTheDocument()
    expect(screen.getByText('First')).toBeInTheDocument()
  })

  it('advances to the interactive step and lets clicks through', async () => {
    const user = userEvent.setup()
    renderTour(<Harness />)
    await user.click(screen.getByText('start'))
    await screen.findByText('First')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByText('Second')
    expect(screen.getByTestId('guide-spotlight')).toHaveStyle({ pointerEvents: 'none' })
  })

  it('closes everything when the tour is stopped', async () => {
    const user = userEvent.setup()
    renderTour(<Harness />)
    await user.click(screen.getByText('start'))
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('renders the popover modal on a normal step and non-modal on an interactive step', async () => {
    const user = userEvent.setup()
    renderTour(<Harness />)
    await user.click(screen.getByText('start'))
    const firstDialog = await screen.findByRole('dialog')
    expect(firstDialog).toHaveAttribute('aria-modal', 'true')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByText('Second')
    const secondDialog = screen.getByRole('dialog')
    expect(secondDialog).not.toHaveAttribute('aria-modal')
  })
  it('lets Escape quit the tour while a target is awaited', async () => {
    const user = userEvent.setup()
    const waiting: Tour = { id: 'demo', steps: [{ target: 'absent', title: 'Absent' }] }

    function Status() {
      const { status } = useTour('demo')
      return <span data-testid="status">{status}</span>
    }

    renderTour(
      <GuideProvider tours={[waiting]}>
        <Starter />
        <Status />
        <GuideTour />
      </GuideProvider>,
    )

    await user.click(screen.getByText('start'))
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('running'))
    // The wait stays silent: nothing is drawn until the target resolves.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('idle'))
  })
})
