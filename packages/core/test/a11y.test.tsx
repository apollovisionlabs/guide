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
      <button>premier</button>
      <button>second</button>
    </div>
  )
}

describe('useFocusTrap', () => {
  it('donne le focus au premier élément focalisable', async () => {
    render(<Trapped />)
    expect(await screen.findByText('premier')).toHaveFocus()
  })

  it('boucle du dernier vers le premier avec Tab', async () => {
    const user = userEvent.setup()
    render(<Trapped />)
    await screen.findByText('premier')
    await user.tab()
    expect(screen.getByText('second')).toHaveFocus()
    await user.tab()
    expect(screen.getByText('premier')).toHaveFocus()
  })

  it('rend le focus à l élément d origine', async () => {
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    outside.focus()

    const view = render(<Trapped />)
    await screen.findByText('premier')
    view.unmount()
    expect(document.activeElement).toBe(outside)
  })
})

describe('useAnnouncer', () => {
  it('écrit dans une région dynamique polie', () => {
    const { result } = renderHook(() => useAnnouncer())
    result.current('étape 2 sur 3')
    const region = document.querySelector('[data-guide-announcer]')
    expect(region).toHaveAttribute('aria-live', 'polite')
    expect(region).toHaveTextContent('étape 2 sur 3')
  })
})

describe('usePrefersReducedMotion', () => {
  it('suit la requête média', () => {
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
