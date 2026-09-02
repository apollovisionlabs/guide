---
type: ADR
title: 0003. Delegate navigation instead of depending on a router
description: Cross-page tours call a navigate function supplied by the consumer, so the core depends on no router.
tags: [adr, architecture]
status: stable
generated:
  by: claude-opus-5
  at: 2026-09-02T14:46:46Z
  directed_by: human:remy dème
---

# 0003. Delegate navigation instead of depending on a router

## Context

A useful product tour crosses pages. Doing that from inside the library would mean importing a
router — and every consumer using a different one, or a different major of the same one, would be
excluded.

## Decision

`GuideProvider` takes two props (`packages/core/src/GuideProvider.tsx`): `location`, the current
pathname, and `navigate`, a `(path: string) => void` the consumer supplies. A step declares `route`
(a pattern) and optionally `navigateTo` (a concrete path); when `location` does not match `route`,
the provider calls `navigate`. Pattern matching is a 40-line function,
`packages/core/src/matchRoute.ts`, supporting `:param` segments and a `*` wildcard — not a router.

`apps/demo/src/App.tsx` wires React Router's `useNavigate` and `useLocation` into those two props,
demonstrating the intended integration without the packages depending on React Router.

## Consequences

- The core works with any router, or with none.
- Multi-page tours require the consumer to wire both props; a step with a route and no `navigate`
  logs a warning rather than failing silently.
- Repeated navigation had to be guarded: the destination already requested for the current step is
  kept in a ref, and `start()` resets it so restarting the same tour navigates again.
- A route pattern that never matches produces no target request and therefore no timeout, which
  forced the separate route timer described in
  [ADR 0004](0004-missing-target-policy.md) and in [ARCHITECTURE.md](../../ARCHITECTURE.md).
