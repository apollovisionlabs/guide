import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const readme = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'README.md'), 'utf-8')

function section(heading: string): string {
  const start = readme.indexOf(`### \`${heading}\``)
  expect(start, `no README section for ${heading}`).toBeGreaterThan(-1)
  const next = readme.indexOf('\n### ', start + 1)
  return readme.slice(start, next === -1 ? undefined : next)
}

describe('README documents the claims the components make', () => {
  // StepPopover defaults to modal and emits aria-modal="true" (pinned by
  // StepPopover.test.tsx's "carries aria-modal by default, and not when modal is false").
  // That claim is honest only under GuideTour, where the Spotlight overlay really does make the
  // page inert. Rendered standalone, which the README invites, it is the same false claim
  // ChecklistLauncher's panel had removed from it, and the way out is the modal prop that
  // already exists. An adopter only knows that if it is written down.
  it('tells an adopter that a standalone StepPopover needs modal={false}', () => {
    expect(section('StepPopover')).toContain('modal={false}')
  })
})
