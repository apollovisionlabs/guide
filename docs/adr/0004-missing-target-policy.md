---
type: ADR
title: 0004. Wait for a missing target, then apply a policy
description: An absent target is awaited by a MutationObserver up to a timeout, after which a skip, wait or error policy decides.
tags: [adr, architecture]
status: stable
generated:
  by: claude-opus-5
  at: 2026-09-02T14:46:46Z
  directed_by: human:remy dème
---

# 0004. Wait for a missing target, then apply a policy

## Context

The element a step points at may not exist when the step becomes current: it may be behind an async
load, a lazy route, or a collapsed panel. Failing immediately makes tours brittle on slow
connections; waiting forever leaves the tour invisible and unquittable.

## Decision

`packages/core/src/useTargetElement.ts` queries for the element, and if it is absent, observes
`document.body` with a `MutationObserver` (`childList`, `subtree`, `attributes`) for up to
`targetTimeoutMs`, default 5000. On expiry it reports `timedOut` **without disconnecting the
observer**, so a late arrival can still be picked up.

The provider then applies a policy (`skip`, `wait` or `error`, with `wait` as the default,
overridable per step through `Step.onMissingTarget`) and emits `target:missing`. `wait` pauses;
an effect resumes the tour automatically when the element appears.

A second timer covers the case where a step's `route` never matches, so no target is ever
requested. It stores the step object that expired rather than a boolean.

## Consequences

- A tour is resilient to slow rendering by default, and a consumer who prefers strictness can opt
  into `error` globally or per step.
- The stored step object makes the mechanism **identity-sensitive**: tours declared as inline
  literals rebuild their steps every render, restarting the effect so the timer never fires and the
  policy never applies. Tours must be module constants; the README says so and
  `apps/demo/src/tours.ts` shows the pattern.
- While waiting, nothing is drawn. `GuideTour` therefore mounts a keyboard-only escape hatch during
  the wait, so Escape can still stop a tour that has nothing on screen.
- Not disconnecting the observer on timeout means it lives until the effect's cleanup. That is
  intentional and must not be "tidied up".
