import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Spotlight } from '../src/Spotlight'

const rect = { top: 100, left: 50, width: 200, height: 40 }

describe('Spotlight', () => {
  it('ne rend rien sans rectangle', () => {
    const { container } = render(<Spotlight rect={null} />)
    expect(container.querySelector('svg')).toBeNull()
  })

  it('découpe un trou aux dimensions de la cible, marge comprise', () => {
    const { container } = render(<Spotlight rect={rect} padding={8} radius={6} />)
    const hole = container.querySelector('mask rect:last-of-type')
    expect(hole).toHaveAttribute('x', '42')
    expect(hole).toHaveAttribute('y', '92')
    expect(hole).toHaveAttribute('width', '216')
    expect(hole).toHaveAttribute('height', '56')
    expect(hole).toHaveAttribute('rx', '6')
  })

  it('appelle onDismiss au clic sur la zone sombre', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    render(<Spotlight rect={rect} onDismiss={onDismiss} />)
    await user.click(screen.getByTestId('guide-spotlight'))
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('laisse passer les clics quand l étape est interactive', () => {
    render(<Spotlight rect={rect} interactive />)
    expect(screen.getByTestId('guide-spotlight')).toHaveStyle({ pointerEvents: 'none' })
  })

  it('reste hors de l arbre d accessibilité', () => {
    render(<Spotlight rect={rect} />)
    expect(screen.getByTestId('guide-spotlight')).toHaveAttribute('aria-hidden', 'true')
  })
  it('ne ferme pas le tour au clic dans le trou mis en avant', () => {
    const onDismiss = vi.fn()
    render(<Spotlight rect={rect} onDismiss={onDismiss} />)
    // Au centre de la cible : le masque n'arrete pas les clics, c'est le test qui le fait.
    fireEvent.click(screen.getByTestId('guide-spotlight'), { clientX: 150, clientY: 120 })
    expect(onDismiss).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId('guide-spotlight'), { clientX: 600, clientY: 400 })
    expect(onDismiss).toHaveBeenCalledOnce()
  })
})
