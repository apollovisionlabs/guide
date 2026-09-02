import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, render, renderHook, waitFor } from '@testing-library/react'
import { useTargetElement } from '../src/useTargetElement'

function Anchor({ id }: { id: string }) {
  return <button data-guide={id}>target</button>
}

describe('useTargetElement', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
  afterEach(() => vi.useRealTimers())

  it('resolves a target that is already present', async () => {
    render(<Anchor id="create" />)
    const { result } = renderHook(() => useTargetElement('create'))
    await waitFor(() => expect(result.current.element).not.toBeNull())
    expect(result.current.element?.tagName).toBe('BUTTON')
    expect(result.current.timedOut).toBe(false)
  })

  it('resolves nothing when the target is null', () => {
    const { result } = renderHook(() => useTargetElement(null))
    expect(result.current.element).toBeNull()
  })

  it('waits for a target that appears late', async () => {
    const { result } = renderHook(() => useTargetElement('late'))
    expect(result.current.element).toBeNull()

    const host = document.createElement('div')
    document.body.appendChild(host)
    const view = render(<Anchor id="late" />, { container: host })

    await waitFor(() => expect(result.current.element).not.toBeNull())
    view.unmount()
  })

  it('reports the timeout being exceeded', async () => {
    const { result } = renderHook(() => useTargetElement('never', { timeoutMs: 1000 }))
    await act(async () => {
      vi.advanceTimersByTime(1200)
    })
    expect(result.current.timedOut).toBe(true)
    expect(result.current.element).toBeNull()
  })

  it('escapes quotes in the target key', async () => {
    render(<Anchor id={'a"b'} />)
    const { result } = renderHook(() => useTargetElement('a"b'))
    await waitFor(() => expect(result.current.element).not.toBeNull())
  })

  it('recovers after the timeout when the target appears later', async () => {
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
