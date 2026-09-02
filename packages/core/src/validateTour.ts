import type { Tour } from './types'
import { matchRoute } from './matchRoute'

export function findMissingTargets(
  tour: Tour,
  location: string | undefined,
  attribute = 'data-guide',
): string[] {
  if (typeof document === 'undefined') return []

  return tour.steps
    .filter((step) => !step.route || location === undefined || matchRoute(step.route, location))
    .map((step) => step.target)
    .filter((target) => !document.querySelector(`[${attribute}="${target}"]`))
}
