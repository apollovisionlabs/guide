import { describe, expect, it, vi } from 'vitest'
import { render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useAnnouncer, useFocusTrap, usePrefersReducedMotion } from '../src/a11y'
import { useEffect, useRef, useState } from 'react'

function Trapped() {
  const ref = useRef<HTMLDivElement>(null)
  const [node, setNode] = useState<HTMLElement | null>(null)
  useEffect(() => setNode(ref.current), [])
  useFocusTrap(node, true)
  return (
    <div ref={ref}>
      <button>first</button>
      <button>second</button>
    </div>
  )
}

describe('useFocusTrap', () => {
  it('gives focus to the first focusable element', async () => {
    render(<Trapped />)
    expect(await screen.findByText('first')).toHaveFocus()
  })

  it('wraps from the last element back to the first with Tab', async () => {
    const user = userEvent.setup()
    render(<Trapped />)
    await screen.findByText('first')
    await user.tab()
    expect(screen.getByText('second')).toHaveFocus()
    await user.tab()
    expect(screen.getByText('first')).toHaveFocus()
  })

  it('restores focus to the element that had it', async () => {
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    outside.focus()

    const view = render(<Trapped />)
    await screen.findByText('first')
    view.unmount()
    expect(document.activeElement).toBe(outside)
  })
})

describe('useAnnouncer', () => {
  it('writes into a polite live region', () => {
    const { result } = renderHook(() => useAnnouncer())
    result.current('step 2 of 3')
    const region = document.querySelector('[data-guide-announcer]')
    expect(region).toHaveAttribute('aria-live', 'polite')
    expect(region).toHaveTextContent('step 2 of 3')
  })
})

describe('usePrefersReducedMotion', () => {
  it('follows the media query', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: true,
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
        }) as unknown as MediaQueryList,
    )
    const { result } = renderHook(() => usePrefersReducedMotion())
    expect(result.current).toBe(true)
  })
})
