import { describe, expect, it, beforeEach } from 'vitest'
import { createMemoryStorage, createBrowserStorage, isHotspotsProgress } from '../src/storage'

describe('createMemoryStorage', () => {
  it('returns null for an unknown tour', async () => {
    const storage = createMemoryStorage()
    expect(await storage.read('unknown')).toBeNull()
  })

  it('reads back what was written', async () => {
    const storage = createMemoryStorage()
    await storage.write('a', { status: 'in-progress', stepIndex: 2 })
    expect(await storage.read('a')).toEqual({ status: 'in-progress', stepIndex: 2 })
  })

  it('accepts an initial state', async () => {
    const storage = createMemoryStorage({ a: { status: 'completed', stepIndex: 4 } })
    expect(await storage.read('a')).toEqual({ status: 'completed', stepIndex: 4 })
  })

  it('stores and reads back an arbitrary shape under any key', async () => {
    const storage = createMemoryStorage()
    await storage.write('checklist:onboarding', { completed: ['a'], dismissed: false })
    expect(await storage.read('checklist:onboarding')).toEqual({
      completed: ['a'],
      dismissed: false,
    })
  })

  it('keeps keys from different namespaces apart', async () => {
    const storage = createMemoryStorage()
    await storage.write('tour:x', { status: 'in-progress', stepIndex: 2 })
    await storage.write('checklist:x', { completed: [], dismissed: true })
    expect(await storage.read('tour:x')).toEqual({ status: 'in-progress', stepIndex: 2 })
    expect(await storage.read('checklist:x')).toEqual({ completed: [], dismissed: true })
  })
})

describe('createBrowserStorage', () => {
  beforeEach(() => window.localStorage.clear())

  it('persists to localStorage under a namespace', async () => {
    const storage = createBrowserStorage('demo')
    await storage.write('a', { status: 'in-progress', stepIndex: 1 })
    expect(window.localStorage.getItem('demo:a')).toBe(
      JSON.stringify({ status: 'in-progress', stepIndex: 1 }),
    )
    expect(await storage.read('a')).toEqual({ status: 'in-progress', stepIndex: 1 })
  })

  it('returns null when the stored value is unreadable', async () => {
    window.localStorage.setItem('demo:a', 'not json')
    const storage = createBrowserStorage('demo')
    expect(await storage.read('a')).toBeNull()
  })
})

describe('isHotspotsProgress', () => {
  it('accepts a list of seen ids', () => {
    expect(isHotspotsProgress({ seen: ['a', 'b'] })).toBe(true)
    expect(isHotspotsProgress({ seen: [] })).toBe(true)
  })

  it('rejects anything else', () => {
    expect(isHotspotsProgress(null)).toBe(false)
    expect(isHotspotsProgress({})).toBe(false)
    expect(isHotspotsProgress({ seen: 'a' })).toBe(false)
    expect(isHotspotsProgress({ seen: [1] })).toBe(false)
  })
})
