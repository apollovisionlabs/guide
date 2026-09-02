import { describe, expect, it } from 'vitest'
import { matchRoute, isLiteralRoute } from '../src/matchRoute'

describe('matchRoute', () => {
  it('accepte une correspondance exacte', () => {
    expect(matchRoute('/nc', '/nc')).toBe(true)
  })

  it('refuse un chemin différent', () => {
    expect(matchRoute('/nc', '/audit')).toBe(false)
  })

  it('refuse un chemin plus profond que le motif', () => {
    expect(matchRoute('/nc', '/nc/123')).toBe(false)
  })

  it('accepte un segment paramétré', () => {
    expect(matchRoute('/nc/:id', '/nc/123')).toBe(true)
  })

  it('refuse un segment paramétré vide', () => {
    expect(matchRoute('/nc/:id', '/nc/')).toBe(false)
  })

  it('accepte un joker en fin de motif', () => {
    expect(matchRoute('/nc/*', '/nc/123/details')).toBe(true)
  })

  it('ignore la barre oblique finale', () => {
    expect(matchRoute('/nc/', '/nc')).toBe(true)
  })

  it('ignore la chaîne de requête', () => {
    expect(matchRoute('/nc', '/nc?page=2')).toBe(true)
  })

  it('gère la racine', () => {
    expect(matchRoute('/', '/')).toBe(true)
    expect(matchRoute('/', '/nc')).toBe(false)
  })
})

describe('isLiteralRoute', () => {
  it('reconnaît un motif littéral', () => {
    expect(isLiteralRoute('/nc')).toBe(true)
  })

  it('rejette un motif paramétré ou joker', () => {
    expect(isLiteralRoute('/nc/:id')).toBe(false)
    expect(isLiteralRoute('/nc/*')).toBe(false)
  })
})
