import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { Portal } from '../src/Portal'

describe('Portal', () => {
  it('renders its children into document.body, not in place', () => {
    const { getByTestId } = render(
      <div data-testid="in-place-parent">
        <Portal>
          <span data-testid="child">content</span>
        </Portal>
      </div>,
    )

    const child = getByTestId('child')
    expect(child.parentElement).toBe(document.body)
    expect(getByTestId('in-place-parent')).not.toContainElement(child)
  })

  it('removes its children on unmount', () => {
    const { getByTestId, unmount } = render(
      <Portal>
        <span data-testid="child">content</span>
      </Portal>,
    )

    expect(getByTestId('child')).toBeInTheDocument()
    unmount()
    expect(document.body.querySelector('[data-testid="child"]')).toBeNull()
  })
})
