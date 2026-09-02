import { describe, expect, it } from 'vitest'
import { matchRoute, isLiteralRoute } from '../src/matchRoute'

describe('matchRoute', () => {
  it('accepte une correspondance exacte', () => {
    expect(matchRoute('/items', '/items')).toBe(true)
  })

  it('refuse un chemin différent', () => {
    expect(matchRoute('/items', '/reports')).toBe(false)
  })

  it('refuse un chemin plus profond que le motif', () => {
    expect(matchRoute('/items', '/items/123')).toBe(false)
  })

  it('accepte un segment paramétré', () => {
    expect(matchRoute('/items/:id', '/items/123')).toBe(true)
  })

  it('refuse un segment paramétré vide', () => {
    expect(matchRoute('/items/:id', '/items/')).toBe(false)
  })

  it('accepte un joker en fin de motif', () => {
    expect(matchRoute('/items/*', '/items/123/details')).toBe(true)
  })

  it('ignore la barre oblique finale', () => {
    expect(matchRoute('/items/', '/items')).toBe(true)
  })

  it('ignore la chaîne de requête', () => {
    expect(matchRoute('/items', '/items?page=2')).toBe(true)
  })

  it('gère la racine', () => {
    expect(matchRoute('/', '/')).toBe(true)
    expect(matchRoute('/', '/items')).toBe(false)
  })
})

describe('isLiteralRoute', () => {
  it('reconnaît un motif littéral', () => {
    expect(isLiteralRoute('/items')).toBe(true)
  })

  it('rejette un motif paramétré ou joker', () => {
    expect(isLiteralRoute('/items/:id')).toBe(false)
    expect(isLiteralRoute('/items/*')).toBe(false)
  })
})
