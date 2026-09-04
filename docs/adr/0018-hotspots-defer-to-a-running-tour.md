---
type: ADR
title: 0018. Hotspots defer to a running tour, and a stranded focus lands on the step's target
description: Hotspots draws no marker while a tour is running or paused, and GuideProvider falls back to the last step's element when the control that started the tour is gone.
tags: [adr, architecture, accessibility]
status: stable
generated:
  by: claude-opus-5
  at: 2026-09-04T15:00:00Z
  directed_by: human:remy dème
---

# 0018. Hotspots defer to a running tour, and a stranded focus lands on the step's target

## Status

Stable. Follows [ADR 0017](0017-advancing-on-an-action-implies-an-interactive-step.md) and
refines the focus rules in [ADR 0008](0008-accessibility-in-the-core.md).

## Context

`HotspotProvider` and `GuideProvider` were built as siblings that know nothing about each other's
activity, and neither layer asked whether the other was live. Four defects followed from that one
gap, all of them at the seam.

A hotspot marker is `position: fixed` at its target's top-right corner. When a tour step points at
the same element, which the shipped demo does (`apps/demo/src/hotspots.ts` marks
`project.share`, and `productTour`'s last step advances on a click of it), the marker is on top.
Playwright says it plainly: `<button aria-label="Show what is new: Share a project"> intercepts
pointer events`. The click meant for the step opened the bubble instead, the step never advanced,
and the user was left with a dialog stacked on a stuck step whose only exit was `Escape`, the
hotspot retired forever without having explained anything. On a non-interactive step the marker was
worse than wrong, drawn bright and pulsing yet completely inert, because the spotlight at
`theme.zIndex.modal` swallows the click. And a tour launched from a hotspot left that hotspot's own
marker holding keyboard focus over the step it had just launched.

Hiding the marker fixes all three, and creates a fourth problem. `GuideProvider.start` captures
`document.activeElement` as its restore origin, which on that path is the bubble's "Show me"
button, and the bubble's focus trap captures the marker. Both unmount when the tour starts, so both
restore targets are detached and `previouslyFocused.focus()` is a no-op on a detached node: the
tour ends with focus on `document.body`, no focus ring, nothing announced, and the next `Tab`
restarting at the top of the page.

## Decision

`Hotspots` (`packages/mui/src/Hotspots.tsx`) reads `GuideContext` with `useContext`, tolerating a
null exactly as `HotspotProvider` already does, and draws no marker while
`state.status` is `running` or `paused`. An ambient hint must not compete with a guided flow the
user is already in. `paused` counts because a paused tour is waiting for its target, not finished.
Nothing here touches `seen`: this is suppression, not retirement, and the markers come back
unchanged when the tour ends. `hotspot:show` stays deduplicated per mount, so nothing is announced
twice.

Reading the context rather than calling `useTour` is what keeps `HotspotProvider` independent: a
project that uses hotspots and no tours has no `GuideProvider` in its tree and must keep working.

`GuideProvider` (`packages/core/src/GuideProvider.tsx`) keeps a ref to the element the tour last
pointed at. When the tour ends and the captured origin is detached, focus falls back to that
element, which is present, is what the user was just being shown, and is where reading should
resume. Only when `document.activeElement` is `document.body`: a user who has already clicked or
tabbed somewhere keeps what they chose. Not stranding the user and not stealing from them are both
requirements, the rule `ChecklistLauncher` established.

If the element cannot take focus on its own, a `tabindex="-1"` is added, focus is attempted, and
the attribute is kept only if `document.activeElement` is then the element; otherwise it is
removed again immediately and no listener is left behind. When it is kept, a blur listener drops
it as soon as focus leaves. An element the host already put in the tab order is focused as it is
and never touched. The verification is not a formality: an element with no box, because it or an
ancestor is `display: none`, silently ignores `focus()` and fires no blur, so an attribute written
optimistically and a listener waiting for that blur would both outlive the page.

## Consequences

- A hotspot pointing at an element a tour also points at is now a supported arrangement rather
  than a trap, which matters because it is the natural one: both features mark what is worth
  noticing.
- A project that wants a marker visible during a tour cannot have one. That is deliberate; the
  competing-affordance problem returns with it, and no consumer has asked.
- The focus fallback also covers the plain case of a launch button that unmounts for reasons of
  its own, not only the hotspot path.
- The fallback focuses application markup the library does not own. The temporary `tabindex` keeps
  that as small as it can be, but a host with its own focus handling on the target will see a
  focus event it did not cause, and `focus()` carries an implicit scroll, so the page can move to
  bring the target into view when the tour ends.
- Focus can still end up nowhere. If the element the tour last pointed at cannot take focus at the
  moment the tour ends, the honest outcome is that no focus is placed and the user is left on
  `document.body`, which is where they were. This is stated rather than papered over: the library
  will not write a permanent attribute into a host's DOM to chase a focus that cannot land. The
  case that produces it, a step target hidden between the last step and the end of the tour, is
  rare and is not a state a tour should be left in anyway.
- Suppressing markers on `paused` means the suppression can outlive any visible tour. A tour
  paused waiting for a target that never mounts draws nothing itself, under the `wait` policy,
  and now also hides every hotspot for as long as it stays paused, with `Escape` as the only exit
  and nothing on screen to suggest it. That is a consequence of treating `paused` as live, which
  is the right call for the case that actually happens (a target that appears a moment later), and
  the underlying problem, a paused tour with no visible affordance, predates this decision.

## Alternatives considered

- **Raise the marker's `zIndex` above the spotlight.** Makes the collision worse: the marker would
  then be clickable during every step, not merely during interactive ones.
- **Hide only the markers that collide with the current step's target.** Narrower, and wrong on the
  other two faces: an inert pulsing marker elsewhere on a dimmed page and a marker holding focus
  over the step are neither of them about the target.
- **Keep the marker alive to receive focus back.** Impossible after this change, and pointless
  anyway: by then the hotspot is seen, so it has no marker to come back to.
- **Give `GuideProvider` an off-screen focus destination, as `ChecklistLauncher` has.** That adds
  chrome to a headless provider, which [ADR 0001](0001-headless-core-and-rendering-layer.md) exists
  to prevent. The step's own target is a better destination in any case: it is the thing the tour
  was about.
