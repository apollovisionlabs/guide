import '@testing-library/jest-dom/vitest'

// A real ResizeObserver invokes its callback whenever an observed element's size changes,
// which is exactly what usePosition relies on to reposition a floating element that grows or
// shrinks after mount (a tour popover whose body text wraps to a new height, say). jsdom has
// no ResizeObserver at all, so this stub keeps track of what each instance observes and lets a
// test fire the callback for a given element, rather than being an inert no-op.
type ResizeObserverStubCallback = (entries: ResizeObserverEntry[], observer: ResizeObserver) => void

class ResizeObserverStub {
  static instances = new Set<ResizeObserverStub>()

  private readonly callback: ResizeObserverStubCallback
  private readonly elements = new Set<Element>()

  constructor(callback: ResizeObserverStubCallback) {
    this.callback = callback
    ResizeObserverStub.instances.add(this)
  }

  observe(element: Element) {
    this.elements.add(element)
  }

  unobserve(element: Element) {
    this.elements.delete(element)
  }

  disconnect() {
    this.elements.clear()
    ResizeObserverStub.instances.delete(this)
  }

  fire(element: Element) {
    if (!this.elements.has(element)) return
    this.callback([{ target: element } as ResizeObserverEntry], this as unknown as ResizeObserver)
  }
}

/** Fires every ResizeObserver currently observing `element`, as a browser would on a resize. */
export function triggerResizeObserver(element: Element) {
  for (const instance of ResizeObserverStub.instances) instance.fire(element)
}

globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver

// jsdom runs no layout, so `document.documentElement.clientWidth` and `clientHeight` are both
// 0 rather than the viewport size a browser reports. usePosition clamps against those two
// (they exclude a space-taking scrollbar, which `window.innerWidth` includes, and every rect
// they are compared with comes from getBoundingClientRect, which excludes it too), so without
// this stub every floating element in every test would clamp against a zero-sized viewport.
// The default mirrors window.innerWidth/innerHeight, which is what a browser with overlay
// scrollbars reports; a test that needs the two to disagree redefines these itself.
Object.defineProperty(document.documentElement, 'clientWidth', {
  configurable: true,
  get: () => window.innerWidth,
})
Object.defineProperty(document.documentElement, 'clientHeight', {
  configurable: true,
  get: () => window.innerHeight,
})

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
