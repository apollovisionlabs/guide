import type { ComponentProps, ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { StepPopover } from '../src/StepPopover'

// L'ondulation de ButtonBase declenche des mises a jour asynchrones que jsdom signale en
// avertissement act(). On la desactive pour les tests uniquement, le rendu de production
// gardant le comportement MUI par defaut.
const testTheme = createTheme({
  components: { MuiButtonBase: { defaultProps: { disableRipple: true } } },
})

function renderPopover(ui: ReactElement) {
  return render(<ThemeProvider theme={testTheme}>{ui}</ThemeProvider>)
}

function setup(overrides: Partial<ComponentProps<typeof StepPopover>> = {}) {
  const anchor = document.createElement('button')
  anchor.textContent = 'ancre'
  document.body.appendChild(anchor)

  const props = {
    anchorEl: anchor,
    open: true,
    title: 'Titre',
    body: 'Corps',
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
  it('affiche le titre, le corps et la progression', () => {
    setup()
    expect(screen.getByText('Titre')).toBeInTheDocument()
    expect(screen.getByText('Corps')).toBeInTheDocument()
    expect(screen.getByText('2 / 3')).toBeInTheDocument()
  })

  it('est une boîte de dialogue nommée par son titre', () => {
    setup()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAccessibleName('Titre')
  })

  it('appelle onNext au clic sur suivant', async () => {
    const user = userEvent.setup()
    const props = setup()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(props.onNext).toHaveBeenCalledOnce()
  })

  it('remplace suivant par terminer à la dernière étape', () => {
    setup({ isLast: true })
    expect(screen.getByRole('button', { name: 'Finish' })).toBeInTheDocument()
  })

  it('masque le bouton précédent à la première étape', () => {
    setup({ isFirst: true, stepIndex: 0 })
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
  })

  it('ferme avec la touche Échap', async () => {
    const user = userEvent.setup()
    const props = setup()
    await user.keyboard('{Escape}')
    expect(props.onStop).toHaveBeenCalledOnce()
  })

  it('navigue avec les flèches', async () => {
    const user = userEvent.setup()
    const props = setup()
    await user.keyboard('{ArrowRight}')
    expect(props.onNext).toHaveBeenCalledOnce()
    await user.keyboard('{ArrowLeft}')
    expect(props.onPrevious).toHaveBeenCalledOnce()
  })

  it('accepte des libellés personnalisés', () => {
    setup({ labels: { next: 'Suivant', close: 'Fermer' } })
    expect(screen.getByRole('button', { name: 'Suivant' })).toBeInTheDocument()
  })

  it('ne rend rien quand il est fermé', () => {
    setup({ open: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('relie l élément mis en avant à la description du popover', () => {
    const highlighted = document.createElement('button')
    highlighted.textContent = 'cible mise en avant'
    document.body.appendChild(highlighted)

    setup({ describeElement: highlighted })

    const describedBy = highlighted.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(document.getElementById(describedBy!)).toHaveTextContent('Corps')
  })

  it('retire la description quand le popover disparaît', () => {
    const highlighted = document.createElement('button')
    document.body.appendChild(highlighted)

    const anchor = document.createElement('button')
    document.body.appendChild(anchor)

    const view = renderPopover(
      <StepPopover
        anchorEl={anchor}
        open
        title="Titre"
        body="Corps"
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
})
