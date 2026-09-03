import type { Translate } from './types'

export function resolveText(
  value: string | undefined,
  key: string | undefined,
  translate: Translate | undefined,
): string {
  if (value !== undefined) return value
  if (key === undefined) return ''
  return translate ? translate(key) : key
}
