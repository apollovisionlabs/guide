// Target selector construction, shared by runtime resolution and by development-time
// validation: a target containing a quote must be escaped on both paths, otherwise validation
// throws a SyntaxError where resolution works.
export function escapeAttributeValue(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value)
  }
  return value.replace(/["\\]/g, '\\$&')
}

export function targetSelector(target: string, attribute: string): string {
  return `[${attribute}="${escapeAttributeValue(target)}"]`
}
