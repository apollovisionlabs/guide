---
type: ADR
title: 0001. Split a headless core from the rendering layer
description: Product-tour logic ships as @guide/core with no UI dependency, and @guide/mui only renders it.
tags: [adr, architecture]
status: stable
generated:
  by: claude-opus-5
  at: 2026-09-02T14:46:46Z
  directed_by: human:remy dème
---

# 0001. Split a headless core from the rendering layer

## Context

A product-tour library mixes two very different concerns: a state machine that decides which step
is current and where its element is, and a set of components that draw a spotlight and a popover.
Existing MIT libraries in this space ship both as one unit, which ties the logic to one visual
style (see [prior art](../references/index.md)).

The repository resolves this as two published packages. `packages/core/package.json` peer-depends
on `react` alone; `packages/mui/package.json` depends on `@guide/core` and peer-depends on MUI and
Emotion. Nothing under `packages/core/src` imports MUI, Emotion, or a router.

## Decision

All decisions live in `@guide/core` and are exposed as hooks (`useTour`, `useGuideStep`) over a
`GuideProvider`. A rendering package consumes those hooks and adds no behaviour of its own beyond
presentation and the keyboard affordances tied to its own markup.

`packages/core` must never import a UI toolkit. A pull request that does is rejected on that basis
alone.

## Consequences

- A second rendering layer for another design system is a new package against the same hooks, with
  no change to the core.
- Accessibility primitives had to move into the core (see
  [ADR 0008](0008-accessibility-in-the-core.md)), otherwise every renderer would reimplement them.
- Two packages must be versioned together whenever a shared type changes; Changesets'
  `updateInternalDependencies: "patch"` handles the mechanical part.
- Consumers who want their own UI install one package; consumers who want the default install two
  plus MUI and Emotion. The installation instructions in the README carry that cost.
