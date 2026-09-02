// Construction du sélecteur de cible, partagée par la résolution à l'exécution et par la
// validation de développement : une cible contenant un guillemet doit être échappée des deux
// côtés, sans quoi la validation lève une SyntaxError là où la résolution fonctionne.
export function escapeAttributeValue(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value)
  }
  return value.replace(/["\\]/g, '\\$&')
}

export function targetSelector(target: string, attribute: string): string {
  return `[${attribute}="${escapeAttributeValue(target)}"]`
}
