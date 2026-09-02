import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Spotlight } from '../src/Spotlight'

const rect = { top: 100, left: 50, width: 200, height: 40 }

describe('Spotlight', () => {
  it('renders nothing without a rectangle', () => {
    const { container } = render(<Spotlight rect={null} />)
    expect(container.querySelector('svg')).toBeNull()
  })

  it('cuts a hole the size of the target, padding included', () => {
    const { container } = render(<Spotlight rect={rect} padding={8} radius={6} />)
    const hole = container.querySelector('mask rect:last-of-type')
    expect(hole).toHaveAttribute('x', '42')
    expect(hole).toHaveAttribute('y', '92')
    expect(hole).toHaveAttribute('width', '216')
    expect(hole).toHaveAttribute('height', '56')
    expect(hole).toHaveAttribute('rx', '6')
  })

  it('calls onDismiss on a click in the dimmed area', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    render(<Spotlight rect={rect} onDismiss={onDismiss} />)
    await user.click(screen.getByTestId('guide-spotlight'))
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('lets clicks through when the step is interactive', () => {
    render(<Spotlight rect={rect} interactive />)
    expect(screen.getByTestId('guide-spotlight')).toHaveStyle({ pointerEvents: 'none' })
  })

  it('stays out of the accessibility tree', () => {
    render(<Spotlight rect={rect} />)
    expect(screen.getByTestId('guide-spotlight')).toHaveAttribute('aria-hidden', 'true')
  })
  it('does not stop the tour on a click inside the highlighted hole', () => {
    const onDismiss = vi.fn()
    render(<Spotlight rect={rect} onDismiss={onDismiss} />)
    // At the centre of the target: the mask does not stop clicks, the coordinate test does.
    fireEvent.click(screen.getByTestId('guide-spotlight'), { clientX: 150, clientY: 120 })
    expect(onDismiss).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId('guide-spotlight'), { clientX: 600, clientY: 400 })
    expect(onDismiss).toHaveBeenCalledOnce()
  })
})
