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

// jsdom runs no layout, so every getBoundingClientRect is all zeros and a hidden element is
// indistinguishable from a visible one. That is precisely the distinction the hotspot marker
// has to make, so the stub supplies just enough of it: an element hidden with display:none
// measures zero, as it does in a browser, and everything else gets one fixed box.
const HIDDEN_RECT = { top: 0, left: 0, width: 0, height: 0, right: 0, bottom: 0, x: 0, y: 0 }
const LAID_OUT_RECT = { top: 10, left: 20, width: 100, height: 40, right: 120, bottom: 50, x: 20, y: 10 }

Element.prototype.getBoundingClientRect = function getBoundingClientRect(this: Element) {
  let node: Element | null = this
  while (node) {
    if (node instanceof HTMLElement && node.style.display === 'none') {
      return { ...HIDDEN_RECT, toJSON: () => HIDDEN_RECT } as DOMRect
    }
    node = node.parentElement
  }
  return { ...LAID_OUT_RECT, toJSON: () => LAID_OUT_RECT } as DOMRect
}
