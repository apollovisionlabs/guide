function segments(value: string): string[] {
  const path = value.split('?')[0] ?? ''
  const trimmed = path.replace(/\/+$/, '')
  return (trimmed === '' ? '/' : trimmed).split('/')
}

export function isLiteralRoute(pattern: string): boolean {
  return !pattern.includes(':') && !pattern.includes('*')
}

export function matchRoute(pattern: string, pathname: string): boolean {
  const expected = segments(pattern)
  const actual = segments(pathname)

  for (let index = 0; index < expected.length; index += 1) {
    const segment = expected[index]
    if (segment === '*') return true

    const candidate = actual[index]
    if (candidate === undefined) return false

    if (segment?.startsWith(':')) {
      if (candidate === '') return false
      continue
    }

    if (segment !== candidate) return false
  }

  return expected.length === actual.length
}
