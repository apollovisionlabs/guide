import { describe, expect, it } from 'vitest'
import { matchRoute, isLiteralRoute } from '../src/matchRoute'

describe('matchRoute', () => {
  it('accepts an exact match', () => {
    expect(matchRoute('/items', '/items')).toBe(true)
  })

  it('rejects a different path', () => {
    expect(matchRoute('/items', '/reports')).toBe(false)
  })

  it('rejects a path deeper than the pattern', () => {
    expect(matchRoute('/items', '/items/123')).toBe(false)
  })

  it('accepts a parameter segment', () => {
    expect(matchRoute('/items/:id', '/items/123')).toBe(true)
  })

  it('rejects an empty parameter segment', () => {
    expect(matchRoute('/items/:id', '/items/')).toBe(false)
  })

  it('accepts a trailing wildcard', () => {
    expect(matchRoute('/items/*', '/items/123/details')).toBe(true)
  })

  it('ignores a trailing slash', () => {
    expect(matchRoute('/items/', '/items')).toBe(true)
  })

  it('ignores the query string', () => {
    expect(matchRoute('/items', '/items?page=2')).toBe(true)
  })

  it('handles the root path', () => {
    expect(matchRoute('/', '/')).toBe(true)
    expect(matchRoute('/', '/items')).toBe(false)
  })
})

describe('isLiteralRoute', () => {
  it('recognises a literal pattern', () => {
    expect(isLiteralRoute('/items')).toBe(true)
  })

  it('rejects a parameter or wildcard pattern', () => {
    expect(isLiteralRoute('/items/:id')).toBe(false)
    expect(isLiteralRoute('/items/*')).toBe(false)
  })
})
