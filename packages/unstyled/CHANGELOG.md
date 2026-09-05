# @apollovisionlabs/guide-unstyled

## 0.1.0

### Minor Changes

- 5d45d55: A new rendering layer for `@apollovisionlabs/guide-core`: the tour, the checklist and the
  hotspots as plain DOM elements, with no UI toolkit and no CSS-in-JS.
  
  It renders the same three surfaces `@apollovisionlabs/guide-mui` does: `GuideTour` (the spotlight
  overlay and the step popover), `Checklist` and `ChecklistLauncher`, and `Hotspots`. Every part
  carries a `guide-` class and a `data-guide-part` attribute and nothing else, so appearance is
  entirely yours to set: write your own CSS against those selectors, import the optional stylesheet
  this package ships (`@apollovisionlabs/guide-unstyled/styles.css`) for a default look driven by
  CSS custom properties, or do both; the stylesheet never sets the positioning or stacking the
  components already compute, so it never fights them.
  
  This package has no runtime dependency beyond `@apollovisionlabs/guide-core`. Peer dependencies
  are `react` and `react-dom`, `^19` each.
  
  A few limits to know before installing:
  
  - Positioning is resolved against the viewport, not a scrolling ancestor: a target near the edge
    of its own scroll container, rather than the window's, is not corrected for.
  - The checklist launcher's button and the hotspot markers share the same default stacking level
    unless each is given an explicit `zIndex`.
  - The checklist's progress bar exposes `aria-valuenow` for assistive technology, but the shipped
    stylesheet styles it as a flat track: nothing in the markup carries the percentage as a width or
    a custom property a stylesheet could read for a proportional fill.

### Patch Changes

- Updated dependencies [18d139e]
  - @apollovisionlabs/guide-core@0.3.1
