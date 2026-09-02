import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, render, renderHook, waitFor } from '@testing-library/react'
import { useTargetElement } from '../src/useTargetElement'

function Anchor({ id }: { id: string }) {
  return <button data-guide={id}>cible</button>
}

describe('useTargetElement', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
  afterEach(() => vi.useRealTimers())

  it('résout une cible déjà présente', async () => {
    render(<Anchor id="create" />)
    const { result } = renderHook(() => useTargetElement('create'))
    await waitFor(() => expect(result.current.element).not.toBeNull())
    expect(result.current.element?.tagName).toBe('BUTTON')
    expect(result.current.timedOut).toBe(false)
  })

  it('ne résout rien quand la cible est nulle', () => {
    const { result } = renderHook(() => useTargetElement(null))
    expect(result.current.element).toBeNull()
  })

  it('attend l apparition tardive de la cible', async () => {
    const { result } = renderHook(() => useTargetElement('late'))
    expect(result.current.element).toBeNull()

    const host = document.createElement('div')
    document.body.appendChild(host)
    const view = render(<Anchor id="late" />, { container: host })

    await waitFor(() => expect(result.current.element).not.toBeNull())
    view.unmount()
  })

  it('signale le dépassement du délai', async () => {
    const { result } = renderHook(() => useTargetElement('never', { timeoutMs: 1000 }))
    await act(async () => {
      vi.advanceTimersByTime(1200)
    })
    expect(result.current.timedOut).toBe(true)
    expect(result.current.element).toBeNull()
  })

  it('échappe les guillemets dans la clé de cible', async () => {
    render(<Anchor id={'a"b'} />)
    const { result } = renderHook(() => useTargetElement('a"b'))
    await waitFor(() => expect(result.current.element).not.toBeNull())
  })

  it('reprend après le délai quand la cible apparaît plus tard', async () => {
    const { result } = renderHook(() => useTargetElement('delayed', { timeoutMs: 1000 }))
    await act(async () => {
      vi.advanceTimersByTime(1200)
    })
    expect(result.current.timedOut).toBe(true)
    expect(result.current.element).toBeNull()

    const host = document.createElement('div')
    document.body.appendChild(host)
    const view = render(<Anchor id="delayed" />, { container: host })

    await waitFor(() => expect(result.current.element).not.toBeNull())
    expect(result.current.timedOut).toBe(false)
    view.unmount()
  })
})
