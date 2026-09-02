import type { ReactElement } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { GuideProvider, useTour, type Tour } from '@guide/core'
import { GuideTour } from '../src/GuideTour'

// L'ondulation de ButtonBase declenche des mises a jour asynchrones que jsdom signale en
// avertissement act(). On la desactive pour les tests uniquement, le rendu de production
// gardant le comportement MUI par defaut.
const testTheme = createTheme({
  components: { MuiButtonBase: { defaultProps: { disableRipple: true } } },
})

function renderTour(ui: ReactElement) {
  return render(<ThemeProvider theme={testTheme}>{ui}</ThemeProvider>)
}

const tour: Tour = {
  id: 'demo',
  steps: [
    { target: 'one', title: 'Première', body: 'Corps un' },
    { target: 'two', title: 'Deuxième', body: 'Corps deux', interactive: true },
  ],
}

function Starter() {
  const { start } = useTour('demo')
  return <button onClick={() => void start()}>démarrer</button>
}

function Harness() {
  return (
    <GuideProvider tours={[tour]}>
      <button data-guide="one">un</button>
      <button data-guide="two">deux</button>
      <Starter />
      <GuideTour />
    </GuideProvider>
  )
}

describe('GuideTour', () => {
  it('ne rend rien tant qu aucun tour ne tourne', () => {
    renderTour(<Harness />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByTestId('guide-spotlight')).not.toBeInTheDocument()
  })

  it('affiche le spotlight et le popover au démarrage', async () => {
    const user = userEvent.setup()
    renderTour(<Harness />)
    await user.click(screen.getByText('démarrer'))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByTestId('guide-spotlight')).toBeInTheDocument()
    expect(screen.getByText('Première')).toBeInTheDocument()
  })

  it('avance jusqu à l étape interactive et laisse passer les clics', async () => {
    const user = userEvent.setup()
    renderTour(<Harness />)
    await user.click(screen.getByText('démarrer'))
    await screen.findByText('Première')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByText('Deuxième')
    expect(screen.getByTestId('guide-spotlight')).toHaveStyle({ pointerEvents: 'none' })
  })

  it('ferme tout quand le tour est arrêté', async () => {
    const user = userEvent.setup()
    renderTour(<Harness />)
    await user.click(screen.getByText('démarrer'))
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('rend le popover modal sur une étape normale et non modal sur une étape interactive', async () => {
    const user = userEvent.setup()
    renderTour(<Harness />)
    await user.click(screen.getByText('démarrer'))
    const firstDialog = await screen.findByRole('dialog')
    expect(firstDialog).toHaveAttribute('aria-modal', 'true')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByText('Deuxième')
    const secondDialog = screen.getByRole('dialog')
    expect(secondDialog).not.toHaveAttribute('aria-modal')
  })
  it('laisse Échap quitter le tour pendant l attente d une cible', async () => {
    const user = userEvent.setup()
    const waiting: Tour = { id: 'demo', steps: [{ target: 'absente', title: 'Absente' }] }

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

    await user.click(screen.getByText('démarrer'))
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('running'))
    // L'attente reste silencieuse : rien ne s'affiche tant que la cible n'est pas resolue.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('idle'))
  })
})
