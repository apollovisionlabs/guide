import '@testing-library/jest-dom/vitest'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver

if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

// jsdom focuses anything it is handed, including an element with no box at all. A browser
// refuses: an element hidden with display:none cannot take focus, and focus() on it is a silent
// no-op that fires no blur either. Without modelling that here, no test can tell a focus that
// landed from a focus that was ignored, which is exactly the distinction the tour's focus
// fallback has to make before it writes anything to a host's DOM.
const nativeFocus = HTMLElement.prototype.focus
HTMLElement.prototype.focus = function focus(this: HTMLElement, options?: FocusOptions) {
  let node: HTMLElement | null = this
  while (node) {
    if (node.style.display === 'none') return
    node = node.parentElement
  }
  nativeFocus.call(this, options)
}
