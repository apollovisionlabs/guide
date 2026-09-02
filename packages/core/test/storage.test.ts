import { describe, expect, it, beforeEach } from 'vitest'
import { createMemoryStorage, createBrowserStorage } from '../src/storage'

describe('createMemoryStorage', () => {
  it('renvoie null pour un tour inconnu', async () => {
    const storage = createMemoryStorage()
    expect(await storage.read('unknown')).toBeNull()
  })

  it('relit ce qui a été écrit', async () => {
    const storage = createMemoryStorage()
    await storage.write('a', { status: 'in-progress', stepIndex: 2 })
    expect(await storage.read('a')).toEqual({ status: 'in-progress', stepIndex: 2 })
  })

  it('accepte un état initial', async () => {
    const storage = createMemoryStorage({ a: { status: 'completed', stepIndex: 4 } })
    expect(await storage.read('a')).toEqual({ status: 'completed', stepIndex: 4 })
  })
})

describe('createBrowserStorage', () => {
  beforeEach(() => window.localStorage.clear())

  it('persiste dans localStorage sous un espace de noms', async () => {
    const storage = createBrowserStorage('demo')
    await storage.write('a', { status: 'in-progress', stepIndex: 1 })
    expect(window.localStorage.getItem('demo:a')).toBe(
      JSON.stringify({ status: 'in-progress', stepIndex: 1 }),
    )
    expect(await storage.read('a')).toEqual({ status: 'in-progress', stepIndex: 1 })
  })

  it('renvoie null quand la valeur stockée est illisible', async () => {
    window.localStorage.setItem('demo:a', 'pas du json')
    const storage = createBrowserStorage('demo')
    expect(await storage.read('a')).toBeNull()
  })
})
