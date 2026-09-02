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
  it('ne signale que les cibles attendues sur la page courante', () => {
    document.body.innerHTML = '<button data-guide="present"></button>'
    expect(findMissingTargets(tour, '/')).toEqual(['absent', 'no-route'])
  })

  it('ne signale rien quand tout est présent', () => {
    document.body.innerHTML =
      '<button data-guide="present"></button><button data-guide="absent"></button><button data-guide="no-route"></button>'
    expect(findMissingTargets(tour, '/')).toEqual([])
  })

  it('vérifie toutes les étapes quand aucune position n est fournie', () => {
    document.body.innerHTML = ''
    expect(findMissingTargets(tour, undefined)).toEqual([
      'present',
      'absent',
      'elsewhere',
      'no-route',
    ])
  })
})
