---
type: ADR
title: 0002. Resolve targets by logical key, never by CSS selector
description: A step names a logical key matched against a data-guide attribute, so tours do not depend on markup structure.
tags: [adr, architecture]
status: stable
generated:
  by: claude-opus-5
  at: 2026-09-02T14:46:46Z
  directed_by: human:remy dème
---

# 0002. Resolve targets by logical key, never by CSS selector

## Context

A tour step must point at an element. A CSS selector couples the tour configuration to class names
and DOM structure, both of which change for reasons that have nothing to do with onboarding, and
both of which a styling refactor is free to rewrite.

## Decision

`Step.target` (`packages/core/src/types.ts`) is a **logical key**. The application marks the
element with `data-guide="<key>"`. `packages/core/src/selector.ts` is the single place that turns a
key into `[data-guide="<escaped key>"]`, escaping with `CSS.escape` and falling back to a manual
escape. Both runtime resolution (`useTargetElement.ts`) and development-time validation
(`validateTour.ts`) call that one builder.

The attribute name is configurable at the resolution layer (`attribute` option) but `data-guide` is
the documented and default contract.

## Consequences

- A tour survives restyling and re-nesting; it breaks only when the marked element is removed,
  which is a meaningful signal.
- Tours are plain serialisable objects, which keeps them storable and shareable.
- The application must place the attributes, which is visible in its markup. That is accepted, and
  arguably a feature, since a reader can see which elements a tour depends on.
- Sharing one selector builder is a correctness requirement, not tidiness: a divergence would let a
  key containing a quote resolve at runtime while throwing a `SyntaxError` during validation. That
  is exactly the bug the shared module's comment records.
