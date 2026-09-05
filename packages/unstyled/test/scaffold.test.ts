import { describe, expect, it } from 'vitest'
import * as unstyled from '../src/index'

describe('the package', () => {
  it('has an entry point that can be imported', () => {
    expect(unstyled).toBeTypeOf('object')
  })
})
