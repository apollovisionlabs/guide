import { describe, expect, it } from 'vitest'
import { findMissingTargets } from '../src/validateTour'
import type { Tour } from '../src/types'

const tour: Tour = {
  id: 'demo',
  steps: [
    { target: 'present', route: '/' },
    { target: 'absent', route: '/' },
    { target: 'elsewhere', route: '/other' },
    { target: 'no-route' },
  ],
}

describe('findMissingTargets', () => {
  it('reports only the targets expected on the current page', () => {
    document.body.innerHTML = '<button data-guide="present"></button>'
    expect(findMissingTargets(tour, '/')).toEqual(['absent', 'no-route'])
  })

  it('reports nothing when everything is present', () => {
    document.body.innerHTML =
      '<button data-guide="present"></button><button data-guide="absent"></button><button data-guide="no-route"></button>'
    expect(findMissingTargets(tour, '/')).toEqual([])
  })

  it('checks every step when no location is provided', () => {
    document.body.innerHTML = ''
    expect(findMissingTargets(tour, undefined)).toEqual([
      'present',
      'absent',
      'elsewhere',
      'no-route',
    ])
  })
  it('escapes targets containing a quote instead of throwing', () => {
    document.body.innerHTML = ''
    const quoted: Tour = { id: 'demo', steps: [{ target: 'a"b' }] }
    expect(() => findMissingTargets(quoted, undefined)).not.toThrow()
    expect(findMissingTargets(quoted, undefined)).toEqual(['a"b'])
  })
})
